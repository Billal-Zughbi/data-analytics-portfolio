"""Command line entry point.

    python -m olist_delivery check    [--data-dir PATH]           row counts, checksums, version
    python -m olist_delivery build    [--data-dir PATH] [--db P]  SQL 00-04 into DuckDB, validations must pass
    python -m olist_delivery analyze  [--data-dir PATH] [--db P]  pandas rebuild + reconciliation with SQL
    python -m olist_delivery export   [--data-dir PATH] [--db P]  analyze, then figures, CSVs, Power BI, site JSON
    python -m olist_delivery all      [--data-dir PATH] [--db P]  build + export

Run from projects/olist-delivery-experience with PYTHONPATH=src (or after
`pip install -e .`). The raw folder defaults to $OLIST_DATA_DIR, then data/raw/.
Every command exits non-zero when a check fails.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import pandas as pd

from . import analyze, clean, database, export, figures, ingest, reconcile
from .config import (
    ANALYSIS_DIR,
    DEFAULT_DB_PATH,
    EXPECTED_ROWS_KAGGLE_V2,
    FIGURES_DIR,
    OUTPUTS_DIR,
    REPO_DIR,
    SAMPLE_DIR,
    SITE_DATA_DIR,
    resolve_data_dir,
)

SITE_MAX_BYTES = 150_000
SAMPLE_MAX_BYTES = 1_500_000


def _version_note(check: ingest.SourceCheck) -> str:
    if check.version == "kaggle-v2":
        return "Row counts match Kaggle version 2 for all nine files."
    if check.version == "github-mirror-2026-10-11":
        return (
            "GitHub mirror (SHA-256 verified). Eight files match Kaggle v2 row counts; the reviews file has "
            f"{check.rows['order_reviews']:,} rows against {EXPECTED_ROWS_KAGGLE_V2['order_reviews']:,} in Kaggle v2, "
            "which matches the dataset's earlier 100,000-review release."
        )
    return f"Unrecognised version ({check.version}); see problems."


def cmd_check(args) -> dict:
    data_dir = resolve_data_dir(args.data_dir)
    print(f"raw data: {data_dir}")
    check = ingest.check_sources(data_dir)
    for key in check.rows:
        print(f"  {key:<22} {check.rows[key]:>10,} rows  {check.bytes[key]:>12,} bytes")
    print(f"  total bytes {sum(check.bytes.values()):,}; version: {check.version}")
    payload = check.as_dict() | {"version_note": _version_note(check), "sha256": check.sha256}
    if not check.ok:
        for p in check.problems:
            print("  PROBLEM:", p)
        raise SystemExit("source check failed")
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUTS_DIR / "source_check.json").write_text(json.dumps(payload, indent=1) + "\n", encoding="utf-8")
    return payload


def cmd_build(args) -> database.BuildResult:
    cmd_check(args)
    data_dir = resolve_data_dir(args.data_dir)
    db_path = Path(args.db)
    print(f"building {db_path}")
    result = database.build(data_dir, db_path)
    database.print_validation(result)
    result.validation.to_csv(OUTPUTS_DIR / "validation_results.csv", index=False)
    database.assert_valid(result)
    print(f"build ok in {result.seconds:.1f}s")
    return result


def _run_pandas(data_dir: Path):
    t0 = time.perf_counter()
    frames = ingest.read_raw(data_dir)
    fact, items = clean.order_fact(frames)
    metrics = analyze.headline_metrics(fact, items)
    tables = analyze.all_tables(fact, items)
    print(f"pandas pipeline: {len(fact):,} orders, {len(items):,} items in {time.perf_counter() - t0:.1f}s")
    return fact, items, metrics, tables


def cmd_analyze(args):
    data_dir = resolve_data_dir(args.data_dir)
    db_path = Path(args.db)
    if not db_path.exists():
        raise SystemExit(f"{db_path} not found; run `python -m olist_delivery build` first")
    fact, items, metrics, tables = _run_pandas(data_dir)
    recon = reconcile.reconcile(db_path, metrics, tables)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    recon.to_csv(OUTPUTS_DIR / "reconciliation.csv", index=False, float_format="%.10g")
    bad = recon[~recon["match"]]
    print(f"reconciliation: {int(recon['match'].sum())}/{len(recon)} rows match "
          f"({int((~recon['metric'].str.startswith('table:')).sum())} metrics, "
          f"{int(recon['metric'].str.startswith('table:').sum())} tables)")
    if len(bad):
        print(bad.to_string())
        raise SystemExit("SQL and pandas disagree")
    return fact, items, metrics, tables, recon


def cmd_export(args) -> None:
    fact, items, py_metrics, tables, recon = cmd_analyze(args)
    db_path = Path(args.db)
    source_check = json.loads((OUTPUTS_DIR / "source_check.json").read_text(encoding="utf-8"))
    validation = pd.read_csv(OUTPUTS_DIR / "validation_results.csv")
    validation["passed"] = validation["passed"].astype(bool)

    marts = export.load_marts(db_path)
    metrics = export.metric_dict(marts)
    stats = analyze.score_comparison(fact)
    peak = tables["peak_period_comparison"]
    repeat_ci = export.repeat_intervals(marts)
    dist = export.distribution_summary(db_path)
    cover = export.coverage(db_path)

    written = export.write_analysis_csvs(marts, ANALYSIS_DIR)
    peak.to_csv(ANALYSIS_DIR / "peak_period_comparison.csv", index=False, float_format="%.10g")
    (OUTPUTS_DIR / "statistics.json").write_text(json.dumps(
        {"score_comparison": stats, "repeat_by_first_delivery_ci": repeat_ci, "estimate_distribution": dist,
         "coverage": cover}, indent=1, default=float) + "\n", encoding="utf-8")
    print(f"wrote {len(written) + 2} analysis files to {ANALYSIS_DIR.relative_to(REPO_DIR)}")

    pngs = figures.write_all(marts, FIGURES_DIR, metrics["late_rate"])
    print(f"wrote {len(pngs)} figures to {FIGURES_DIR.relative_to(REPO_DIR)}")

    pbi = export.powerbi_tables(db_path)
    pbi_paths = export.write_powerbi(pbi, SAMPLE_DIR)
    expected = export.powerbi_expected_values(pbi, metrics)
    expected.to_csv(OUTPUTS_DIR / "powerbi_expected_values.csv", index=False, float_format="%.6f")
    if not expected["match"].all():
        print(expected.to_string())
        raise SystemExit("Power BI CSVs do not reproduce the pipeline metrics")
    sample_bytes = export.assert_public_safe(pbi_paths, SAMPLE_MAX_BYTES)
    print(f"wrote {len(pbi_paths)} Power BI tables ({sample_bytes:,} bytes) to {SAMPLE_DIR.relative_to(REPO_DIR)}; "
          f"{int(expected['match'].sum())}/{len(expected)} expected values reproduced from the CSVs")

    summary = export.build_summary(metrics, marts, source_check, cover, validation, recon, peak, repeat_ci, stats)
    site_paths = [export._write_json(SITE_DATA_DIR / "summary.json", summary)]
    for name, payload in export.chart_payloads(marts, metrics, dist, repeat_ci).items():
        site_paths.append(export._write_json(SITE_DATA_DIR / name, payload))
    site_bytes = export.assert_public_safe(site_paths, SITE_MAX_BYTES)
    print(f"wrote {len(site_paths)} JSON files ({site_bytes:,} bytes) to {SITE_DATA_DIR.relative_to(REPO_DIR)}")


def cmd_all(args) -> None:
    cmd_build(args)
    cmd_export(args)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="olist_delivery", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    for name, func, text in [
        ("check", cmd_check, "count rows and verify checksums of the raw CSVs"),
        ("build", cmd_build, "build the DuckDB database and run every validation"),
        ("analyze", cmd_analyze, "rebuild metrics in pandas and reconcile them with SQL"),
        ("export", cmd_export, "write figures, analysis CSVs, Power BI tables and website JSON"),
        ("all", cmd_all, "build + export"),
    ]:
        p = sub.add_parser(name, help=text)
        p.add_argument("--data-dir", help="folder with the nine Olist CSVs (default: $OLIST_DATA_DIR or data/raw/)")
        p.add_argument("--db", default=str(DEFAULT_DB_PATH), help="DuckDB file (default: data/interim/olist.duckdb)")
        p.set_defaults(func=func)
    args = parser.parse_args(argv)
    try:
        args.func(args)
    except ingest.MissingDataError as exc:
        print(exc, file=sys.stderr)
        raise SystemExit(2) from None
    except database.ValidationError as exc:
        print(f"VALIDATION FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()

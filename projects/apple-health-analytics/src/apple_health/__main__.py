"""Command line entry point.

    python -m apple_health demo                 # synthetic export → site JSON (public)
    python -m apple_health profile --xml PATH   # private: quality profile of a real export
    python -m apple_health legacy-csv --xml PATH --out DIR

Run from ``projects/apple-health-analytics`` with ``PYTHONPATH=src``.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import extract as ex
from . import export_web, quality, synthetic, transform

PROJECT_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = PROJECT_DIR.parents[1]
SYNTHETIC_XML = PROJECT_DIR / "data" / "synthetic" / "export.xml"
SITE_DATA_DIR = REPO_DIR / "website" / "src" / "data" / "generated" / "apple-health"
SAMPLE_DIR = PROJECT_DIR / "data" / "sample"
OUTPUTS_DIR = PROJECT_DIR / "outputs"


def run_demo(args: argparse.Namespace) -> None:
    manifest = synthetic.generate(SYNTHETIC_XML, seed=args.seed)
    manifest["synthetic"] = True
    print(f"synthetic export: {manifest['records']:,} records over {manifest['days']} days")

    result = ex.extract(SYNTHETIC_XML)
    daily, stats = transform.build_daily(result.records)
    report = quality.profile(result.records, daily, stats)
    report["transform"] = stats

    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUTS_DIR / "data_quality_synthetic.json").write_text(
        json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    written = export_web.write_outputs(
        result.records, daily, report, manifest, SITE_DATA_DIR, SAMPLE_DIR
    )
    for path in written:
        print("wrote", path.relative_to(REPO_DIR))


def run_profile(args: argparse.Namespace) -> None:
    """Private use: prints counts only, writes nothing inside the repository."""
    result = ex.extract(args.xml)
    daily, stats = transform.build_daily(result.records)
    report = quality.profile(result.records, daily, stats)
    print(json.dumps(report["checks"], indent=1))
    print(json.dumps({m["metric"]: m["records"] for m in report["by_metric"]}, indent=1))


def run_legacy(args: argparse.Namespace) -> None:
    for path in ex.extract_legacy_csvs(args.xml, args.out):
        print("wrote", path)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="apple_health")
    sub = parser.add_subparsers(dest="cmd", required=True)
    demo = sub.add_parser("demo", help="generate synthetic data and website outputs")
    demo.add_argument("--seed", type=int, default=synthetic.SEED)
    demo.set_defaults(func=run_demo)
    prof = sub.add_parser("profile", help="quality profile of a real export (prints counts only)")
    prof.add_argument("--xml", required=True)
    prof.set_defaults(func=run_profile)
    leg = sub.add_parser("legacy-csv", help="one CSV per type, like the original script")
    leg.add_argument("--xml", required=True)
    leg.add_argument("--out", required=True)
    leg.set_defaults(func=run_legacy)
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()

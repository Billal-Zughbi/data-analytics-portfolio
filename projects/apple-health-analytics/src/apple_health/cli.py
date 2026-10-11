"""Command-line entry point.

    # Your real export (stays on your machine, outputs go to data/sanitized/)
    python -m apple_health run --export data/raw/apple_health_export/export.xml

    # Synthetic demo (writes data/sample/ and refreshes the website summary)
    python -m apple_health demo
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from .parse import load_records
from .sanitize import build_tables, portfolio_summary, write_outputs
from .synthetic import generate_export

PROJECT_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = PROJECT_DIR.parents[1]
WEBSITE_SUMMARY = REPO_DIR / "website" / "src" / "data" / "apple-health-summary.json"


def _process(export: Path, out_dir: Path, data_source: str) -> Path:
    records = load_records(export)
    tables = build_tables(records)
    summary = portfolio_summary(tables, total_records=len(records), data_source=data_source)
    for path in write_outputs(tables, summary, out_dir):
        print(f"wrote {path.relative_to(REPO_DIR) if path.is_relative_to(REPO_DIR) else path}")
    print(f"{len(records):,} allowlisted records -> {len(tables['fact_daily_metric']):,} daily rows")
    return out_dir / "portfolio_summary.json"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="apple_health", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="sanitize a real Apple Health export")
    run.add_argument("--export", type=Path, required=True, help="path to export.xml")
    run.add_argument("--out", type=Path, default=PROJECT_DIR / "data" / "sanitized")
    run.add_argument("--publish-summary", action="store_true",
                     help="also copy portfolio_summary.json into the website")

    demo = sub.add_parser("demo", help="build outputs from synthetic data")
    demo.add_argument("--days", type=int, default=365)

    args = parser.parse_args(argv)

    if args.command == "run":
        summary = _process(args.export, args.out, data_source="personal-export-aggregated")
        if args.publish_summary:
            shutil.copyfile(summary, WEBSITE_SUMMARY)
            print(f"published summary to {WEBSITE_SUMMARY.relative_to(REPO_DIR)}")
    else:
        raw = PROJECT_DIR / "data" / "raw" / "synthetic_export.xml"  # git-ignored
        n = generate_export(raw, days=args.days)
        print(f"generated {n:,} synthetic records")
        summary = _process(raw, PROJECT_DIR / "data" / "sample", data_source="synthetic")
        shutil.copyfile(summary, WEBSITE_SUMMARY)
        print(f"published summary to {WEBSITE_SUMMARY.relative_to(REPO_DIR)}")


if __name__ == "__main__":
    main()

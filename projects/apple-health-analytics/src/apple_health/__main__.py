"""Command line entry point. Run from ``projects/apple-health-analytics`` with ``PYTHONPATH=src``.

    python -m apple_health build                       # committed daily table → site JSON, Power BI tables, quality report
    python -m apple_health ingest-xml --xml PATH       # private: fresh export.xml → data/daily/
    python -m apple_health ingest-pbix --pbix PATH     # private: original .pbix → data/original/
    python -m apple_health profile --xml PATH          # private: quality profile of a fresh export.xml (prints counts only)
    python -m apple_health legacy-csv --xml PATH --out DIR
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = PROJECT_DIR.parents[1]
ORIGINAL_DIR = PROJECT_DIR / "data" / "original"
DAILY_DIR = PROJECT_DIR / "data" / "daily"
MODEL_DIR = PROJECT_DIR / "data" / "model"
OUTPUTS_DIR = PROJECT_DIR / "outputs"
SITE_DATA_DIR = REPO_DIR / "website" / "src" / "data" / "generated" / "apple-health"


def run_build(args: argparse.Namespace) -> None:
    from . import publish

    for path in publish.build(ORIGINAL_DIR, DAILY_DIR, SITE_DATA_DIR, MODEL_DIR, OUTPUTS_DIR):
        print("wrote", path.relative_to(REPO_DIR))


def run_ingest(args: argparse.Namespace) -> None:
    from . import pbix_source

    for path in pbix_source.ingest(Path(args.pbix), ORIGINAL_DIR):
        print("wrote", path.relative_to(REPO_DIR))


def run_ingest_xml(args: argparse.Namespace) -> None:
    from . import xml_source

    for path in xml_source.ingest(Path(args.xml), DAILY_DIR):
        print("wrote", path.relative_to(REPO_DIR))


def run_profile(args: argparse.Namespace) -> None:
    """Private use: prints counts only, writes nothing inside the repository."""
    from . import extract as ex
    from . import quality, transform

    result = ex.extract(args.xml)
    daily, stats = transform.build_daily(result.records)
    report = quality.profile(result.records, daily, stats)
    print(json.dumps(report["checks"], indent=1))
    print(json.dumps({m["metric"]: m["records"] for m in report["by_metric"]}, indent=1))


def run_legacy(args: argparse.Namespace) -> None:
    from . import extract as ex

    for path in ex.extract_legacy_csvs(args.xml, args.out):
        print("wrote", path)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="apple_health")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("build", help="build site JSON, Power BI tables and the quality report").set_defaults(func=run_build)
    ing = sub.add_parser("ingest-pbix", help="read the original .pbix into data/original/ (private input)")
    ing.add_argument("--pbix", required=True)
    ing.set_defaults(func=run_ingest)
    ixml = sub.add_parser("ingest-xml", help="read a fresh export.xml into data/daily/ (private input)")
    ixml.add_argument("--xml", required=True)
    ixml.set_defaults(func=run_ingest_xml)
    prof = sub.add_parser("profile", help="quality profile of a fresh export.xml (prints counts only)")
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

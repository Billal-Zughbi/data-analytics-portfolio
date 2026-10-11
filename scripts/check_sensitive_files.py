#!/usr/bin/env python3
"""Pre-push safety check for the portfolio repository.

Scans the files git is about to publish and fails if it finds:
  * prohibited files: raw Apple Health exports, ECG / workout-route / clinical
    files, Power BI files that embed data, env files, keys and credentials;
  * Apple Health record-level content inside data files;
  * likely secrets (private keys, cloud keys, tokens, passwords);
  * files larger than the size limit.

Usage:
    python3 scripts/check_sensitive_files.py          # staged files (default)
    python3 scripts/check_sensitive_files.py --all    # every tracked file
"""

from __future__ import annotations

import argparse
import fnmatch
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MAX_BYTES = 5 * 1024 * 1024

PROHIBITED_GLOBS = [
    "export.xml", "export_cda.xml", "export.zip", "*apple_health_export*",
    "*/workout-routes/*", "*.gpx", "*/electrocardiograms/*", "ecg_*.csv",
    "*/clinical-records/*", "*/clinical_records/*", "*.fhir.json",
    "*/data/raw/*", "*/data/interim/*", "*/data/private/*", "*/data/personal/*",
    "*.pbix", "*.pbit", "*.abf", "*/.pbi/localSettings.json", "*/.pbi/cache.abf",
    ".env", ".env.*", "*.env", "*.pem", "*.key", "*.p12", "*.pfx", "id_rsa*", "id_ed25519*",
    "*credentials*.json", "*service-account*.json", "client_secret*.json", ".npmrc", ".pypirc", ".netrc",
    "*.sqlite", "*.sqlite3", "*.db", "*.duckdb", "*.xlsx", "*.xls", "*.parquet", "*.pkl",
    "HK*.csv", "*/HK*.csv", "*/data/synthetic/*",
]
ALLOWED = {".env.example", "website/.env.example"}

SECRET_PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "GitHub token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b"),
    "Slack token": re.compile(r"\bxox[abpors]-[A-Za-z0-9-]{10,}"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    "Anthropic/OpenAI key": re.compile(r"\bsk-(?:ant-)?[A-Za-z0-9_-]{32,}"),
    "connection string password": re.compile(r"(?i)(?:password|pwd)\s*=\s*[^;\s'\"]{6,}"),
    "assigned secret": re.compile(r"(?i)\b(?:api[_-]?key|secret|token)\b\s*[:=]\s*['\"][A-Za-z0-9/_+=-]{16,}['\"]"),
}

# Record-level Apple Health content is only allowed in the synthetic generator and tests.
HEALTH_RECORD = re.compile(r"<Record\s+type=|\bsourceName=|HKCharacteristicTypeIdentifierDateOfBirth|<ClinicalRecord")
HEALTH_RECORD_ALLOWED = ("projects/apple-health-analytics/tests/fixtures/",)
# Device names in real exports look like "<First name>’s Apple Watch" and identify people.
PERSONAL_DEVICE = re.compile(r"\b[A-Z][a-z]+[’']s (?:Apple Watch|iPhone|iPad)\b")
PERSONAL_DEVICE_ALLOWED = ("scripts/check_sensitive_files.py", "projects/apple-health-analytics/tests/")
HEALTH_DATA_SUFFIXES = {".xml", ".csv", ".json", ".txt", ".tsv"}

TEXT_SUFFIXES = {
    ".py", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".txt", ".csv", ".tsv", ".yml", ".yaml",
    ".toml", ".cfg", ".ini", ".xml", ".dax", ".m", ".sql", ".css", ".html", ".sh", ".tmdl", ".pbir", ".example", "",
}


def git_files(all_files: bool) -> list[str]:
    cmd = ["git", "ls-files"] if all_files else ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"]
    out = subprocess.run(cmd, cwd=REPO, check=True, capture_output=True, text=True).stdout
    return [line for line in out.splitlines() if line]


def check(paths: list[str]) -> list[str]:
    problems = []
    for rel in paths:
        path = REPO / rel
        if not path.is_file():
            continue
        name = path.name
        if rel not in ALLOWED and any(
            fnmatch.fnmatch(rel, g) or fnmatch.fnmatch(name, g) or fnmatch.fnmatch("/" + rel, g) for g in PROHIBITED_GLOBS
        ):
            problems.append(f"{rel}: prohibited file type or location")
            continue
        size = path.stat().st_size
        if size > MAX_BYTES:
            problems.append(f"{rel}: {size / 1e6:.1f} MB exceeds {MAX_BYTES / 1e6:.0f} MB limit")
        if path.suffix.lower() not in TEXT_SUFFIXES or size > MAX_BYTES:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if rel != "scripts/check_sensitive_files.py":
            for label, pattern in SECRET_PATTERNS.items():
                if pattern.search(text):
                    problems.append(f"{rel}: possible {label}")
        if (
            path.suffix.lower() in HEALTH_DATA_SUFFIXES
            and not rel.startswith(HEALTH_RECORD_ALLOWED)
            and HEALTH_RECORD.search(text)
        ):
            problems.append(f"{rel}: contains record-level Apple Health content")
        if not rel.startswith(PERSONAL_DEVICE_ALLOWED) and PERSONAL_DEVICE.search(text):
            problems.append(f"{rel}: contains a personal device name")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--all", action="store_true", help="scan every tracked file instead of staged files")
    args = parser.parse_args()

    files = git_files(args.all)
    problems = check(files)
    scope = "tracked" if args.all else "staged"
    if problems:
        print(f"Sensitive-file check FAILED ({len(problems)} issue(s) in {len(files)} {scope} files):")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"Sensitive-file check passed: {len(files)} {scope} files scanned.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

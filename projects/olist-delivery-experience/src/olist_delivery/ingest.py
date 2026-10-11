"""Find the raw Olist CSVs, check them, and read them as text.

Nothing here interprets values. Typing and business rules live in clean.py
(pandas) and sql/01_staging.sql (DuckDB), which are written separately on
purpose so the two pipelines can be reconciled.
"""

from __future__ import annotations

import csv
import hashlib
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from .config import (
    DATA_DIR_ENV,
    EXPECTED_ROWS_KAGGLE_V2,
    EXPECTED_ROWS_MIRROR,
    FILES,
    MIRROR_SHA256,
)

HOW_TO_GET_DATA = f"""
How to get the data (it is not in the repository):
  1. Kaggle CLI:  kaggle datasets download -d olistbr/brazilian-ecommerce -p data/raw --unzip
  2. Or download the zip from https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce
     and extract the nine CSVs into projects/olist-delivery-experience/data/raw/
Then point the pipeline at the folder with --data-dir PATH or ${DATA_DIR_ENV}=PATH,
or leave the files in data/raw/ (git-ignored)."""


class MissingDataError(FileNotFoundError):
    """Raised when the raw folder or one of the nine files is missing."""


@dataclass
class SourceCheck:
    data_dir: Path
    rows: dict[str, int] = field(default_factory=dict)
    bytes: dict[str, int] = field(default_factory=dict)
    sha256: dict[str, str] = field(default_factory=dict)
    version: str = "unknown"
    problems: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.problems

    def as_dict(self) -> dict:
        return {
            "rows": self.rows,
            "bytes": self.bytes,
            "total_bytes": sum(self.bytes.values()),
            "version": self.version,
            "problems": self.problems,
        }


def require_files(data_dir: Path, names: list[str] | None = None) -> dict[str, Path]:
    """Return {key: path} for the requested files or raise a helpful error."""
    data_dir = Path(data_dir)
    if not data_dir.is_dir():
        raise MissingDataError(f"Raw data folder not found: {data_dir}\n{HOW_TO_GET_DATA}")
    keys = names or list(FILES)
    paths = {k: data_dir / FILES[k] for k in keys}
    missing = [p.name for p in paths.values() if not p.is_file()]
    if missing:
        raise MissingDataError(
            f"{len(missing)} of {len(keys)} Olist files missing in {data_dir}: {', '.join(missing)}\n{HOW_TO_GET_DATA}"
        )
    return paths


def count_csv_rows(path: Path) -> int:
    """Data rows parsed with the csv module (quoted newlines stay in one row)."""
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.reader(fh)
        next(reader, None)
        return sum(1 for _ in reader)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def check_sources(data_dir: Path, hashes: bool = True) -> SourceCheck:
    """Count rows and bytes, identify the version, and list any mismatch."""
    paths = require_files(data_dir)
    result = SourceCheck(data_dir=Path(data_dir))
    for key, path in paths.items():
        result.rows[key] = count_csv_rows(path)
        result.bytes[key] = path.stat().st_size
        if hashes:
            result.sha256[key] = sha256_file(path)

    if result.rows == EXPECTED_ROWS_KAGGLE_V2:
        result.version = "kaggle-v2"
    elif result.rows == EXPECTED_ROWS_MIRROR:
        result.version = "github-mirror-2026-10-11"
        if hashes and result.sha256 != MIRROR_SHA256:
            changed = [k for k in MIRROR_SHA256 if result.sha256.get(k) != MIRROR_SHA256[k]]
            result.version = "mirror-row-counts-but-different-bytes"
            result.problems.append(f"row counts match the mirror but bytes differ for: {', '.join(changed)}")
    else:
        for key, expected in EXPECTED_ROWS_KAGGLE_V2.items():
            got = result.rows[key]
            allowed = {expected, EXPECTED_ROWS_MIRROR[key]}
            if got not in allowed:
                result.problems.append(f"{key}: {got:,} rows, expected {' or '.join(f'{a:,}' for a in sorted(allowed))}")
    return result


def read_raw(data_dir: Path, names: list[str] | None = None) -> dict[str, pd.DataFrame]:
    """Read files as strings (empty strings become NA). No type coercion here."""
    paths = require_files(data_dir, names)
    frames = {}
    for key, path in paths.items():
        df = pd.read_csv(path, dtype=str, keep_default_na=False, na_values=[""], encoding="utf-8-sig")
        frames[key] = df
    return frames

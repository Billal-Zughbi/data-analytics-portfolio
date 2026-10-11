"""Stream an Apple Health ``export.xml`` into a tidy, typed record table.

Refactored from ``legacy/xmlExtraction.py``. The original script wrote one CSV
per record type with the raw ``sourceName`` (a device name, which often contains
a person's first name). This version:

* streams the XML with ``iterparse`` and clears elements, so memory stays flat;
* keeps local wall-clock time from each timestamp's own UTC offset, which is how
  Apple Health assigns records to days;
* replaces ``sourceName`` with a coarse ``device_class`` (watch / phone / other)
  so device names never reach the processed layer;
* reports parse failures instead of hiding them behind a broad ``except``.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import pandas as pd

from .metrics import BY_TYPE, LEGACY_TARGET_TYPES

RECORD_COLUMNS = [
    "hk_type",
    "device_class",
    "start_local",
    "end_local",
    "value_raw",
    "unit",
]

DEVICE_PRIORITY = {"watch": 0, "phone": 1, "other": 2}


def classify_device(source_name: str | None) -> str:
    """Map a free-text device/app name to a coarse class without keeping the name."""
    if not source_name:
        return "other"
    name = source_name.lower()
    if "watch" in name:
        return "watch"
    if "iphone" in name or "phone" in name:
        return "phone"
    return "other"


def parse_local(ts: str | None) -> pd.Timestamp | None:
    """Parse ``YYYY-MM-DD HH:MM:SS ±HHMM`` and keep the local wall-clock time.

    The trailing offset is the device's offset at recording time. Dropping it
    (rather than converting to UTC) keeps a 7am walk on the day it happened,
    which matches how the Health app and the original Power BI report bucket days.
    """
    if not ts or len(ts) < 19:
        return None
    try:
        return pd.Timestamp(ts[:19])
    except ValueError:
        return None


@dataclass
class ExtractResult:
    records: pd.DataFrame
    seen_types: Counter = field(default_factory=Counter)
    skipped_unparseable: int = 0


def iter_records(xml_path: Path, target_types: Iterable[str]):
    targets = set(target_types)
    for _event, elem in ET.iterparse(xml_path, events=("end",)):
        if elem.tag == "Record":
            hk_type = elem.attrib.get("type")
            if hk_type in targets:
                yield elem.attrib.copy()
        # Clear every finished element (Records and their metadata children)
        # so a multi-GB export does not accumulate in memory.
        if elem.tag in ("Record", "Workout", "ActivitySummary", "Correlation"):
            elem.clear()


def extract(xml_path: str | Path, target_types: Iterable[str] | None = None) -> ExtractResult:
    """Read an Apple Health export into a record-level DataFrame."""
    xml_path = Path(xml_path)
    if not xml_path.exists():
        raise FileNotFoundError(
            f"{xml_path} not found. Export from the Health app (profile picture → "
            "Export All Health Data), unzip it, and point --xml at apple_health_export/export.xml."
        )
    targets = list(target_types) if target_types is not None else list(BY_TYPE)

    rows: list[tuple] = []
    seen: Counter = Counter()
    skipped = 0
    for attrib in iter_records(xml_path, targets):
        start = parse_local(attrib.get("startDate"))
        end = parse_local(attrib.get("endDate"))
        if start is None or end is None:
            skipped += 1
            continue
        seen[attrib["type"]] += 1
        rows.append(
            (
                attrib["type"],
                classify_device(attrib.get("sourceName")),
                start,
                end,
                attrib.get("value"),
                attrib.get("unit"),
            )
        )

    df = pd.DataFrame(rows, columns=RECORD_COLUMNS)
    if not df.empty:
        df["hk_type"] = df["hk_type"].astype("category")
        df["device_class"] = df["device_class"].astype("category")
    return ExtractResult(records=df, seen_types=seen, skipped_unparseable=skipped)


def extract_legacy_csvs(xml_path: str | Path, out_dir: str | Path) -> list[Path]:
    """Compatibility mode: one CSV per type, like the original script.

    Output goes to a git-ignored folder (the files are named ``HK*.csv`` and are
    matched by ``.gitignore``) because they are record-level personal data.
    Device names are replaced by ``device_class``.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    result = extract(xml_path, LEGACY_TARGET_TYPES)
    written: list[Path] = []
    for hk_type, frame in result.records.groupby("hk_type", observed=True):
        path = out_dir / f"{hk_type}.csv"
        frame.drop(columns="hk_type").to_csv(path, index=False)
        written.append(path)
    return written

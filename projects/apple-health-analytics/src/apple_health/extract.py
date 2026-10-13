"""Stream an Apple Health ``export.xml`` into a tidy, typed record table.

Refactored from ``legacy/xmlExtraction.py``. The original script wrote one CSV
per record type with the raw ``sourceName`` (a device name, which often contains
a person's first name). This version:

* streams the XML with ``iterparse`` and clears elements, so memory stays flat;
* keeps local wall-clock time from each timestamp's own UTC offset, which is how
  Apple Health assigns records to days;
* replaces ``sourceName`` with a coarse ``device_class`` (watch / phone / other)
  so device names never reach the processed layer (a device keeps only an
  anonymous rank within its class, used to break ties between two watches);
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
    "source_rank",
    "start_local",
    "end_local",
    "value_raw",
    "unit",
]

WORKOUT_COLUMNS = ["activity", "start_local", "duration_min", "active_kcal", "distance_mi", "device_class"]

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


def _local_series(values: list[str | None]) -> pd.Series:
    """Vectorised ``parse_local`` for millions of timestamps."""
    s = pd.Series(values, dtype="object").str.slice(0, 19)
    return pd.to_datetime(s, format="%Y-%m-%d %H:%M:%S", errors="coerce")


@dataclass
class ExtractResult:
    records: pd.DataFrame
    seen_types: Counter = field(default_factory=Counter)
    skipped_unparseable: int = 0
    workouts: pd.DataFrame | None = None


def iter_elements(xml_path: Path, target_types: Iterable[str], workouts: bool = False):
    """Yield ``("record", attrib)`` for target records and, optionally, ``("workout", attrib, stats)``."""
    targets = set(target_types)
    for _event, elem in ET.iterparse(xml_path, events=("end",)):
        tag = elem.tag
        if tag == "Record":
            if elem.attrib.get("type") in targets:
                yield ("record", elem.attrib.copy())
            elem.clear()
        elif tag == "Workout":
            if workouts:
                stats = {c.attrib.get("type"): c.attrib.copy() for c in elem if c.tag == "WorkoutStatistics"}
                yield ("workout", elem.attrib.copy(), stats)
            elem.clear()
        elif tag in ("ActivitySummary", "Correlation"):
            # Clear every finished element so a multi-GB export does not accumulate in memory.
            elem.clear()


def iter_records(xml_path: Path, target_types: Iterable[str]):
    for item in iter_elements(xml_path, target_types):
        yield item[1]


def _workout_row(attrib: dict, stats: dict) -> tuple:
    energy = stats.get("HKQuantityTypeIdentifierActiveEnergyBurned", {})
    distance = next((v for k, v in stats.items() if k and k.startswith("HKQuantityTypeIdentifierDistance")), {})
    kcal = float(energy["sum"]) * (0.239006 if energy.get("unit") == "kJ" else 1.0) if energy.get("sum") else None
    miles = None
    if distance.get("sum"):
        miles = float(distance["sum"]) * {"mi": 1.0, "km": 0.621371, "m": 0.000621371}.get(distance.get("unit", "mi"), float("nan"))
    duration = float(attrib["duration"]) if attrib.get("duration") else None
    if duration is not None and attrib.get("durationUnit") == "sec":
        duration /= 60
    activity = attrib.get("workoutActivityType", "").replace("HKWorkoutActivityType", "")
    return (activity, attrib.get("startDate"), duration, kcal, miles, classify_device(attrib.get("sourceName")))


def extract(xml_path: str | Path, target_types: Iterable[str] | None = None, workouts: bool = False) -> ExtractResult:
    """Read an Apple Health export into a record-level DataFrame (and optionally its workouts)."""
    xml_path = Path(xml_path)
    if not xml_path.exists():
        raise FileNotFoundError(
            f"{xml_path} not found. Export from the Health app (profile picture → "
            "Export All Health Data), unzip it, and point --xml at apple_health_export/export.xml."
        )
    targets = list(target_types) if target_types is not None else list(BY_TYPE)

    cols: dict[str, list] = {k: [] for k in ("hk_type", "source", "start", "end", "value_raw", "unit")}
    workout_rows: list[tuple] = []
    for item in iter_elements(xml_path, targets, workouts=workouts):
        if item[0] == "workout":
            workout_rows.append(_workout_row(item[1], item[2]))
            continue
        attrib = item[1]
        cols["hk_type"].append(attrib["type"])
        cols["source"].append(attrib.get("sourceName"))
        cols["start"].append(attrib.get("startDate"))
        cols["end"].append(attrib.get("endDate"))
        cols["value_raw"].append(attrib.get("value"))
        cols["unit"].append(attrib.get("unit"))

    df = pd.DataFrame(
        {
            "hk_type": cols["hk_type"],
            "source": cols["source"],
            "start_local": _local_series(cols["start"]),
            "end_local": _local_series(cols["end"]),
            "value_raw": cols["value_raw"],
            "unit": cols["unit"],
        }
    )
    bad = df["start_local"].isna() | df["end_local"].isna()
    skipped = int(bad.sum())
    df = df[~bad]
    seen = Counter(df["hk_type"].tolist())

    # Device names are reduced to a class plus an anonymous rank: within a class, the
    # device that first appeared earliest is 0, the next 1, and so on. Names are dropped here.
    names = df["source"].fillna("")
    first_seen = df.groupby(names)["start_local"].min()
    classes = {name: classify_device(name or None) for name in first_seen.index}
    order = sorted(first_seen.index, key=lambda n: (classes[n], first_seen[n]))
    rank: dict[str, int] = {}
    counters: Counter = Counter()
    for name in order:
        rank[name] = counters[classes[name]]
        counters[classes[name]] += 1
    df = df.assign(device_class=names.map(classes), source_rank=names.map(rank).astype(int))
    df = df.drop(columns="source")[RECORD_COLUMNS]
    if not df.empty:
        df["hk_type"] = df["hk_type"].astype("category")
        df["device_class"] = df["device_class"].astype("category")

    wk = None
    if workouts:
        wk = pd.DataFrame(workout_rows, columns=WORKOUT_COLUMNS)
        wk["start_local"] = _local_series(wk["start_local"].tolist())
    return ExtractResult(records=df.reset_index(drop=True), seen_types=seen, skipped_unparseable=skipped, workouts=wk)


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

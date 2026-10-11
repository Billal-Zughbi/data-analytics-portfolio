"""Stream records out of an Apple Health ``export.xml``.

Exports routinely exceed 1 GB, so the file is read with ``iterparse`` and each
element is cleared after use. Only the fields needed for aggregation are kept;
source names, device strings, app versions and metadata (which can identify a
person or their hardware) are never read into memory.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from collections.abc import Iterator
from pathlib import Path
from typing import NamedTuple

import pandas as pd

from .metrics import METRICS, convert_value


class Record(NamedTuple):
    date: str      # local calendar date, YYYY-MM-DD
    metric: str    # Metric.key
    value: float   # normalized to Metric.unit


def iter_records(xml_path: str | Path) -> Iterator[Record]:
    """Yield allowlisted, unit-normalized records from an export file."""
    for _, elem in ET.iterparse(xml_path, events=("end",)):
        metric = METRICS.get(elem.get("type", "")) if elem.tag == "Record" else None
        if metric is not None:
            raw_value = elem.get("value")
            start = elem.get("startDate", "")
            try:
                value = float(raw_value) if raw_value is not None else None
            except ValueError:
                value = None
            if value is not None and len(start) >= 10:
                converted = convert_value(value, elem.get("unit", ""), metric)
                if converted is not None:
                    # startDate is local time ("2024-03-01 08:15:00 -0500"); keep
                    # the calendar date only and discard the time and UTC offset.
                    yield Record(start[:10], metric.key, converted)
        elem.clear()


def load_records(xml_path: str | Path) -> pd.DataFrame:
    """Read an export into a DataFrame with columns date, metric, value."""
    df = pd.DataFrame.from_records(iter_records(xml_path), columns=Record._fields)
    df["date"] = pd.to_datetime(df["date"], format="%Y-%m-%d").dt.date
    return df

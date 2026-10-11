"""Data-quality profile of the record table and the daily fact table.

Checks describe the data; they never assert a particular health outcome.
"""

from __future__ import annotations

import pandas as pd

from .metrics import BY_TYPE, METRICS
from .transform import drop_exact_duplicates, flag_out_of_range, normalize_units


def profile(records: pd.DataFrame, daily: pd.DataFrame, transform_stats: dict) -> dict:
    clean, rejected = normalize_units(records)
    _, exact_dupes = drop_exact_duplicates(clean)
    out_of_range = flag_out_of_range(clean)
    negative_duration = int((records["end_local"] < records["start_local"]).sum())

    by_metric = []
    for metric in METRICS:
        part = records[records["hk_type"] == metric.hk_type]
        if part.empty:
            continue
        units = part["unit"].fillna("(none)").value_counts().to_dict()
        devices = part["device_class"].astype(str).value_counts().to_dict()
        coverage = (
            float(daily[metric.key].notna().mean()) if metric.key in daily else 0.0
        )
        by_metric.append(
            {
                "metric": metric.key,
                "label": metric.label,
                "records": int(len(part)),
                "units": {k: int(v) for k, v in units.items()},
                "devices": {k: int(v) for k, v in devices.items()},
                "out_of_range": int(out_of_range[clean["metric"] == metric.key].sum()),
                "day_coverage": round(coverage, 4),
                "aggregation": metric.aggregation,
            }
        )

    days_total = int(len(daily))
    days_without_watch = (
        int(daily["stand_hours"].isna().sum()) if "stand_hours" in daily else None
    )
    first = daily["date"].min() if days_total else None
    last = daily["date"].max() if days_total else None

    return {
        "records_total": int(len(records)),
        "metrics_present": len(by_metric),
        "date_range": {
            "start": first.date().isoformat() if first is not None else None,
            "end": last.date().isoformat() if last is not None else None,
            "days": days_total,
        },
        "checks": {
            "exact_duplicates": int(exact_dupes),
            "unit_rejected": int(len(rejected)),
            "unit_converted": int(
                (
                    ~clean["hk_type"].astype(str).str.startswith("HKCategoryType")
                    & (clean["unit"] != records.loc[clean.index, "unit"].fillna(""))
                ).sum()
            ),
            "out_of_range": int(out_of_range.sum()),
            "negative_duration": negative_duration,
            "overlap_records_removed": int(transform_stats.get("overlap_records_removed", 0)),
            "days_without_watch_data": days_without_watch,
        },
        "by_metric": by_metric,
    }


def unknown_types(records: pd.DataFrame) -> list[str]:
    return sorted(set(records["hk_type"].astype(str)) - set(BY_TYPE))

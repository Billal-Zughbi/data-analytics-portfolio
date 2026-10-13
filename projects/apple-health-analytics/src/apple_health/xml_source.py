"""Private ingest of a fresh Apple Health ``export.xml``.

Runs only where the export exists (it is git-ignored) and writes public-safe files
to ``data/daily/``:

``daily_metrics.csv``    one row per local calendar day, one column per metric, built with
                         the rules in ``metrics.py`` (device de-duplication, means for
                         rates, energy averages for sound)
``workouts_monthly.csv`` workouts per month, activity type and setting (indoor or outdoor, for
                         walks, runs and rides): count, minutes, kcal, miles
``source_profile.json``  record counts, units, device classes and what each cleaning
                         step removed, per metric

No device names, times of day, workout routes or record-level rows are written.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from . import extract as ex
from . import quality, transform
from .catalog import BY_KEY, CATALOG
from .metrics import METRICS


def _naive_daily_sum(records: pd.DataFrame, key: str) -> pd.Series:
    clean, _ = transform.normalize_units(records)
    part = clean[clean["metric"] == key]
    return part.groupby(part["start_local"].dt.normalize())["value"].sum()


#: The Workout app asks "indoor or outdoor" only for these. Apple writes a default "outdoor" tag on
#: every other workout (strength training, yoga...), which means nothing, so it is left blank there.
SETTING_TAGGED = ("Walking", "Running", "Cycling")


def workouts_monthly(wk: pd.DataFrame) -> pd.DataFrame:
    """Workouts per month, activity and setting. Only counts and totals, never a single workout."""
    wk = wk.dropna(subset=["start_local"])
    location = wk["location"].fillna("").where(wk["activity"].isin(SETTING_TAGGED), "")
    return (
        wk.assign(month=wk["start_local"].dt.strftime("%Y-%m"), location=location)
        .groupby(["month", "activity", "location"], as_index=False)
        .agg(workouts=("activity", "size"), minutes=("duration_min", "sum"), active_kcal=("active_kcal", "sum"),
             distance_mi=("distance_mi", "sum"))
        .round({"minutes": 1, "active_kcal": 0, "distance_mi": 2})
    )


def ingest(xml_path: Path, out_dir: Path) -> list[Path]:
    result = ex.extract(xml_path, workouts=True)
    records = result.records
    wk = result.workouts.dropna(subset=["start_local"])
    daily, stats = transform.build_daily(records)
    profile = quality.profile(records, daily, stats)

    out_dir.mkdir(parents=True, exist_ok=True)
    order = [m.key for m in CATALOG if m.key in daily]
    extra = [m.key for m in METRICS if m.key in daily and m.key not in order]
    out = daily[["date", *order, *extra]].copy()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    for key in order:
        out[key] = out[key].round(max(BY_KEY[key].decimals + 2, 3))
    for key in extra:
        out[key] = out[key].round(3)
    # Drop leading and trailing days with no data at all.
    has = out.drop(columns="date").notna().any(axis=1)
    out = out.loc[has.idxmax(): has[::-1].idxmax()]
    paths = [out_dir / "daily_metrics.csv"]
    out.to_csv(paths[0], index=False)

    paths.append(out_dir / "workouts_monthly.csv")
    workouts_monthly(wk).to_csv(paths[-1], index=False)

    naive = {}
    d = daily.set_index("date")
    for key in ("steps", "distance_walk_run_mi", "active_energy_kcal", "flights_climbed"):
        n = _naive_daily_sum(records, key)
        kept = d[key].reindex(n.index)
        naive[key] = {
            "days": int(n.notna().sum()),
            "avg_without_dedup": round(float(n.mean()), 3),
            "avg_with_dedup": round(float(kept.mean()), 3),
        }
    source = {
        "records_total": profile["records_total"],
        "date_range": profile["date_range"],
        "checks": profile["checks"],
        "by_metric": [
            {k: v for k, v in m.items() if k != "devices"} | {"device_classes": sorted(m["devices"])}
            for m in profile["by_metric"]
        ],
        "overlap_by_metric": stats["overlap_by_metric"],
        "dedup_effect": naive,
        "workouts": int(len(wk)),
        "unparseable_records": result.skipped_unparseable,
    }
    paths.append(out_dir / "source_profile.json")
    paths[-1].write_text(json.dumps(source, indent=1, ensure_ascii=False, default=str) + "\n", encoding="utf-8")
    return paths

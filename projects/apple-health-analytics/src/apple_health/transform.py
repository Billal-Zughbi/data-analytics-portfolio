"""Turn record-level data into a daily fact table with explicit aggregation rules.

Grain of the output: one row per calendar day (local time) with one column per
metric in ``metrics.METRICS``. Every value is computed with the rule declared in
the registry, never with a per-visual default.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .extract import DEVICE_PRIORITY
from .metrics import BY_TYPE, METRICS, STAND_HOUR_STOOD, UNIT_CONVERSIONS

ZERO_FILL_WHEN_WORN = ("exercise_min", "flights_climbed", "stand_hours", "stand_min")


def normalize_units(records: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Attach metric keys, convert to canonical units, and return unconvertible rows.

    Returns ``(clean, rejected)``. Rejected rows have a unit with no known
    conversion; they are reported by the quality step instead of being guessed.
    """
    df = records[records["hk_type"].isin(BY_TYPE)].copy()
    df["metric"] = df["hk_type"].map(lambda t: BY_TYPE[t].key).astype(str)
    canonical = df["hk_type"].map(lambda t: BY_TYPE[t].unit).astype(str)
    is_category = df["hk_type"].astype(str).str.startswith("HKCategoryType")

    numeric = pd.to_numeric(df["value_raw"], errors="coerce")
    unit = df["unit"].fillna("").astype(str)
    factor = pd.Series(
        [
            1.0 if u == c else UNIT_CONVERSIONS.get((u, c), np.nan)
            for u, c in zip(unit, canonical)
        ],
        index=df.index,
    )
    df["value"] = numeric * factor
    rejected = df[~is_category & (df["value"].isna())]
    clean = df[is_category | df["value"].notna()].copy()
    clean["unit"] = canonical[clean.index]
    return clean, rejected


def drop_exact_duplicates(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Remove records that repeat type, device, interval and value exactly.

    Exact duplicates appear when an export is merged from restored backups.
    """
    key = ["metric", "device_class", "source_rank", "start_local", "end_local", "value_raw"]
    before = len(df)
    out = df.drop_duplicates(subset=key)
    return out, before - len(out)


def flag_out_of_range(df: pd.DataFrame) -> pd.Series:
    """Boolean mask of numeric records outside the registry's plausible range.

    Flagged records are excluded from the daily table and counted in the quality
    report, so a sensor glitch (a 250 bpm reading at rest) cannot move a mean
    without anyone noticing.
    """
    lo = df["hk_type"].map(lambda t: BY_TYPE[t].record_min).astype(float)
    hi = df["hk_type"].map(lambda t: BY_TYPE[t].record_max).astype(float)
    value = df["value"]
    return ((lo.notna() & (value < lo)) | (hi.notna() & (value > hi))).fillna(False)


def dedupe_additive(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Keep one device per metric-hour for additive metrics.

    When a watch and a phone both count steps for the same hour, adding them
    double-counts the walk. Within each (metric, hour-of-start) bucket we keep
    the records from the highest-priority device class present
    (watch > phone > other), and within that class the newest device. This is a documented approximation of Health's own
    source-priority merge, which works at a finer interval level.
    """
    if df.empty:
        return df, 0
    df = df.copy()
    df["hour"] = df["start_local"].dt.floor("h")
    df["priority"] = df["device_class"].astype(str).map(DEVICE_PRIORITY).fillna(9)
    best = df.groupby(["metric", "hour"])["priority"].transform("min")
    kept = df[df["priority"] == best]
    # Two devices of the same class in one hour (for example the day a new watch was
    # paired): keep the newer device only.
    if "source_rank" in kept:
        newest = kept.groupby(["metric", "hour"])["source_rank"].transform("max")
        kept = kept[kept["source_rank"] == newest]
    return kept.drop(columns=["hour", "priority"]), len(df) - len(kept)


def energy_mean_db(levels: pd.Series, weights: pd.Series) -> float:
    """Duration-weighted energy average of sound levels in dB."""
    w = weights.clip(lower=1e-9)
    return float(10 * np.log10(np.sum(w * np.power(10.0, levels / 10.0)) / np.sum(w)))


def build_daily(records: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Build the daily fact table and a dictionary of transformation counts."""
    clean, rejected = normalize_units(records)
    clean, exact_dupes = drop_exact_duplicates(clean)
    out_of_range = flag_out_of_range(clean)
    clean = clean[~out_of_range]
    clean["date"] = clean["start_local"].dt.normalize()

    stats: dict = {
        "unit_rejected": int(len(rejected)),
        "exact_duplicates_removed": int(exact_dupes),
        "out_of_range_excluded": int(out_of_range.sum()),
        "overlap_records_removed": 0,
        "overlap_by_metric": {},
    }

    columns: dict[str, pd.Series] = {}
    sample_counts: dict[str, pd.Series] = {}
    for metric in METRICS:
        part = clean[clean["metric"] == metric.key]
        if part.empty:
            continue

        if metric.aggregation == "sum":
            part, removed = dedupe_additive(part)
            stats["overlap_records_removed"] += removed
            if removed:
                stats["overlap_by_metric"][metric.key] = int(removed)
            daily = part.groupby("date")["value"].sum()
        elif metric.aggregation == "mean":
            daily = part.groupby("date")["value"].mean()
        elif metric.aggregation == "energy_mean":
            seconds = (part["end_local"] - part["start_local"]).dt.total_seconds()
            part = part.assign(weight=seconds.where(seconds > 0, 1.0))
            daily = part.groupby("date")[["value", "weight"]].apply(
                lambda g: energy_mean_db(g["value"], g["weight"])
            )
        elif metric.aggregation == "last":
            daily = part.sort_values("start_local").groupby("date")["value"].last()
        elif metric.aggregation == "stood_hours":
            stood = part[part["value_raw"] == STAND_HOUR_STOOD]
            daily = stood.groupby("date")["start_local"].apply(
                lambda s: s.dt.floor("h").nunique()
            ).astype(float)
        else:  # pragma: no cover - registry is a closed set
            raise ValueError(metric.aggregation)

        columns[metric.key] = daily
        sample_counts[metric.key] = part.groupby("date").size()

    if not columns:
        return pd.DataFrame(columns=["date"]), stats

    fact = pd.DataFrame(columns).sort_index()
    full_range = pd.date_range(fact.index.min(), fact.index.max(), freq="D")
    fact = fact.reindex(full_range)
    fact.index.name = "date"

    # A worn watch that logged no exercise means 0 minutes, not "unknown".
    # Leaving those days blank would average only active days and overstate
    # the typical day. Days without any watch heart-rate data stay blank.
    if "heart_rate_bpm" in fact:
        worn = fact["heart_rate_bpm"].notna()
        for key in ZERO_FILL_WHEN_WORN:
            if key not in fact:
                fact[key] = np.nan
            # Only from the first day the metric exists, so a type that a later
            # watchOS version introduced is not back-filled with zeros.
            since = fact[key].first_valid_index()
            started = fact.index >= since if since is not None else np.zeros(len(fact), dtype=bool)
            fact.loc[worn & started & fact[key].isna(), key] = 0.0
        fact = fact[[m.key for m in METRICS if m.key in fact]]
    fact = fact.reset_index()

    counts = pd.DataFrame(sample_counts).reindex(full_range).fillna(0).astype(int)
    stats["days"] = int(len(fact))
    stats["samples_per_metric"] = {k: int(v) for k, v in counts.sum().items()}
    return fact, stats


def naive_sum_by_day(records: pd.DataFrame, metric_key: str) -> pd.Series:
    """The original report's implicit ``Sum`` on a date axis, for comparison only.

    No de-duplication and no averaging: exactly what a Power BI visual does when
    a numeric column is dropped on a chart with the default aggregation.
    """
    clean, _ = normalize_units(records)
    part = clean[clean["metric"] == metric_key]
    return part.groupby(part["start_local"].dt.normalize())["value"].sum()


def arithmetic_mean_by_day(records: pd.DataFrame, metric_key: str) -> pd.Series:
    """Arithmetic mean of dB samples per day, for comparison with the energy mean."""
    clean, _ = normalize_units(records)
    part = clean[clean["metric"] == metric_key]
    return part.groupby(part["start_local"].dt.normalize())["value"].mean()

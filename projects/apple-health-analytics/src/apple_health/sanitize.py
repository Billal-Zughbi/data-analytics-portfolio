"""Turn raw records into public-safe, Power BI-ready tables.

Privacy guarantees of every table produced here:

* Daily grain at the finest: no timestamps, time zones or intra-day patterns.
* Only allowlisted metrics (see ``metrics.METRICS``).
* No source, device, app, location, workout route, ECG or clinical fields.
* A fixed column allowlist is enforced on output (``assert_public_safe``).
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from .metrics import METRICS

METRIC_BY_KEY = {m.key: m for m in METRICS.values()}

PUBLIC_COLUMNS = {
    "fact_daily_metric": ["date", "metric", "value", "record_count"],
    "dim_metric": ["metric", "label", "category", "unit", "daily_aggregation"],
    "dim_date": ["date", "year", "quarter", "month", "month_name", "week", "day_of_week", "is_weekend"],
}


def daily_metrics(records: pd.DataFrame) -> pd.DataFrame:
    """Aggregate records to one row per (date, metric)."""
    if records.empty:
        return pd.DataFrame(columns=PUBLIC_COLUMNS["fact_daily_metric"])

    frames = []
    for agg in ("sum", "mean"):
        keys = [k for k, m in METRIC_BY_KEY.items() if m.agg == agg]
        subset = records[records["metric"].isin(keys)]
        if subset.empty:
            continue
        grouped = (
            subset.groupby(["date", "metric"])["value"]
            .agg([agg, "count"])
            .rename(columns={agg: "value", "count": "record_count"})
            .reset_index()
        )
        frames.append(grouped)

    out = pd.concat(frames, ignore_index=True)
    out["value"] = out["value"].round(3)
    return out.sort_values(["date", "metric"]).reset_index(drop=True)[PUBLIC_COLUMNS["fact_daily_metric"]]


def dim_metric() -> pd.DataFrame:
    rows = [
        {"metric": m.key, "label": m.label, "category": m.category, "unit": m.unit, "daily_aggregation": m.agg}
        for m in METRICS.values()
    ]
    return pd.DataFrame(rows, columns=PUBLIC_COLUMNS["dim_metric"])


def dim_date(fact: pd.DataFrame) -> pd.DataFrame:
    if fact.empty:
        return pd.DataFrame(columns=PUBLIC_COLUMNS["dim_date"])
    dates = pd.date_range(min(fact["date"]), max(fact["date"]), freq="D")
    return pd.DataFrame(
        {
            "date": dates.date,
            "year": dates.year,
            "quarter": dates.quarter,
            "month": dates.month,
            "month_name": dates.strftime("%b"),
            "week": dates.isocalendar().week.to_numpy(),
            "day_of_week": dates.strftime("%a"),
            "is_weekend": dates.dayofweek >= 5,
        }
    )


def assert_public_safe(tables: dict[str, pd.DataFrame]) -> None:
    """Fail loudly if any table carries columns outside the allowlist."""
    for name, df in tables.items():
        allowed = PUBLIC_COLUMNS[name]
        extra = set(df.columns) - set(allowed)
        if extra:
            raise ValueError(f"{name} has non-public columns: {sorted(extra)}")
    unknown = set(tables["fact_daily_metric"]["metric"]) - set(METRIC_BY_KEY)
    if unknown:
        raise ValueError(f"fact_daily_metric has non-allowlisted metrics: {sorted(unknown)}")


def build_tables(records: pd.DataFrame) -> dict[str, pd.DataFrame]:
    fact = daily_metrics(records)
    tables = {"fact_daily_metric": fact, "dim_metric": dim_metric(), "dim_date": dim_date(fact)}
    assert_public_safe(tables)
    return tables


def portfolio_summary(tables: dict[str, pd.DataFrame], total_records: int, data_source: str) -> dict:
    """Small JSON summary the portfolio website renders."""
    fact = tables["fact_daily_metric"].copy()
    fact["month"] = pd.to_datetime(fact["date"]).dt.strftime("%Y-%m")

    def monthly(metric: str, digits: int) -> list[dict]:
        rows = fact[fact["metric"] == metric].groupby("month")["value"].mean().round(digits)
        return [{"month": m, "value": float(v)} for m, v in rows.items()]

    def overall(metric: str, digits: int) -> float | None:
        values = fact.loc[fact["metric"] == metric, "value"]
        return round(float(values.mean()), digits) if not values.empty else None

    dates = pd.to_datetime(fact["date"])
    return {
        "dataSource": data_source,
        "recordsProcessed": int(total_records),
        "metricsTracked": int(fact["metric"].nunique()),
        "daysCovered": int(fact["date"].nunique()),
        "firstMonth": dates.min().strftime("%Y-%m") if not fact.empty else None,
        "lastMonth": dates.max().strftime("%Y-%m") if not fact.empty else None,
        "kpis": {
            "avgDailySteps": overall("steps", 0),
            "avgRestingHeartRate": overall("resting_heart_rate", 1),
            "avgHrvSdnn": overall("hrv_sdnn", 1),
            "avgExerciseMinutes": overall("exercise_minutes", 1),
        },
        "monthly": {
            "steps": monthly("steps", 0),
            "restingHeartRate": monthly("resting_heart_rate", 1),
        },
    }


def write_outputs(tables: dict[str, pd.DataFrame], summary: dict, out_dir: str | Path) -> list[Path]:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for name, df in tables.items():
        path = out / f"{name}.csv"
        df.to_csv(path, index=False)
        written.append(path)
    summary_path = out / "portfolio_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n")
    written.append(summary_path)
    return written

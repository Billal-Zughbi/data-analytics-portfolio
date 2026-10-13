"""Cleaning rules and analysis on the daily table.

Input is ``data/original/daily_metrics.csv`` (one row per day, as the original
report stored it). Everything here is deterministic and runs in CI.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .catalog import BY_KEY, CATALOG

STEP_GOAL = 10_000
INCHES_PER_MILE = 63_360


def load_daily(path) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["date"])
    if df["date"].duplicated().any():
        raise ValueError("daily table must have one row per date")
    return df.sort_values("date").reset_index(drop=True)


def clean(raw: pd.DataFrame) -> tuple[pd.DataFrame, list[dict]]:
    """Blank out implausible days and unusable metrics; return the cleaned table and what was removed.

    Values are never clipped or replaced, only excluded, and every exclusion is listed.
    """
    df = raw.copy()
    removed: list[dict] = []
    for m in CATALOG:
        if m.key not in df:
            continue
        s = df[m.key]
        if m.kind == "summed_rate":
            for d, v in zip(df.loc[s.notna(), "date"], s.dropna()):
                removed.append({"metric": m.key, "date": d.date().isoformat(), "value": round(float(v), m.decimals),
                                "reason": "rate added up per day in the original query"})
            df[m.key] = np.nan
            continue
        bad = s.notna() & (((s < m.lo) if m.lo is not None else False) | ((s > m.hi) if m.hi is not None else False))
        for d, v in zip(df.loc[bad, "date"], s[bad]):
            removed.append({"metric": m.key, "date": d.date().isoformat(), "value": round(float(v), m.decimals),
                            "reason": f"outside the plausible daily range {m.lo:g} to {m.hi:g} {m.unit}"})
        df.loc[bad, m.key] = np.nan
    return df, removed


def watch_days(df: pd.DataFrame) -> pd.Series:
    """Days the watch was worn: it logged heart rate."""
    return df["heart_rate_bpm"].notna()


def _r(x, nd=1):
    if x is None or (isinstance(x, float) and (np.isnan(x) or np.isinf(x))):
        return None
    return round(float(x), nd)


def yearly(df: pd.DataFrame) -> list[dict]:
    rows = []
    d = df.set_index("date")
    for year, g in d.groupby(d.index.year):
        steps = g["steps"].dropna()
        if steps.empty and g["heart_rate_bpm"].dropna().empty:
            continue
        rows.append(
            {
                "year": int(year),
                "watch_days": int(g["heart_rate_bpm"].notna().sum()),
                "step_days": int(len(steps)),
                "steps_mean": _r(steps.mean(), 0),
                "steps_median": _r(steps.median(), 0),
                "steps_total": int(steps.sum()),
                "goal_share": _r((steps >= STEP_GOAL).mean(), 3),
                "exercise_mean": _r(g["exercise_min"].mean(), 1),
                "active_kcal_mean": _r(g["active_energy_kcal"].mean(), 0),
                "resting_hr": _r(g["resting_hr_bpm"].mean(), 1),
                "hrv": _r(g["hrv_sdnn_ms"].mean(), 1),
                "distance_mean": _r(g["distance_walk_run_mi"].mean(), 2),
            }
        )
    return rows


def weekday(df: pd.DataFrame) -> list[dict]:
    d = df.set_index("date")
    names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    g = d.groupby(d.index.dayofweek)
    return [
        {"day": names[i], "steps_mean": _r(g["steps"].mean()[i], 0), "steps_days": int(g["steps"].count()[i]),
         "exercise_mean": _r(g["exercise_min"].mean()[i], 1)}
        for i in range(7)
    ]


def months_of_year(df: pd.DataFrame) -> list[dict]:
    d = df.set_index("date")
    g = d.groupby(d.index.month)
    names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return [
        {"month": names[i - 1], "steps_mean": _r(g["steps"].mean().get(i), 0), "steps_days": int(g["steps"].count().get(i, 0)),
         "exercise_mean": _r(g["exercise_min"].mean().get(i), 1)}
        for i in range(1, 13)
    ]


def histogram(df: pd.DataFrame, width: int = 1000, top: int = 20000) -> list[dict]:
    steps = df["steps"].dropna()
    rows = []
    for lo in range(0, top, width):
        hi = lo + width
        mask = (steps >= lo) & (steps < hi) if hi < top else steps >= lo
        rows.append({"from": lo, "to": hi if hi < top else None, "days": int(mask.sum())})
    return rows


def distance_check(df: pd.DataFrame) -> dict:
    """Compare recorded distance with the distance the step count and step length imply.

    Steps came from the watch only, but the distance table was not filtered by
    device, so a walk logged by both the watch and the phone counts twice.
    """
    d = df.set_index("date")
    both = d[["steps", "distance_walk_run_mi"]].dropna()
    both = both[both["steps"] >= 1000]
    ratio = both["distance_walk_run_mi"] / both["steps"] * 1000
    step_len = d["step_length_in"].median()
    expected = step_len * 1000 / INCHES_PER_MILE
    monthly = (
        pd.DataFrame({"ratio": ratio})
        .groupby(ratio.index.to_period("M"))["ratio"]
        .agg(["median", "count"])
    )
    return {
        "median_step_length_in": _r(step_len, 1),
        "expected_mi_per_1000": _r(expected, 3),
        "recorded_mi_per_1000": _r(ratio.median(), 3),
        "ratio_to_expected": _r(ratio.median() / expected, 2),
        "days_compared": int(len(ratio)),
        "monthly": [
            {"month": str(p), "mi_per_1000": _r(r["median"], 3), "days": int(r["count"])}
            for p, r in monthly.iterrows()
            if r["count"] >= 10
        ],
    }


def fitness_trend(df: pd.DataFrame, min_days: int = 15) -> dict:
    """Monthly exercise against monthly resting heart rate and HRV, for months with enough data."""
    d = df.set_index("date")
    cols = ["exercise_min", "resting_hr_bpm", "hrv_sdnn_ms", "steps"]
    mean = d[cols].resample("MS").mean()
    count = d[cols].resample("MS").count()
    ok = (count["exercise_min"] >= min_days) & (count["resting_hr_bpm"] >= min_days)
    m = mean[ok]
    early = d.loc[: "2020-12-31"]
    later = d.loc["2023-01-01":]
    # Same watch before and after the change in routine: the first watch was used until August 2023.
    same_watch_before = d.loc["2019-01-01":"2019-12-31"]
    same_watch_after = d.loc["2023-01-01":"2023-08-19"]
    return {
        "months": int(len(m)),
        "r_exercise_resting_hr": _r(m["exercise_min"].corr(m["resting_hr_bpm"]), 2),
        "r_exercise_hrv": _r(m["exercise_min"].corr(m["hrv_sdnn_ms"]), 2),
        "r_steps_resting_hr": _r(m["steps"].corr(m["resting_hr_bpm"]), 2),
        "monthly": [
            {"month": p.strftime("%Y-%m"), "exercise_min": _r(r["exercise_min"], 1),
             "resting_hr": _r(r["resting_hr_bpm"], 1), "hrv": _r(r["hrv_sdnn_ms"], 1)}
            for p, r in m.iterrows()
        ],
        "periods": {
            "through_2020": {"exercise_min": _r(early["exercise_min"].mean()), "resting_hr": _r(early["resting_hr_bpm"].mean()),
                             "hrv": _r(early["hrv_sdnn_ms"].mean())},
            "from_2023": {"exercise_min": _r(later["exercise_min"].mean()), "resting_hr": _r(later["resting_hr_bpm"].mean()),
                          "hrv": _r(later["hrv_sdnn_ms"].mean())},
        },
        "same_watch": {
            "before": {"label": "2019", "exercise_min": _r(same_watch_before["exercise_min"].mean()),
                       "resting_hr": _r(same_watch_before["resting_hr_bpm"].mean())},
            "after": {"label": "Jan to Aug 2023", "exercise_min": _r(same_watch_after["exercise_min"].mean()),
                      "resting_hr": _r(same_watch_after["resting_hr_bpm"].mean())},
        },
    }


def _longest_run(mask: pd.Series) -> tuple[int, str | None]:
    best, run, end = 0, 0, None
    for date, ok in mask.items():
        run = run + 1 if ok else 0
        if run > best:
            best, end = run, date
    return best, (end.date().isoformat() if end is not None else None)


def records(df: pd.DataFrame) -> list[dict]:
    d = df.set_index("date")
    full = d.reindex(pd.date_range(d.index.min(), d.index.max(), freq="D"))
    out = []
    for key, label in (("steps", "Most steps in a day"), ("exercise_min", "Most exercise in a day"),
                       ("active_energy_kcal", "Most active energy in a day"), ("flights_climbed", "Most flights in a day")):
        s = d[key].dropna()
        out.append({"key": key, "label": label, "value": _r(s.max(), 0), "unit": BY_KEY[key].unit,
                    "date": s.idxmax().date().isoformat()})
    weeks = d["steps"].resample("W-SUN").agg(["sum", "count"])
    weeks = weeks[weeks["count"] == 7]
    out.append({"key": "steps_week", "label": "Most steps in a week", "value": int(weeks["sum"].max()), "unit": "steps",
                "date": (weeks["sum"].idxmax() - pd.Timedelta(days=6)).date().isoformat()})
    run, end = _longest_run(full["exercise_min"].fillna(0) >= 30)
    out.append({"key": "exercise_streak", "label": "Longest run of 30-minute exercise days", "value": run, "unit": "days",
                "date": end})
    closed = ((full["active_energy_kcal"].fillna(0) >= 500) & (full["exercise_min"].fillna(0) >= 30)
              & (full["stand_hours"].fillna(0) >= 12))
    run, end = _longest_run(closed)
    out.append({"key": "rings_streak", "label": "Longest run of days with all three rings closed", "value": run,
                "unit": "days", "date": end})
    run, end = _longest_run(full["steps"].fillna(0) >= STEP_GOAL)
    out.append({"key": "goal_streak", "label": "Longest run of 10,000-step days", "value": run, "unit": "days", "date": end})
    return out


def coverage(df: pd.DataFrame) -> list[dict]:
    rows = []
    for m in CATALOG:
        if m.key not in df or m.kind == "summed_rate":
            continue
        s = df.set_index("date")[m.key].dropna()
        if s.empty:
            continue
        rows.append({"metric": m.key, "label": m.label, "unit": m.unit, "group": m.group, "kind": m.kind,
                     "days": int(len(s)), "first": s.index.min().date().isoformat(), "last": s.index.max().date().isoformat()})
    return rows


def compare_sources(original: pd.DataFrame, fresh: pd.DataFrame, keys: list[str]) -> list[dict]:
    """Average of each metric on the days both the original report and the rebuild have a value."""
    o = original.set_index("date")
    f = fresh.set_index("date")
    rows = []
    for key in keys:
        if key not in o or key not in f:
            continue
        both = pd.concat([o[key], f[key]], axis=1, keys=["original", "rebuilt"], sort=True).dropna()
        if both.empty:
            continue
        rows.append(
            {
                "metric": key,
                "label": BY_KEY[key].label,
                "unit": BY_KEY[key].unit,
                "days": int(len(both)),
                "original": _r(both["original"].mean(), 2),
                "rebuilt": _r(both["rebuilt"].mean(), 2),
                "change_pct": _r((both["rebuilt"].mean() / both["original"].mean() - 1) * 100, 1),
                "same_day_share": _r(((both["rebuilt"] - both["original"]).abs() <= 0.005 * both["original"].abs().clip(lower=1)).mean(), 3),
            }
        )
    return rows


ACTIVITY_LABELS = {
    "TraditionalStrengthTraining": "Strength training",
    "FunctionalStrengthTraining": "Strength training",
    "CoreTraining": "Core training",
    "StairClimbing": "Stair climbing",
}


def workouts_summary(monthly: pd.DataFrame, top: int = 5) -> dict:
    w = monthly.copy()
    w["activity"] = w["activity"].map(lambda a: ACTIVITY_LABELS.get(a, re_words(a)))
    totals = (
        w.groupby("activity", as_index=False)[["workouts", "minutes", "active_kcal", "distance_mi"]].sum()
        .sort_values("workouts", ascending=False)
    )
    keep = totals["activity"].head(top).tolist()
    w["group"] = w["activity"].where(w["activity"].isin(keep), "Other")
    w["year"] = w["month"].str[:4].astype(int)
    by_year = w.pivot_table(index="year", columns="group", values="workouts", aggfunc="sum", fill_value=0)
    hours_year = w.groupby("year")["minutes"].sum() / 60
    return {
        "total": int(totals["workouts"].sum()),
        "hours": _r(totals["minutes"].sum() / 60, 0),
        "first_month": w["month"].min(),
        "groups": [*keep, "Other"],
        "by_activity": [
            {"activity": r.activity, "workouts": int(r.workouts), "hours": _r(r.minutes / 60, 1),
             "avg_minutes": _r(r.minutes / r.workouts, 0), "active_kcal": int(r.active_kcal), "distance_mi": _r(r.distance_mi, 1)}
            for r in totals.itertuples()
        ],
        "by_year": [
            {"year": int(y), "hours": _r(hours_year.get(y, 0), 0), **{g: int(by_year.loc[y].get(g, 0)) for g in [*keep, "Other"]}}
            for y in by_year.index
        ],
    }


def re_words(name: str) -> str:
    import re

    words = re.sub(r"(?<!^)(?=[A-Z])", " ", name).lower()
    return words[:1].upper() + words[1:]

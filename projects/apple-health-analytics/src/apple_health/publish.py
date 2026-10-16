"""Build every public output from the committed daily tables.

Inputs (committed)
    data/original/   the original Power BI report: its daily tables, model and card values
    data/daily/      the rebuild from a fresh export.xml: daily metrics, monthly workouts, source profile
Outputs
    website JSON, Power BI star schema (data/model/), outputs/data_quality.json

Published values are daily or coarser. No device names, times of day or
record-level data exist in the inputs, so none can reach the outputs.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from . import analysis as an
from .catalog import BY_KEY, BY_TABLE, CATALOG
from .report_sim import reproduce_cards

# Metrics published day by day for the interactive report. Each is stored from its
# first day with data; sparse ones (a few hundred readings) as [day index, value] pairs.
DAILY_SERIES = (
    "steps", "active_energy_kcal", "exercise_min", "stand_min", "stand_hours", "flights_climbed",
    "heart_rate_bpm", "resting_hr_bpm", "walking_hr_bpm", "hrv_sdnn_ms", "vo2max",
    "distance_walk_run_mi", "distance_cycling_mi", "walking_speed_mph", "step_length_in",
    "six_minute_walk_m", "running_speed_mph", "running_stride_m",
    "physical_effort", "env_audio_dba", "headphone_audio_dba", "time_in_daylight_min",
)
SPARSE_BELOW = 400

# Which rebuilt metric answers each original card's question.
REBUILT_FOR = {"headphone_min_dba": "headphone_audio_dba"}


def _r(x, nd=1):
    return an._r(x, nd)


def _date(s: str) -> str:
    return pd.Timestamp(s).strftime("%b %-d, %Y")


def _signed(x: float) -> str:
    """A number with a typographic minus sign, for correlations shown as text."""
    return f"{x}".replace("-", "\u2212")


def _times(ratio: float) -> str:
    return "about twice" if round(ratio, 1) == 2.0 else f"about {ratio:.1f} times"


def _export_note(key: str, cmp: dict) -> str:
    """Why a card's rebuilt value differs when no rule in the old report explains it."""
    c = cmp.get(key)
    if key == "steps":
        return ("The old Steps table kept only watch records. The rebuild also counts hours when only the phone was "
                "recording, so totals run a little higher.")
    if key == "flights_climbed":
        return ("The old Flights table added the watch and the phone together, so a flight both devices noticed counted "
                "twice. The rebuild keeps one device per hour.")
    if key == "active_energy_kcal" and c:
        return (f"The two exports agree on average across the {c['days']:,} days they share ({c['original']:,.0f} against "
                f"{c['rebuilt']:,.0f} kcal a day), but not day by day, and for these months the March 2025 export has more active energy.")
    if key == "distance_cycling_mi":
        return ("The October 2026 export holds more cycling on a few of these days than the March 2025 export did. "
                "The daily rule is the same sum in both.")
    return "The rebuilt value comes from the October 2026 export, with one device per hour."


def card_notes(row: dict, model: dict, raw: pd.DataFrame, rebuilt: pd.DataFrame, comparison: list[dict]) -> dict:
    """What a card should have shown for its page's dates, and why it differs."""
    page = next(p for p in model["pages"] if p["name"] == row["page"])
    window = page["slicer"]["window"]
    metric = BY_KEY[row["metric"]]
    key = REBUILT_FOR.get(metric.key, metric.key)
    s = rebuilt.set_index("date")[key].dropna()
    in_window = s[(s.index >= window["start"]) & (s.index < window["end_exclusive"])]
    agg = {"sum": in_window.sum, "average": in_window.mean, "min": in_window.min, "max": in_window.max}[row["aggregation"]]
    corrected = float(agg()) if len(in_window) else None
    unit = metric.unit
    notes = []
    if not row["slicer_reached"] and not row["own_filter"]:
        span = raw.set_index("date")[metric.key].dropna()
        notes.append(
            f"The page's date filter never reached this card, because the relationship it depends on is inactive. "
            f"It showed the all-time value ({_date(str(span.index.min().date()))} to {_date(str(span.index.max().date()))}) "
            "instead of the value for the page's selected dates."
        )
    elif row["slicer_reached"] and row["metric"] != BY_TABLE[page["slicer"]["table"]].key:
        slicer_metric = BY_TABLE[page["slicer"]["table"]]
        r = raw.set_index("date")[metric.key].dropna()
        own = int(((r.index >= window["start"]) & (r.index < window["end_exclusive"])).sum())
        if row["days"] < own:
            notes.append(
                f"The filter reached this card through the {slicer_metric.label.lower()} table, so only days that also had "
                f"{slicer_metric.label.lower()} data counted ({row['days']} of {own} days)."
            )
    if metric.key == "stand_min":
        corrected = corrected / 60 if corrected is not None else None
        unit = "hours"
        notes.append(
            f"Labeled hours, but the column holds minutes: {row['rebuilt']:.0f} minutes is {row['rebuilt'] / 60:.1f} hours. "
            "The model had a StandHours measure that divides by 60, but the card did not use it."
        )
        sh = rebuilt.set_index("date")["stand_hours"].dropna()
        sh = sh[(sh.index >= window["start"]) & (sh.index < window["end_exclusive"])]
        if len(sh):
            notes.append(
                f"The rebuilt page shows the watch's stand hours instead (hours with at least a minute of standing): "
                f"{sh.mean():.1f} a day for these dates."
            )
    if metric.key == "heart_rate_bpm":
        notes.append("Labeled active heart rate, but it is the average of every heart-rate reading in the day, resting included.")
    if metric.key == "headphone_min_dba":
        notes.append(
            "Power Query kept each day's quietest headphone reading (List.Min). The rebuilt value uses each day's "
            "energy-averaged listening level instead."
        )
    if metric.key == "env_audio_dba":
        notes.append("Decibels were averaged arithmetically. The rebuilt value averages sound energy, which reads several dB higher.")
    if metric.kind == "estimate" and row["aggregation"] in ("min", "max") and len(in_window):
        notes.append(f"Within the page's dates the range was {in_window.min():.2f} to {in_window.max():.2f}.")
    if corrected is None:
        notes.append("No readings fall inside the page's dates, so there is no value for that window.")
    elif not notes and abs(corrected - row["rebuilt"]) > 0.02 * abs(row["rebuilt"]):
        notes.append(_export_note(metric.key, {c["metric"]: c for c in comparison}))
    short = {
        "active_energy_kcal": "The two exports differ day by day for these months, though their long-run averages match.",
        "distance_cycling_mi": "The newer export holds more cycling on a few of these days.",
    }
    hint = None
    if notes:
        hint = notes[0].split(". ")[0].rstrip(".") + "."
        if metric.key in short and notes[0] == _export_note(metric.key, {c["metric"]: c for c in comparison}):
            hint = short[metric.key]
    return {"corrected": _r(corrected, 2), "corrected_unit": unit, "window": window, "notes": notes, "hint": hint}


def daily_payload(cleaned: pd.DataFrame) -> dict:
    d = cleaned.set_index("date")
    full = pd.date_range(d.index.min(), d.index.max(), freq="D")
    d = d.reindex(full)
    dense, sparse = {}, {}
    for key in DAILY_SERIES:
        if key not in d:
            continue
        m = BY_KEY[key]
        s = d[key].round(m.decimals)
        values = [None if pd.isna(v) else (int(v) if m.decimals == 0 else float(v)) for v in s]
        present = [i for i, v in enumerate(values) if v is not None]
        if not present:
            continue
        if len(present) < SPARSE_BELOW:
            sparse[key] = [[i, values[i]] for i in present]
        else:
            first, last = present[0], present[-1]
            dense[key] = {"offset": first, "values": values[first : last + 1]}
    return {"start": full[0].date().isoformat(), "end": full[-1].date().isoformat(), "days": len(full),
            "dense": dense, "sparse": sparse}


def model_findings(model: dict) -> dict:
    rels = model["relationships"]
    date_rels = [r for r in rels if r["from_column"] == "creation date"]
    value_rels = [r for r in rels if r["from_column"] == "value"]
    return {
        "tables": sum(1 for t in model["tables"] if t["metric"]),
        "relationships": len(rels),
        "date_relationships": len(date_rels),
        "inactive": [f"{r['from_table']} → {r['to_table']}" for r in date_rels if not r["active"]],
        "two_way_one_to_one": sum(1 for r in date_rels if r["cardinality"] == "1:1" and r["cross_filter"] == "Both"),
        "value_joins": [f"{r['from_table']}[value] → {r['to_table']}[value]" for r in value_rels],
        "hubs": sorted({r["from_table"] for r in date_rels}),
        "device_filtered": [BY_TABLE[t["table"]].label for t in model["tables"] if t.get("device_filter") and t["metric"]],
        "rules": {t["metric"]: t["daily_rule"] for t in model["tables"] if t["metric"]},
        "measures": model["measures"],
    }


def findings(cards, dist_original, dist_rebuilt, fit, years, removed_original, comparison, profile, workouts) -> list[dict]:
    stand = next(c for c in cards if c["metric"] == "stand_min")
    walking = next(c for c in cards if c["metric"] == "walking_speed_mph")
    power = [r for r in removed_original if r["metric"] == "running_power_sum_w"]
    cmp = {c["metric"]: c for c in comparison}
    steps_dedup = profile["dedup_effect"]["steps"]
    env = cmp.get("env_audio_dba")
    flagged = sum(1 for c in cards if c["notes"])
    return [
        {
            "id": "cards",
            "title": f"All {len(cards)} numbers on the original report reproduce, and {flagged} needed a fix or a caveat",
            "summary": (
                "Recomputing each card from the report's own tables matches every number it showed. Following the model's "
                "relationships explains the odd ones: the Mobility page's date slicer sat on the cycling table, whose links to "
                f"walking speed and step length were inactive, so those cards showed all-time averages. Walking speed read "
                f"{walking['shown']} mph; for the page's own dates ({_date(walking['window']['start'])} to "
                f"{_date(str((pd.Timestamp(walking['window']['end_exclusive']) - pd.Timedelta(days=1)).date()))}) it was "
                f"{walking['corrected']:.2f}. The stand card "
                f"read {stand['shown']} \"hours\", which is {stand['corrected']:.1f} hours of standing."
            ),
            "metric": "Each card was recomputed in pandas from the aggregation, filters and relationships stored in the report layout and data model.",
            "caveat": "The displayed values were transcribed from the March 2025 report screenshots; the tolerance is the precision each card showed.",
        },
        {
            "id": "distance",
            "title": f"The original report counted walking distance {_times(dist_original['ratio_to_expected'])}",
            "summary": (
                f"Steps were filtered to the watch, but distance kept every device, so a walk logged by both the watch and the "
                f"phone counted twice. At a median step length of {dist_rebuilt['median_step_length_in']} inches, 1,000 steps cover "
                f"about {dist_rebuilt['expected_mi_per_1000']:.2f} miles. The original table recorded "
                f"{dist_original['recorded_mi_per_1000']:.2f}; the rebuild, which keeps one device per hour, records "
                f"{dist_rebuilt['recorded_mi_per_1000']:.2f}."
            ),
            "metric": "Median of daily miles ÷ steps × 1,000 on days with at least 1,000 steps, against step length × 1,000 ÷ 63,360.",
            "caveat": "Step length comes from the phone's walking metrics, which start in late 2020; the median is applied to every year.",
        },
        {
            "id": "dedup",
            "title": f"Keeping one device per hour removes about {round((1 - steps_dedup['avg_with_dedup'] / steps_dedup['avg_without_dedup']) * 100)}% of raw steps",
            "summary": (
                f"Adding up every step record in the export gives {steps_dedup['avg_without_dedup']:,.0f} steps a day. Keeping one "
                f"device per hour (the watch when it was worn, the phone otherwise) gives {steps_dedup['avg_with_dedup']:,.0f}. "
                "Unlike the original report, phone-only hours still count, so days without the watch are no longer blank."
            ),
            "metric": "Daily sums with and without the de-duplication step, over every day in the export.",
            "caveat": "Health's own merge works on finer intervals than an hour, so daily totals can differ slightly from the Health app.",
        },
        {
            "id": "fitness",
            "title": f"More exercise went with a lower resting heart rate (r = {_signed(fit['r_exercise_resting_hr'])})",
            "summary": (
                f"Across {fit['months']} months with at least 15 days of data, months with more exercise had a lower resting heart "
                f"rate and higher heart rate variability (r = {_signed(fit['r_exercise_hrv'])}). Through 2020 the average was "
                f"{fit['periods']['through_2020']['exercise_min']:.0f} exercise minutes a day and a resting heart rate of "
                f"{fit['periods']['through_2020']['resting_hr']:.0f} bpm; from 2023 it was "
                f"{fit['periods']['from_2023']['exercise_min']:.0f} minutes and {fit['periods']['from_2023']['resting_hr']:.0f} bpm, "
                f"with {sum(sum(v for k, v in y.items() if k in workouts['groups']) for y in workouts['by_year'] if y['year'] >= 2023):,} "
                "workouts logged since the start of 2023."
            ),
            "metric": "Pearson correlation of monthly means. The drop shows on the same watch too: "
            f"{fit['same_watch']['before']['resting_hr']} bpm in 2019 against {fit['same_watch']['after']['resting_hr']} bpm in January to August 2023.",
            "caveat": (
                "It's a correlation across months, so it can't show that more exercise caused the drop. "
                "Sleep and stress affect resting heart rate too, and so does the time of year."
            ),
        },
        {
            "id": "rates",
            "title": "Three daily rules in the original query were wrong for their metric",
            "summary": (
                f"Running power was summed per day, giving totals such as {max(r['value'] for r in power):,.0f} W. Headphone exposure "
                "kept each day's quietest reading, with nine tiny values hard-coded out. Environmental sound was averaged "
                f"arithmetically, which understates decibels: on the same {env['days'] if env else 0} days the energy average is "
                f"{(env['rebuilt'] - env['original']) if env else 0:.1f} dB higher."
            ),
            "metric": "Each table's daily rule was read from its Power Query step (List.Sum, List.Min, List.Average) and compared with the rebuild's rule.",
            "caveat": "Each rebuilt rule is documented in metrics.py and covered by a test on a hand-written fixture.",
        },
    ]


def quality_checks(cards, removed, profile, model_info, payload) -> list[dict]:
    checks = profile["checks"]
    metrics_removed = sorted({r["metric"] for r in removed})
    return [
        {"name": "original_cards_reproduced", "result": "pass" if all(c["matches"] for c in cards) else "fail",
         "detail": f"{sum(c['matches'] for c in cards)} of {len(cards)} card values match what the original report displayed."},
        {"name": "records_read", "result": "pass",
         "detail": f"{profile['records_total']:,} records from {_date(profile['date_range']['start'])} to {_date(profile['date_range']['end'])}; {profile['unparseable_records']} could not be parsed."},
        {"name": "exact_duplicates_removed", "result": "pass" if checks["exact_duplicates"] == 0 else "info",
         "detail": f"{checks['exact_duplicates']} records repeated type, device, interval and value exactly and were dropped."},
        {"name": "device_overlap_removed", "result": "info",
         "detail": f"{checks['overlap_records_removed']:,} step, distance, flight and energy records overlapped a higher-priority device in the same hour."},
        {"name": "units_converted", "result": "pass" if checks["unit_rejected"] == 0 else "warn",
         "detail": f"{checks['unit_rejected']} records had a unit with no known conversion."},
        {"name": "record_out_of_range", "result": "info", "detail": f"{checks['out_of_range']} single records fell outside the plausible range and were excluded."},
        {"name": "implausible_days_excluded", "result": "warn",
         "detail": f"{len(removed)} daily values across {len(metrics_removed)} metrics fell outside a plausible daily range and were excluded, not changed."},
        {"name": "inactive_relationships", "result": "info",
         "detail": f"{len(model_info['inactive'])} date relationships in the original model were inactive, so some cards ignored the date slicer."},
        {"name": "no_device_names_or_times", "result": "pass", "detail": "Published files hold dates and daily values only."},
        {"name": "series_aligned", "result": "pass",
         "detail": f"Daily series share one calendar of {payload['days']:,} days from {_date(payload['start'])} to {_date(payload['end'])}."},
    ]


def write_model_tables(cleaned: pd.DataFrame, out_dir: Path) -> list[Path]:
    """Star schema for the Power BI rebuild: fact_daily_metric, dim_metric, dim_date."""
    out_dir.mkdir(parents=True, exist_ok=True)
    keys = [m.key for m in CATALOG if m.key in cleaned and m.kind != "summed_rate"]
    fact = cleaned.melt(id_vars="date", value_vars=keys, var_name="metric", value_name="value").dropna(subset=["value"])
    fact = fact.sort_values(["date", "metric"])
    fact["date"] = fact["date"].dt.strftime("%Y-%m-%d")
    fact["value"] = fact["value"].round(3)
    dim_metric = pd.DataFrame(
        [{"metric": m.key, "label": m.label, "group": m.group, "unit": m.unit, "kind": m.kind,
          "plausible_min": m.lo, "plausible_max": m.hi} for m in CATALOG if m.key in keys]
    )
    dates = pd.date_range(cleaned["date"].min(), cleaned["date"].max(), freq="D")
    dim_date = pd.DataFrame(
        {
            "date": dates.strftime("%Y-%m-%d"), "year": dates.year, "quarter": dates.quarter, "month": dates.month,
            "month_name": dates.strftime("%b"), "week_start": (dates - pd.to_timedelta(dates.dayofweek, unit="D")).strftime("%Y-%m-%d"),
            "day_of_week": dates.dayofweek + 1, "day_name": dates.strftime("%a"), "is_weekend": dates.dayofweek >= 5,
        }
    )
    paths = []
    for name, frame in (("fact_daily_metric", fact), ("dim_metric", dim_metric), ("dim_date", dim_date)):
        p = out_dir / f"{name}.csv"
        frame.to_csv(p, index=False)
        paths.append(p)
    return paths


def build(original_dir: Path, daily_dir: Path, site_dir: Path, model_dir: Path, outputs_dir: Path) -> list[Path]:
    raw = an.load_daily(original_dir / "daily_metrics.csv")
    model = json.loads((original_dir / "report_model.json").read_text(encoding="utf-8"))
    shown = pd.read_csv(original_dir / "report_cards_displayed.csv")
    original_clean, removed_original = an.clean(raw)

    fresh = an.load_daily(daily_dir / "daily_metrics.csv")
    profile = json.loads((daily_dir / "source_profile.json").read_text(encoding="utf-8"))
    workouts_monthly = pd.read_csv(daily_dir / "workouts_monthly.csv")
    cleaned, removed = an.clean(fresh)

    comparison = an.compare_sources(
        raw, cleaned,
        ["steps", "distance_walk_run_mi", "flights_climbed", "active_energy_kcal", "exercise_min", "stand_min",
         "heart_rate_bpm", "resting_hr_bpm", "hrv_sdnn_ms", "vo2max", "walking_speed_mph", "env_audio_dba", "physical_effort"],
    )
    cards = reproduce_cards(raw, model, shown)
    for c in cards:
        c.update(card_notes(c, model, raw, cleaned, comparison))
        c["rebuilt"] = _r(c["rebuilt"], 4)

    payload = daily_payload(cleaned)
    years = an.yearly(cleaned)
    dist_original = an.distance_check(original_clean)
    dist_rebuilt = an.distance_check(cleaned)
    fit = an.fitness_trend(cleaned)
    model_info = model_findings(model)
    workouts = an.workouts_summary(workouts_monthly)
    steps = cleaned["steps"].dropna()
    watch = an.watch_days(cleaned)

    summary = {
        "source": {
            "name": "Billal's Apple Health export, October 2026, and his March 2025 Power BI report",
            "first_day": cleaned["date"].min().date().isoformat(),
            "watch_start": cleaned.loc[watch, "date"].min().date().isoformat(),
            "last_day": cleaned["date"].max().date().isoformat(),
            "records": profile["records_total"],
            "report_first_day": raw["date"].min().date().isoformat(),
            "report_last_day": raw["date"].max().date().isoformat(),
        },
        "headline": {
            "watch_days": int(watch.sum()),
            "step_days": int(len(steps)),
            "steps_total": int(steps.sum()),
            "steps_mean": _r(steps.mean(), 0),
            "steps_median": _r(steps.median(), 0),
            "goal_share": _r((steps >= an.STEP_GOAL).mean(), 3),
            "years": int(cleaned.loc[steps.index, "date"].dt.year.nunique()),
            "metrics": len(an.coverage(cleaned)),
            "workouts": workouts["total"],
            "records": profile["records_total"],
        },
        "coverage": an.coverage(cleaned),
        "cards": cards,
        "comparison": comparison,
        "findings": findings(cards, dist_original, dist_rebuilt, fit, years, removed_original, comparison, profile, workouts),
        "quality": {"checks": quality_checks(cards, removed, profile, model_info, payload), "excluded": removed},
        "yearly": years,
        "weekday": an.weekday(cleaned[cleaned["date"] >= cleaned.loc[watch, "date"].min()]),
        "months": an.months_of_year(cleaned[cleaned["date"] >= cleaned.loc[watch, "date"].min()]),
        "histogram": an.histogram(cleaned),
        "distance_check": {"original": dist_original, "rebuilt": dist_rebuilt},
        "dedup_effect": profile["dedup_effect"],
        "fitness": fit,
        "records": an.records(cleaned),
        "workouts": workouts,
        "model": model_info,
        "metrics": [
            {"key": m.key, "label": m.label, "unit": m.unit, "group": m.group, "kind": m.kind, "decimals": m.decimals}
            for m in CATALOG if m.key in DAILY_SERIES
        ],
    }

    site_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for path, obj, indent in ((site_dir / "summary.json", summary, 1), (site_dir / "daily.json", payload, None)):
        text = json.dumps(obj, indent=indent, ensure_ascii=False, separators=None if indent else (",", ":"))
        path.write_text(text + "\n", encoding="utf-8")
        written.append(path)
    quality = {
        "checks": summary["quality"]["checks"],
        "excluded_rebuilt": removed,
        "excluded_original": removed_original,
        "coverage": summary["coverage"],
        "comparison": comparison,
        "cards": [{k: c[k] for k in ("page", "label", "shown", "rebuilt", "matches", "days")} for c in cards],
    }
    qpath = outputs_dir / "data_quality.json"
    qpath.write_text(json.dumps(quality, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    written.append(qpath)
    written += write_model_tables(cleaned, model_dir)
    return written

"""Daily metric catalog: what each column of the daily table means and how it may be used.

The original Power BI report holds one table per Apple Health record type, already
reduced to one row per day by its Power Query steps. This catalog maps each of
those tables to a metric key and records, per metric:

kind        how a day's value was formed and therefore how days may be combined
            total      additive amount for the day (steps, kcal, minutes)
            average    mean of the day's readings (heart rate, walking speed)
            estimate   sparse device estimate (VO2 max, six-minute walk)
            level_db   mean sound level for the day in dB
            minimum_db the day's quietest reading in dB (how the original query stored it)
            summed_rate a rate that the original query added up per day; not usable
lo, hi      plausible range for one day's value. Days outside it are excluded from
            every chart and KPI and listed in the data-quality report.
decimals    rounding used for published values
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Kind = Literal["total", "average", "estimate", "level_db", "minimum_db", "summed_rate"]
Group = Literal["activity", "cardio", "mobility", "environment"]


@dataclass(frozen=True)
class DailyMetric:
    key: str
    table: str | None  # table in the original .pbix, or None when only the XML pipeline produces it
    label: str
    unit: str
    group: Group
    kind: Kind
    lo: float | None
    hi: float | None
    decimals: int
    scale: float = 1.0  # multiplier applied on ingest (fractions to percent)


CATALOG: tuple[DailyMetric, ...] = (
    # Energy and activity
    DailyMetric("steps", "Step Count", "Steps", "steps", "activity", "total", 0, 60000, 0),
    DailyMetric("active_energy_kcal", "Active Energy Burned", "Active energy", "kcal", "activity", "total", 0, 4000, 0),
    DailyMetric("basal_energy_kcal", "Basal Energy Burned", "Resting energy", "kcal", "activity", "total", 0, 3000, 0),
    DailyMetric("exercise_min", "Exercise Time", "Exercise", "min", "activity", "total", 0, 600, 0),
    DailyMetric("stand_min", "Stand Time", "Stand time", "min", "activity", "total", 0, 1080, 0),
    DailyMetric("stand_hours", None, "Stand hours", "hours", "activity", "total", 0, 24, 0),
    DailyMetric("flights_climbed", "Flights Climbed", "Flights climbed", "flights", "activity", "total", 0, 150, 0),
    # Cardiovascular
    DailyMetric("heart_rate_bpm", "Heart Rate", "Average heart rate", "bpm", "cardio", "average", 40, 150, 1),
    DailyMetric("resting_hr_bpm", "Resting Heart Rate", "Resting heart rate", "bpm", "cardio", "average", 35, 110, 1),
    DailyMetric("walking_hr_bpm", "Walking Heart Rate Average", "Walking heart rate", "bpm", "cardio", "average", 50, 180, 1),
    DailyMetric("hrv_sdnn_ms", "Heart Rate Variability SDNN", "Heart rate variability (SDNN)", "ms", "cardio", "average", 5, 200, 1),
    DailyMetric("vo2max", "VO2 Max", "VO2 max", "mL/kg·min", "cardio", "estimate", 15, 75, 2),
    # Mobility and movement
    DailyMetric("distance_walk_run_mi", "Distance Walking Running", "Walking and running distance", "mi", "mobility", "total", 0, 40, 2),
    DailyMetric("distance_cycling_mi", "Distance Cycling", "Cycling distance", "mi", "mobility", "total", 0, 150, 2),
    DailyMetric("walking_speed_mph", "Walking Speed", "Walking speed", "mph", "mobility", "average", 0.5, 5, 2),
    DailyMetric("step_length_in", "Walking Step Length", "Step length", "in", "mobility", "average", 10, 45, 1),
    DailyMetric("walking_asymmetry_pct", "Walking Asymmetry Percentage", "Walking asymmetry", "%", "mobility", "average", 0, 100, 2, 100.0),
    DailyMetric("double_support_pct", "Walking Double Support Percentage", "Double support time", "%", "mobility", "average", 10, 50, 1, 100.0),
    DailyMetric("six_minute_walk_m", "Six Minute Walk Test Distance", "Six-minute walk distance", "m", "mobility", "estimate", 100, 1000, 0),
    DailyMetric("stair_ascent_ftps", "Stair Ascent Speed", "Stair ascent speed", "ft/s", "mobility", "average", 0.2, 5, 2),
    DailyMetric("stair_descent_ftps", "Stair Descent Speed", "Stair descent speed", "ft/s", "mobility", "average", 0.2, 5, 2),
    DailyMetric("running_speed_mph", "Running Speed", "Running speed", "mph", "mobility", "average", 2, 20, 2),
    DailyMetric("running_stride_m", "Running Stride Length", "Running stride length", "m", "mobility", "average", 0.3, 2.5, 2),
    DailyMetric("running_gct_ms", "Running Ground Contact Time", "Ground contact time", "ms", "mobility", "average", 150, 500, 0),
    DailyMetric("running_vo_cm", "Running Vertical Oscillation", "Vertical oscillation", "cm", "mobility", "average", 3, 20, 1),
    DailyMetric("running_power_sum_w", "Running Power", "Running power (summed)", "W", "mobility", "summed_rate", None, None, 0),
    DailyMetric("running_power_w", None, "Running power", "W", "mobility", "average", 20, 2000, 0),
    # Physical and environmental
    DailyMetric("physical_effort", "Physical Effort", "Physical effort", "kcal/hr·kg", "environment", "average", 0.5, 30, 2),
    DailyMetric("env_audio_dba", "Environmental Audio Exposure", "Environmental sound level", "dBA", "environment", "level_db", 20, 130, 1),
    DailyMetric("headphone_min_dba", "Headphone Audio Exposure", "Quietest headphone reading", "dBA", "environment", "minimum_db", 0, 130, 1),
    DailyMetric("headphone_audio_dba", None, "Headphone audio level", "dBA", "environment", "level_db", 20, 130, 1),
    DailyMetric("time_in_daylight_min", None, "Time in daylight", "min", "environment", "total", 0, 1080, 0),
)

BY_KEY: dict[str, DailyMetric] = {m.key: m for m in CATALOG}
BY_TABLE: dict[str, DailyMetric] = {m.table: m for m in CATALOG if m.table}

# Tables in the original model that are left out, and why.
SKIPPED_TABLES: dict[str, str] = {
    "Respiratory Rate": "Not grouped by day in the original query (one row per reading with a time) and not on any report page.",
}

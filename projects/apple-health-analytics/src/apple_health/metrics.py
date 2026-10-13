"""Metric registry: one place that says what each Apple Health record type means.

The original Power BI report relied on implicit aggregations chosen per visual
(for example ``Sum`` of resting heart rate on a date axis). This registry makes
the aggregation rule part of the data contract instead, so every downstream
layer (pandas, Power BI, website) uses the same definition.

Aggregation rules
-----------------
sum          Additive quantities (steps, energy, distance). Overlapping records
             from several devices are de-duplicated before summing; see
             ``transform.dedupe_additive``.
mean         Point-in-time or rate readings (heart rate, walking speed). The
             daily value is the mean of that day's samples.
energy_mean  Sound levels in dB. Decibels are logarithmic, so the daily value is
             a duration-weighted energy average: 10*log10(sum(w*10^(L/10))/sum(w)).
last         Sparse estimates (VO2 max). The daily value is the day's last reading.
stood_hours  Apple Stand Hour category records. The daily value is the number of
             distinct hours whose value is ``HKCategoryValueAppleStandHourStood``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Aggregation = Literal["sum", "mean", "energy_mean", "last", "stood_hours"]
Group = Literal["activity", "cardio", "mobility", "environment"]


@dataclass(frozen=True)
class Metric:
    key: str
    hk_type: str
    label: str
    unit: str
    aggregation: Aggregation
    group: Group
    # Plausible range for a single record, used by data-quality checks only.
    # Values outside the range are flagged, never silently dropped.
    record_min: float | None = None
    record_max: float | None = None


STAND_HOUR_STOOD = "HKCategoryValueAppleStandHourStood"

METRICS: tuple[Metric, ...] = (
    # Energy and activity
    Metric("active_energy_kcal", "HKQuantityTypeIdentifierActiveEnergyBurned",
           "Active energy", "kcal", "sum", "activity", 0, 3000),
    Metric("exercise_min", "HKQuantityTypeIdentifierAppleExerciseTime",
           "Exercise time", "min", "sum", "activity", 0, 1440),
    Metric("stand_hours", "HKCategoryTypeIdentifierAppleStandHour",
           "Stand hours", "hours", "stood_hours", "activity"),
    Metric("flights_climbed", "HKQuantityTypeIdentifierFlightsClimbed",
           "Flights climbed", "count", "sum", "activity", 0, 200),
    # Cardiovascular
    Metric("heart_rate_bpm", "HKQuantityTypeIdentifierHeartRate",
           "Heart rate", "count/min", "mean", "cardio", 25, 230),
    Metric("resting_hr_bpm", "HKQuantityTypeIdentifierRestingHeartRate",
           "Resting heart rate", "count/min", "mean", "cardio", 30, 120),
    Metric("walking_hr_bpm", "HKQuantityTypeIdentifierWalkingHeartRateAverage",
           "Walking heart rate average", "count/min", "mean", "cardio", 40, 200),
    Metric("hrv_sdnn_ms", "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
           "Heart rate variability (SDNN)", "ms", "mean", "cardio", 1, 300),
    Metric("vo2max", "HKQuantityTypeIdentifierVO2Max",
           "VO2 max estimate", "mL/min·kg", "last", "cardio", 10, 90),
    # Mobility
    Metric("steps", "HKQuantityTypeIdentifierStepCount",
           "Steps", "count", "sum", "mobility", 0, 20000),
    Metric("distance_walk_run_mi", "HKQuantityTypeIdentifierDistanceWalkingRunning",
           "Walking + running distance", "mi", "sum", "mobility", 0, 50),
    Metric("walking_speed_mph", "HKQuantityTypeIdentifierWalkingSpeed",
           "Walking speed", "mi/hr", "mean", "mobility", 0.1, 10),
    Metric("step_length_in", "HKQuantityTypeIdentifierWalkingStepLength",
           "Walking step length", "in", "mean", "mobility", 5, 50),
    # Physical and environmental
    Metric("env_audio_dba", "HKQuantityTypeIdentifierEnvironmentalAudioExposure",
           "Environmental sound level", "dBASPL", "energy_mean", "environment", 0, 140),
    Metric("headphone_audio_dba", "HKQuantityTypeIdentifierHeadphoneAudioExposure",
           "Headphone audio level", "dBASPL", "energy_mean", "environment", 0, 140),
    Metric("physical_effort", "HKQuantityTypeIdentifierPhysicalEffort",
           "Physical effort", "kcal/hr·kg", "mean", "environment", 0, 30),
    # Added for the full rebuild of the original report (every table it used)
    Metric("basal_energy_kcal", "HKQuantityTypeIdentifierBasalEnergyBurned",
           "Resting energy", "kcal", "sum", "activity", 0, 3000),
    Metric("stand_min", "HKQuantityTypeIdentifierAppleStandTime",
           "Stand time", "min", "sum", "activity", 0, 60),
    Metric("time_in_daylight_min", "HKQuantityTypeIdentifierTimeInDaylight",
           "Time in daylight", "min", "sum", "environment", 0, 1440),
    Metric("distance_cycling_mi", "HKQuantityTypeIdentifierDistanceCycling",
           "Cycling distance", "mi", "sum", "mobility", 0, 100),
    Metric("walking_asymmetry_pct", "HKQuantityTypeIdentifierWalkingAsymmetryPercentage",
           "Walking asymmetry", "pct", "mean", "mobility", 0, 100),
    Metric("double_support_pct", "HKQuantityTypeIdentifierWalkingDoubleSupportPercentage",
           "Double support time", "pct", "mean", "mobility", 0, 100),
    Metric("six_minute_walk_m", "HKQuantityTypeIdentifierSixMinuteWalkTestDistance",
           "Six-minute walk distance", "m", "last", "mobility", 50, 1200),
    Metric("stair_ascent_ftps", "HKQuantityTypeIdentifierStairAscentSpeed",
           "Stair ascent speed", "ft/s", "mean", "mobility", 0.05, 10),
    Metric("stair_descent_ftps", "HKQuantityTypeIdentifierStairDescentSpeed",
           "Stair descent speed", "ft/s", "mean", "mobility", 0.05, 10),
    Metric("running_speed_mph", "HKQuantityTypeIdentifierRunningSpeed",
           "Running speed", "mi/hr", "mean", "mobility", 1, 25),
    Metric("running_stride_m", "HKQuantityTypeIdentifierRunningStrideLength",
           "Running stride length", "m", "mean", "mobility", 0.2, 3),
    Metric("running_gct_ms", "HKQuantityTypeIdentifierRunningGroundContactTime",
           "Ground contact time", "ms", "mean", "mobility", 100, 600),
    Metric("running_vo_cm", "HKQuantityTypeIdentifierRunningVerticalOscillation",
           "Vertical oscillation", "cm", "mean", "mobility", 1, 25),
    Metric("running_power_w", "HKQuantityTypeIdentifierRunningPower",
           "Running power", "W", "mean", "mobility", 20, 2000),
)

BY_TYPE: dict[str, Metric] = {m.hk_type: m for m in METRICS}
BY_KEY: dict[str, Metric] = {m.key: m for m in METRICS}

# Unit conversions to each metric's canonical unit. Apple Health writes the unit
# configured on the recording device, so the same type can arrive in several units.
UNIT_CONVERSIONS: dict[tuple[str, str], float] = {
    ("km", "mi"): 0.621371,
    ("m", "mi"): 0.000621371,
    ("km/hr", "mi/hr"): 0.621371,
    ("m/s", "mi/hr"): 2.236936,
    ("cm", "in"): 0.393701,
    ("m", "in"): 39.3701,
    ("Cal", "kcal"): 1.0,
    ("kJ", "kcal"): 0.239006,
    ("ml/(kg*min)", "mL/min·kg"): 1.0,
    ("mL/min·kg", "mL/min·kg"): 1.0,
    ("kcal/hr·kg", "kcal/hr·kg"): 1.0,
    ("%", "pct"): 100.0,
    ("km", "m"): 1000.0,
    ("m/s", "ft/s"): 3.28084,
    ("km/hr", "ft/s"): 0.911344,
    ("cm", "m"): 0.01,
    ("mm", "cm"): 0.1,
    ("s", "ms"): 1000.0,
    ("hr", "min"): 60.0,
    ("s", "min"): 1 / 60,
}

# The extraction list from the original project (40 types). Kept so the
# refactored extractor stays a drop-in replacement for ``legacy/xmlExtraction.py``.
LEGACY_TARGET_TYPES: tuple[str, ...] = (
    "HKCategoryTypeIdentifierAppleStandHour",
    "HKCategoryTypeIdentifierAudioExposureEvent",
    "HKCategoryTypeIdentifierHeadphoneAudioExposureEvent",
    "HKCategoryTypeIdentifierHighHeartRateEvent",
    "HKQuantityTypeIdentifierActiveEnergyBurned",
    "HKQuantityTypeIdentifierAppleExerciseTime",
    "HKQuantityTypeIdentifierAppleStandTime",
    "HKQuantityTypeIdentifierAppleWalkingSteadiness",
    "HKQuantityTypeIdentifierBasalEnergyBurned",
    "HKQuantityTypeIdentifierBodyMass",
    "HKQuantityTypeIdentifierDistanceCycling",
    "HKQuantityTypeIdentifierDistanceSwimming",
    "HKQuantityTypeIdentifierDistanceWalkingRunning",
    "HKQuantityTypeIdentifierEnvironmentalAudioExposure",
    "HKQuantityTypeIdentifierFlightsClimbed",
    "HKQuantityTypeIdentifierHeadphoneAudioExposure",
    "HKQuantityTypeIdentifierHeartRate",
    "HKQuantityTypeIdentifierHeartRateRecoveryOneMinute",
    "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
    "HKQuantityTypeIdentifierHeight",
    "HKQuantityTypeIdentifierPhysicalEffort",
    "HKQuantityTypeIdentifierRespiratoryRate",
    "HKQuantityTypeIdentifierRestingHeartRate",
    "HKQuantityTypeIdentifierRunningGroundContactTime",
    "HKQuantityTypeIdentifierRunningPower",
    "HKQuantityTypeIdentifierRunningSpeed",
    "HKQuantityTypeIdentifierRunningStrideLength",
    "HKQuantityTypeIdentifierRunningVerticalOscillation",
    "HKQuantityTypeIdentifierSixMinuteWalkTestDistance",
    "HKQuantityTypeIdentifierStairAscentSpeed",
    "HKQuantityTypeIdentifierStairDescentSpeed",
    "HKQuantityTypeIdentifierStepCount",
    "HKQuantityTypeIdentifierSwimmingStrokeCount",
    "HKQuantityTypeIdentifierTimeInDaylight",
    "HKQuantityTypeIdentifierVO2Max",
    "HKQuantityTypeIdentifierWalkingAsymmetryPercentage",
    "HKQuantityTypeIdentifierWalkingDoubleSupportPercentage",
    "HKQuantityTypeIdentifierWalkingHeartRateAverage",
    "HKQuantityTypeIdentifierWalkingSpeed",
    "HKQuantityTypeIdentifierWalkingStepLength",
)

"""Catalog of Apple Health record types the pipeline is allowed to publish.

Only types listed here survive sanitization. Anything else in an export
(reproductive health, sexual activity, medications, clinical records, mindful
notes, etc.) is dropped before data leaves the raw layer.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Metric:
    key: str          # stable snake_case name used in outputs
    label: str        # human-readable name for dashboards
    category: str     # cardiovascular | activity | mobility | environment | body | sleep
    unit: str         # unit after normalization
    agg: str          # daily aggregation: "sum" or "mean"


_PREFIX = "HKQuantityTypeIdentifier"

METRICS: dict[str, Metric] = {
    # Cardiovascular
    f"{_PREFIX}HeartRate": Metric("heart_rate", "Heart rate", "cardiovascular", "count/min", "mean"),
    f"{_PREFIX}RestingHeartRate": Metric("resting_heart_rate", "Resting heart rate", "cardiovascular", "count/min", "mean"),
    f"{_PREFIX}WalkingHeartRateAverage": Metric("walking_heart_rate", "Walking heart rate average", "cardiovascular", "count/min", "mean"),
    f"{_PREFIX}HeartRateVariabilitySDNN": Metric("hrv_sdnn", "Heart rate variability (SDNN)", "cardiovascular", "ms", "mean"),
    f"{_PREFIX}VO2Max": Metric("vo2_max", "VO2 max", "cardiovascular", "mL/min·kg", "mean"),
    f"{_PREFIX}HeartRateRecoveryOneMinute": Metric("hr_recovery_1min", "Heart rate recovery (1 min)", "cardiovascular", "count/min", "mean"),
    f"{_PREFIX}RespiratoryRate": Metric("respiratory_rate", "Respiratory rate", "cardiovascular", "count/min", "mean"),
    f"{_PREFIX}OxygenSaturation": Metric("oxygen_saturation", "Blood oxygen", "cardiovascular", "%", "mean"),
    # Activity
    f"{_PREFIX}StepCount": Metric("steps", "Steps", "activity", "count", "sum"),
    f"{_PREFIX}DistanceWalkingRunning": Metric("distance_walk_run_km", "Walking + running distance", "activity", "km", "sum"),
    f"{_PREFIX}DistanceCycling": Metric("distance_cycling_km", "Cycling distance", "activity", "km", "sum"),
    f"{_PREFIX}FlightsClimbed": Metric("flights_climbed", "Flights climbed", "activity", "count", "sum"),
    f"{_PREFIX}ActiveEnergyBurned": Metric("active_energy_kcal", "Active energy", "activity", "kcal", "sum"),
    f"{_PREFIX}BasalEnergyBurned": Metric("basal_energy_kcal", "Resting energy", "activity", "kcal", "sum"),
    f"{_PREFIX}AppleExerciseTime": Metric("exercise_minutes", "Exercise minutes", "activity", "min", "sum"),
    f"{_PREFIX}AppleStandTime": Metric("stand_minutes", "Stand minutes", "activity", "min", "sum"),
    f"{_PREFIX}PhysicalEffort": Metric("physical_effort", "Physical effort", "activity", "kcal/hr·kg", "mean"),
    f"{_PREFIX}RunningSpeed": Metric("running_speed", "Running speed", "activity", "km/hr", "mean"),
    f"{_PREFIX}RunningPower": Metric("running_power", "Running power", "activity", "W", "mean"),
    # Mobility
    f"{_PREFIX}WalkingSpeed": Metric("walking_speed", "Walking speed", "mobility", "km/hr", "mean"),
    f"{_PREFIX}WalkingStepLength": Metric("walking_step_length", "Walking step length", "mobility", "cm", "mean"),
    f"{_PREFIX}WalkingAsymmetryPercentage": Metric("walking_asymmetry", "Walking asymmetry", "mobility", "%", "mean"),
    f"{_PREFIX}WalkingDoubleSupportPercentage": Metric("double_support", "Double support time", "mobility", "%", "mean"),
    f"{_PREFIX}StairAscentSpeed": Metric("stair_ascent_speed", "Stair speed: up", "mobility", "m/s", "mean"),
    f"{_PREFIX}StairDescentSpeed": Metric("stair_descent_speed", "Stair speed: down", "mobility", "m/s", "mean"),
    f"{_PREFIX}SixMinuteWalkTestDistance": Metric("six_min_walk_m", "Six-minute walk", "mobility", "m", "mean"),
    f"{_PREFIX}AppleWalkingSteadiness": Metric("walking_steadiness", "Walking steadiness", "mobility", "%", "mean"),
    # Environment
    f"{_PREFIX}EnvironmentalAudioExposure": Metric("env_audio_db", "Environmental sound levels", "environment", "dBASPL", "mean"),
    f"{_PREFIX}HeadphoneAudioExposure": Metric("headphone_audio_db", "Headphone audio levels", "environment", "dBASPL", "mean"),
    f"{_PREFIX}TimeInDaylight": Metric("daylight_minutes", "Time in daylight", "environment", "min", "sum"),
    f"{_PREFIX}UVExposure": Metric("uv_exposure", "UV exposure", "environment", "count", "mean"),
    f"{_PREFIX}EnvironmentalSoundReduction": Metric("sound_reduction_db", "Sound reduction", "environment", "dBASPL", "mean"),
    # Body
    f"{_PREFIX}BodyMass": Metric("body_mass_kg", "Weight", "body", "kg", "mean"),
    f"{_PREFIX}BodyMassIndex": Metric("bmi", "Body mass index", "body", "count", "mean"),
    f"{_PREFIX}BodyFatPercentage": Metric("body_fat_pct", "Body fat percentage", "body", "%", "mean"),
    f"{_PREFIX}LeanBodyMass": Metric("lean_body_mass_kg", "Lean body mass", "body", "kg", "mean"),
    f"{_PREFIX}Height": Metric("height_cm", "Height", "body", "cm", "mean"),
    f"{_PREFIX}AppleSleepingWristTemperature": Metric("wrist_temp_c", "Sleeping wrist temperature", "body", "degC", "mean"),
    f"{_PREFIX}DietaryWater": Metric("water_ml", "Water", "body", "mL", "sum"),
    f"{_PREFIX}AppleSleepingBreathingDisturbances": Metric("breathing_disturbances", "Breathing disturbances", "sleep", "count", "mean"),
}

# Unit conversions applied before aggregation so every metric has one unit.
UNIT_CONVERSIONS: dict[tuple[str, str], float] = {
    ("mi", "km"): 1.609344,
    ("m", "km"): 0.001,
    ("lb", "kg"): 0.45359237,
    ("ft", "cm"): 30.48,
    ("in", "cm"): 2.54,
    ("m", "cm"): 100.0,
    ("mi/hr", "km/hr"): 1.609344,
    ("ft/s", "m/s"): 0.3048,
    ("Cal", "kcal"): 1.0,
    ("kJ", "kcal"): 0.239005736,
    ("fl_oz_us", "mL"): 29.5735295625,
}

# Apple stores fractions (0.97) for these "%" metrics; scale to 0-100.
FRACTION_PERCENT_KEYS = {
    "oxygen_saturation",
    "walking_asymmetry",
    "double_support",
    "body_fat_pct",
    "walking_steadiness",
}


def convert_value(value: float, unit: str, metric: Metric) -> float | None:
    """Normalize a raw value into the metric's canonical unit.

    Returns None when the unit is unknown, so bad rows are dropped rather than
    silently mixed into aggregates.
    """
    if unit == metric.unit:
        out = value
    elif (unit, metric.unit) == ("degF", "degC"):
        out = (value - 32.0) * 5.0 / 9.0
    elif (unit, metric.unit) in UNIT_CONVERSIONS:
        out = value * UNIT_CONVERSIONS[(unit, metric.unit)]
    else:
        return None
    if metric.key in FRACTION_PERCENT_KEYS and out <= 1.0:
        out *= 100.0
    return out

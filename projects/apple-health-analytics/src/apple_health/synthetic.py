"""Generate a synthetic Apple Health ``export.xml`` for the public demonstration.

Nothing here is fitted to, sampled from, or derived from a real person's export.
Parameters are round, population-plausible values chosen by hand and documented
below. The generator exists so the real pipeline (extract → transform → quality
→ export) can run end to end in public, including the messy parts a real export
has: overlapping watch and phone records, a metric recorded in mixed units,
duplicate records from a merged backup, and occasional sensor glitches.

Every output is labelled synthetic. Device names are generic ("Demo Watch",
"Demo iPhone") so no personal name can appear in the file.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from xml.sax.saxutils import quoteattr

import numpy as np
import pandas as pd

SEED = 20250101

WATCH = "Demo Watch"
PHONE = "Demo iPhone"


@dataclass(frozen=True)
class Profile:
    """Hand-picked parameters for a fictional, moderately active adult."""

    start: str = "2025-01-01"
    days: int = 365
    steps_base: float = 7800        # typical weekday steps at the start of the year
    steps_trend: float = 0.15       # +15% by year end (a fictional training habit)
    resting_hr_start: float = 64.0
    resting_hr_end: float = 60.5
    vo2_start: float = 39.0
    vo2_end: float = 42.0
    hrv_base: float = 45.0
    step_length_in: float = 28.0
    walking_speed_mph: float = 3.0
    watch_off_rate: float = 0.03    # days the watch was not worn
    workout_days_per_week: float = 3.5


def _offset(day: pd.Timestamp) -> str:
    # US Eastern-style DST window for 2025, enough to exercise offset parsing.
    return "-0400" if pd.Timestamp("2025-03-09") <= day < pd.Timestamp("2025-11-02") else "-0500"


def _fmt(ts: pd.Timestamp, offset: str) -> str:
    return ts.strftime("%Y-%m-%d %H:%M:%S") + " " + offset


class _Writer:
    def __init__(self) -> None:
        self.lines: list[str] = []

    def record(self, hk_type, source, start, end, value, unit, offset, created=None):
        created = created or end
        unit_attr = f" unit={quoteattr(unit)}" if unit else ""
        self.lines.append(
            f"  <Record type={quoteattr(hk_type)} sourceName={quoteattr(source)}"
            f' sourceVersion="demo"{unit_attr}'
            f' creationDate="{_fmt(created, offset)}" startDate="{_fmt(start, offset)}"'
            f' endDate="{_fmt(end, offset)}" value={quoteattr(str(value))}/>'
        )


def _hour_weights(rng: np.random.Generator, workout_hour: int | None) -> np.ndarray:
    hours = np.arange(24)
    w = np.where((hours >= 7) & (hours <= 22), 1.0, 0.0)
    w += np.exp(-((hours - 8.5) ** 2) / 2) * 1.5   # commute
    w += np.exp(-((hours - 12.5) ** 2) / 1) * 1.0  # lunch walk
    w += np.exp(-((hours - 18) ** 2) / 3) * 1.4    # evening
    if workout_hour is not None:
        w[workout_hour] += 4.0
    w *= rng.uniform(0.6, 1.4, 24)
    w[(hours < 7) | (hours > 22)] = 0
    return w / w.sum()


def generate(path: str | Path, profile: Profile = Profile(), seed: int = SEED) -> dict:
    """Write a synthetic export to ``path`` and return a small manifest."""
    rng = np.random.default_rng(seed)
    out = _Writer()
    days = pd.date_range(profile.start, periods=profile.days, freq="D")
    n = len(days)
    progress = np.linspace(0, 1, n)

    # Latent daily state: weekly rhythm + slow trend + autocorrelated noise.
    weekday = days.dayofweek.to_numpy()
    weekly = np.where(weekday == 5, 1.18, np.where(weekday == 6, 0.82, 1.0))
    ar = np.zeros(n)
    for i in range(1, n):
        ar[i] = 0.6 * ar[i - 1] + rng.normal(0, 0.12)
    low_days = rng.random(n) < 0.04        # illness, travel, rest days
    activity = weekly * (1 + profile.steps_trend * progress) * np.exp(ar)
    activity[low_days] *= rng.uniform(0.25, 0.5, low_days.sum())
    watch_off = rng.random(n) < profile.watch_off_rate
    workout = rng.random(n) < profile.workout_days_per_week / 7

    resting_trend = np.linspace(profile.resting_hr_start, profile.resting_hr_end, n)
    vo2_trend = np.linspace(profile.vo2_start, profile.vo2_end, n)
    metric_unit_period = (days >= pd.Timestamp("2025-06-01")) & (days < pd.Timestamp("2025-06-22"))

    dup_pool = np.arange(20, n - 20) if n > 60 else np.arange(n)
    duplicate_days = set(rng.choice(dup_pool, size=min(2, n), replace=False).tolist())
    glitch_days = set(rng.choice(np.arange(n), size=min(3, n), replace=False).tolist())

    for i, day in enumerate(days):
        off = _offset(day)
        start_len = len(out.lines)
        daily_steps = max(400.0, profile.steps_base * activity[i] * rng.normal(1, 0.05))
        workout_hour = int(rng.choice([7, 12, 18, 19])) if workout[i] else None
        weights = _hour_weights(rng, workout_hour)
        step_len_in = profile.step_length_in * rng.normal(1, 0.02)

        # --- Steps, distance, flights: watch hourly + overlapping phone records
        for h in np.nonzero(weights)[0]:
            s = day + pd.Timedelta(hours=int(h), minutes=int(rng.integers(0, 10)))
            e = s + pd.Timedelta(minutes=int(rng.integers(20, 50)))
            steps_h = int(round(daily_steps * weights[h]))
            if steps_h <= 0:
                continue
            miles = steps_h * step_len_in / 63360
            if not watch_off[i]:
                out.record("HKQuantityTypeIdentifierStepCount", WATCH, s, e, steps_h, "count", off)
                out.record("HKQuantityTypeIdentifierDistanceWalkingRunning", WATCH, s, e,
                           round(miles, 4), "mi", off)
            phone_carried = watch_off[i] or rng.random() < 0.6
            if phone_carried:
                ratio = rng.uniform(0.8, 1.0)
                out.record("HKQuantityTypeIdentifierStepCount", PHONE, s, e,
                           int(steps_h * ratio), "count", off)
                out.record("HKQuantityTypeIdentifierDistanceWalkingRunning", PHONE, s, e,
                           round(miles * ratio, 4), "mi", off)
            if rng.random() < 0.25:
                flights = int(rng.integers(1, 4))
                if not watch_off[i]:
                    out.record("HKQuantityTypeIdentifierFlightsClimbed", WATCH, s, e, flights, "count", off)
                if phone_carried:
                    out.record("HKQuantityTypeIdentifierFlightsClimbed", PHONE, s, e, flights, "count", off)

        # --- Walking speed / step length: phone, several bouts a day
        for _ in range(int(rng.integers(4, 9))):
            s = day + pd.Timedelta(hours=int(rng.integers(7, 21)), minutes=int(rng.integers(0, 59)))
            e = s + pd.Timedelta(minutes=int(rng.integers(2, 12)))
            mph = profile.walking_speed_mph * rng.normal(1, 0.06) * (1 + 0.03 * progress[i])
            if metric_unit_period[i]:
                out.record("HKQuantityTypeIdentifierWalkingSpeed", PHONE, s, e,
                           round(mph / 0.621371, 3), "km/hr", off)
            else:
                out.record("HKQuantityTypeIdentifierWalkingSpeed", PHONE, s, e, round(mph, 3), "mi/hr", off)
            out.record("HKQuantityTypeIdentifierWalkingStepLength", PHONE, s, e,
                       round(step_len_in * rng.normal(1, 0.03), 2), "in", off)

        # --- Headphone audio: phone
        for _ in range(int(rng.integers(0, 5))):
            s = day + pd.Timedelta(hours=int(rng.integers(7, 22)), minutes=int(rng.integers(0, 59)))
            e = s + pd.Timedelta(minutes=int(rng.integers(10, 60)))
            out.record("HKQuantityTypeIdentifierHeadphoneAudioExposure", PHONE, s, e,
                       round(rng.normal(68, 5), 1), "dBASPL", off)

        if watch_off[i]:
            continue

        # --- Exercise minutes and active energy (watch only)
        exercise_total = rng.normal(45, 10) if workout[i] else max(0.0, rng.normal(9, 6))
        exercise_total = max(0, int(exercise_total * min(activity[i], 1.4)))
        if exercise_total:
            parts = 2 if exercise_total > 30 else 1
            for k in range(parts):
                h = workout_hour if (workout_hour is not None and k == 0) else int(rng.integers(8, 21))
                s = day + pd.Timedelta(hours=h, minutes=int(rng.integers(0, 30)))
                mins = exercise_total // parts
                out.record("HKQuantityTypeIdentifierAppleExerciseTime", WATCH, s,
                           s + pd.Timedelta(minutes=mins), mins, "min", off)
        for h in np.nonzero(weights)[0]:
            s = day + pd.Timedelta(hours=int(h))
            kcal = daily_steps * weights[h] * 0.042 + (exercise_total * 7.5 if h == workout_hour else 0)
            kcal += rng.uniform(1, 6)
            out.record("HKQuantityTypeIdentifierActiveEnergyBurned", WATCH, s,
                       s + pd.Timedelta(minutes=59), round(kcal, 2), "kcal", off)

        # --- Stand hours
        for h in range(24):
            s = day + pd.Timedelta(hours=h)
            awake = 7 <= h <= 22
            stood = awake and rng.random() < (0.78 if weekday[i] < 5 else 0.68)
            value = "HKCategoryValueAppleStandHourStood" if stood else "HKCategoryValueAppleStandHourIdle"
            if awake or rng.random() < 0.2:
                out.record("HKCategoryTypeIdentifierAppleStandHour", WATCH, s,
                           s + pd.Timedelta(hours=1), value, None, off)

        # --- Heart rate samples
        resting = resting_trend[i] + rng.normal(0, 1.6) + (3 if low_days[i] else 0)
        for minute in range(7 * 60, 23 * 60, int(rng.integers(15, 25))):
            s = day + pd.Timedelta(minutes=minute)
            h = minute // 60
            bump = 55 if (workout_hour is not None and h == workout_hour) else 18 * weights[h] * 16
            bpm = resting + 12 + bump * rng.uniform(0.5, 1.1) + rng.normal(0, 4)
            out.record("HKQuantityTypeIdentifierHeartRate", WATCH, s, s, round(bpm), "count/min", off)
        if i in glitch_days:
            s = day + pd.Timedelta(hours=3, minutes=12)
            out.record("HKQuantityTypeIdentifierHeartRate", WATCH, s, s, 251, "count/min", off)

        # Resting HR: usually one estimate per day; sometimes the watch writes two.
        night = day + pd.Timedelta(hours=6, minutes=int(rng.integers(0, 50)))
        out.record("HKQuantityTypeIdentifierRestingHeartRate", WATCH, night,
                   night + pd.Timedelta(hours=10), round(resting), "count/min", off)
        if rng.random() < 0.15:
            later = day + pd.Timedelta(hours=16)
            out.record("HKQuantityTypeIdentifierRestingHeartRate", WATCH, later,
                       later + pd.Timedelta(hours=2), round(resting + rng.normal(1.5, 1.5)), "count/min", off)
        evening = day + pd.Timedelta(hours=21)
        out.record("HKQuantityTypeIdentifierWalkingHeartRateAverage", WATCH, day + pd.Timedelta(hours=8),
                   evening, round(resting + 38 + rng.normal(0, 4)), "count/min", off)

        # HRV (SDNN): a few readings per day, inversely related to resting HR
        for _ in range(int(rng.integers(2, 6))):
            s = day + pd.Timedelta(hours=int(rng.integers(0, 23)), minutes=int(rng.integers(0, 59)))
            sdnn = profile.hrv_base + (62 - resting) * 1.6 + rng.normal(0, 9)
            out.record("HKQuantityTypeIdentifierHeartRateVariabilitySDNN", WATCH, s,
                       s + pd.Timedelta(minutes=1), round(max(8.0, sdnn), 1), "ms", off)

        # VO2 max: occasional estimates after outdoor walks or runs
        if workout[i] and rng.random() < 0.45:
            s = day + pd.Timedelta(hours=workout_hour or 18, minutes=40)
            out.record("HKQuantityTypeIdentifierVO2Max", WATCH, s, s,
                       round(vo2_trend[i] + rng.normal(0, 0.7), 2), "mL/min·kg", off)

        # Environmental sound (watch), 30-minute windows
        for _ in range(int(rng.integers(8, 16))):
            s = day + pd.Timedelta(hours=int(rng.integers(7, 22)), minutes=int(rng.integers(0, 30)))
            level = rng.normal(62, 7) + (8 if weekday[i] >= 5 and rng.random() < 0.3 else 0)
            out.record("HKQuantityTypeIdentifierEnvironmentalAudioExposure", WATCH, s,
                       s + pd.Timedelta(minutes=30), round(level, 1), "dBASPL", off)

        # Physical effort (watch): minute-scale samples, higher during exercise
        for _ in range(int(rng.integers(18, 34))):
            h = int(rng.integers(7, 22))
            s = day + pd.Timedelta(hours=h, minutes=int(rng.integers(0, 55)))
            base = 2.4 if (workout_hour is not None and h == workout_hour) else 1.4
            out.record("HKQuantityTypeIdentifierPhysicalEffort", WATCH, s, s + pd.Timedelta(minutes=3),
                       round(max(0.5, rng.normal(base, 0.35) * (1 + weights[h] * 2)), 2),
                       "kcal/hr·kg", off)

        # Merged-backup artefact: the whole day appears twice.
        if i in duplicate_days:
            out.lines.extend(out.lines[start_len:])

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    header = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<!-- SYNTHETIC DATA. Generated by apple_health.synthetic for a public demo. "
        "Not a real person's health records. -->\n"
        '<HealthData locale="en_US">\n'
        '  <ExportDate value="2026-01-01 00:00:00 -0500"/>\n'
    )
    path.write_text(header + "\n".join(out.lines) + "\n</HealthData>\n", encoding="utf-8")
    return {
        "path": str(path),
        "seed": seed,
        "records": len(out.lines),
        "days": n,
        "watch_off_days": int(watch_off.sum()),
        "duplicate_days": len(duplicate_days),
        "glitch_samples": len(glitch_days & set(np.nonzero(~watch_off)[0].tolist())),
    }

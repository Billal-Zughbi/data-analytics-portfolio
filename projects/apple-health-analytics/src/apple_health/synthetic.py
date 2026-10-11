"""Generate a synthetic Apple Health export for demos and tests.

The file mimics the real ``export.xml`` layout, including the identifying
attributes (sourceName, device, metadata) and record types the sanitizer must
drop, so tests prove those fields never reach published outputs. Every value is
random; none of it describes a real person.
"""

from __future__ import annotations

import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path
from xml.sax.saxutils import quoteattr

FAKE_SOURCE = "Demo Person's Apple Watch"
FAKE_DEVICE = "<<HKDevice: 0x0>, name:Apple Watch, model:Watch, hardware:Watch0,0, software:0.0>"


def _record(rtype: str, unit: str, value: float | str, start: datetime, minutes: int = 1) -> str:
    end = start + timedelta(minutes=minutes)
    fmt = "%Y-%m-%d %H:%M:%S -0500"
    return (
        f"  <Record type={quoteattr(rtype)} sourceName={quoteattr(FAKE_SOURCE)} sourceVersion=\"10.0\" "
        f"device={quoteattr(FAKE_DEVICE)} unit={quoteattr(unit)} creationDate=\"{end.strftime(fmt)}\" "
        f"startDate=\"{start.strftime(fmt)}\" endDate=\"{end.strftime(fmt)}\" value=\"{value}\">\n"
        f"    <MetadataEntry key=\"HKTimeZone\" value=\"America/New_York\"/>\n"
        f"  </Record>\n"
    )


def generate_export(path: str | Path, start: date = date(2024, 1, 1), days: int = 365, seed: int = 7) -> int:
    """Write a synthetic export and return the number of Record elements."""
    rng = random.Random(seed)
    q = "HKQuantityTypeIdentifier"
    count = 0
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<HealthData locale="en_US">\n')
        f.write(' <ExportDate value="2025-01-01 00:00:00 -0500"/>\n')
        f.write(' <Me HKCharacteristicTypeIdentifierDateOfBirth="1990-01-01" '
                'HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexNotSet"/>\n')
        for d in range(days):
            day = datetime.combine(start + timedelta(days=d), datetime.min.time())
            season = math.sin(2 * math.pi * d / 365)
            weekend = day.weekday() >= 5
            fitness = d / days  # gradual improvement over the year

            # Activity: hourly step and distance chunks during waking hours
            for hour in range(7, 22):
                t = day + timedelta(hours=hour, minutes=rng.randint(0, 50))
                steps = max(0, int(rng.gauss(620 + 120 * season + (150 if weekend else 0), 220)))
                f.write(_record(f"{q}StepCount", "count", steps, t, 10))
                f.write(_record(f"{q}DistanceWalkingRunning", "mi", round(steps * 0.00047, 4), t, 10))
                f.write(_record(f"{q}ActiveEnergyBurned", "Cal", round(steps * 0.04 + rng.uniform(5, 15), 2), t, 10))
                f.write(_record(f"{q}HeartRate", "count/min", round(rng.gauss(78 - 4 * fitness, 9), 1), t))
                count += 4
            f.write(_record(f"{q}RestingHeartRate", "count/min",
                            round(rng.gauss(63 - 5 * fitness - 1.5 * season, 1.8), 1), day + timedelta(hours=6)))
            f.write(_record(f"{q}HeartRateVariabilitySDNN", "ms",
                            round(rng.gauss(42 + 8 * fitness, 6), 1), day + timedelta(hours=3)))
            f.write(_record(f"{q}AppleExerciseTime", "min",
                            max(0, int(rng.gauss(32 + 10 * fitness + (15 if weekend else 0), 12))), day + timedelta(hours=18), 30))
            f.write(_record(f"{q}WalkingSpeed", "mi/hr", round(rng.gauss(3.0, 0.15), 2), day + timedelta(hours=12)))
            f.write(_record(f"{q}OxygenSaturation", "%", round(min(1.0, rng.gauss(0.97, 0.01)), 3), day + timedelta(hours=2)))
            f.write(_record(f"{q}EnvironmentalAudioExposure", "dBASPL", round(rng.gauss(68, 5), 1), day + timedelta(hours=14)))
            f.write(_record(f"{q}TimeInDaylight", "min", max(0, int(rng.gauss(55 + 35 * season, 20))), day + timedelta(hours=13), 60))
            count += 7
            if d % 7 == 0:
                f.write(_record(f"{q}BodyMass", "lb", round(rng.gauss(180 - 6 * fitness, 1.2), 1), day + timedelta(hours=7)))
                f.write(_record(f"{q}VO2Max", "mL/min·kg", round(rng.gauss(40 + 4 * fitness, 0.8), 1), day + timedelta(hours=19)))
                count += 2
            # Sensitive types that must never be published
            if d % 30 == 0:
                f.write(_record("HKCategoryTypeIdentifierSexualActivity", "", "HKCategoryValueNotApplicable", day))
                f.write(_record("HKCategoryTypeIdentifierMenstrualFlow", "", "HKCategoryValueMenstrualFlowLight", day))
                count += 2
        f.write(' <ClinicalRecord type="HKClinicalTypeIdentifierLabResultRecord" identifier="demo" '
                'sourceName="Demo Hospital" fhirVersion="4.0.1" receivedDate="2024-06-01 00:00:00 -0500" '
                'resourceFilePath="/clinical-records/demo.json"/>\n')
        f.write("</HealthData>\n")
    return count

"""Tests check calculation rules and data contracts, not health outcomes."""

from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd
import pytest

from apple_health import export_web, quality, synthetic, transform
from apple_health.extract import classify_device, extract, parse_local

FIXTURE = Path(__file__).parent / "fixtures" / "mini_export.xml"


@pytest.fixture(scope="module")
def records() -> pd.DataFrame:
    return extract(FIXTURE).records


@pytest.fixture(scope="module")
def daily(records) -> pd.DataFrame:
    fact, _ = transform.build_daily(records)
    return fact.set_index("date")


DAY1 = pd.Timestamp("2025-01-01")
DAY2 = pd.Timestamp("2025-01-02")


# --- extraction ---------------------------------------------------------------

def test_device_names_are_reduced_to_a_class(records):
    assert set(records["device_class"].astype(str)) <= {"watch", "phone", "other"}
    assert "sourceName" not in records.columns
    assert classify_device("Someone’s Apple Watch") == "watch"
    assert classify_device("Someone’s iPhone") == "phone"
    assert classify_device(None) == "other"


def test_local_time_is_kept_from_each_offset():
    assert parse_local("2025-01-02 23:30:00 -0800") == pd.Timestamp("2025-01-02 23:30:00")
    assert parse_local("bad") is None


def test_default_extractor_only_keeps_registered_types(records):
    assert "HKQuantityTypeIdentifierBodyMass" not in set(records["hk_type"].astype(str))


def test_missing_file_has_a_helpful_error(tmp_path):
    with pytest.raises(FileNotFoundError, match="Export All Health Data"):
        extract(tmp_path / "nope.xml")


# --- transformation rules -------------------------------------------------------

def test_additive_metrics_dedupe_watch_and_phone_and_exact_duplicates(daily):
    # 08:00 hour: watch 1000 wins over phone 900; duplicate watch row removed.
    # 12:00 hour: phone-only 500 is kept.
    assert daily.loc[DAY1, "steps"] == 1500


def test_rate_metrics_are_averaged_not_summed(daily, records):
    assert daily.loc[DAY1, "resting_hr_bpm"] == 60
    naive = transform.naive_sum_by_day(records, "resting_hr_bpm")
    assert naive.loc[DAY1] == 120  # what an implicit Sum would show


def test_out_of_range_samples_are_excluded_and_counted(records):
    fact, stats = transform.build_daily(records)
    assert stats["out_of_range_excluded"] == 1
    assert fact.set_index("date").loc[DAY1, "heart_rate_bpm"] == 80


def test_sound_levels_use_energy_average(daily):
    expected = 10 * math.log10((10 ** 6 + 10 ** 8) / 2)
    assert daily.loc[DAY1, "env_audio_dba"] == pytest.approx(expected, abs=1e-6)
    assert daily.loc[DAY1, "env_audio_dba"] == pytest.approx(77.03, abs=0.01)


def test_stand_hours_count_distinct_stood_hours(daily):
    assert daily.loc[DAY1, "stand_hours"] == 2


def test_units_are_converted_and_unknown_units_rejected(records, daily):
    _, rejected = transform.normalize_units(records)
    assert len(rejected) == 1
    assert daily.loc[DAY1, "walking_speed_mph"] == pytest.approx(5 * 0.621371)


def test_sparse_metrics_take_the_last_reading(daily):
    assert daily.loc[DAY1, "vo2max"] == 41.0


def test_late_evening_record_stays_on_its_local_day(daily):
    assert daily.loc[DAY2, "steps"] == 300


def test_exercise_is_zero_on_worn_days_without_exercise(daily):
    assert daily.loc[DAY1, "exercise_min"] == 0
    assert daily.loc[DAY2, "exercise_min"] == 0


def test_daily_table_has_one_row_per_day(records):
    fact, _ = transform.build_daily(records)
    assert fact["date"].is_unique
    assert list(fact["date"]) == [DAY1, DAY2]


# --- quality report ---------------------------------------------------------------

def test_quality_profile_reports_each_issue(records):
    fact, stats = transform.build_daily(records)
    report = quality.profile(records, fact, stats)
    checks = report["checks"]
    # The repeated 08:00 watch step record and the repeated 08:00 stand-hour record.
    assert checks["exact_duplicates"] == 2
    assert checks["unit_rejected"] == 1
    assert checks["unit_converted"] == 1
    assert checks["out_of_range"] == 1
    assert checks["overlap_records_removed"] == 1


# --- synthetic data and public export ----------------------------------------------

@pytest.fixture(scope="module")
def synthetic_run(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("synthetic")
    manifest = synthetic.generate(tmp / "export.xml", synthetic.Profile(days=60))
    manifest["synthetic"] = True
    result = extract(tmp / "export.xml")
    fact, stats = transform.build_daily(result.records)
    report = quality.profile(result.records, fact, stats)
    written = export_web.write_outputs(
        result.records, fact, report, manifest, tmp / "site", tmp / "sample"
    )
    return tmp, manifest, written


def test_synthetic_generator_is_deterministic(tmp_path):
    a = synthetic.generate(tmp_path / "a.xml", synthetic.Profile(days=10))
    b = synthetic.generate(tmp_path / "b.xml", synthetic.Profile(days=10))
    assert (tmp_path / "a.xml").read_bytes() == (tmp_path / "b.xml").read_bytes()
    assert a["records"] == b["records"]


def test_synthetic_export_uses_generic_device_names(synthetic_run):
    tmp, _, _ = synthetic_run
    text = (tmp / "export.xml").read_text(encoding="utf-8")
    assert "SYNTHETIC DATA" in text
    names = set(pd.Series(text.split('sourceName="')[1:]).str.split('"').str[0])
    assert names == {synthetic.WATCH, synthetic.PHONE}


def test_public_outputs_are_labelled_and_carry_no_record_level_fields(synthetic_run):
    tmp, _, written = synthetic_run
    for path in written:
        text = path.read_text(encoding="utf-8")
        for needle in ("sourceName", "Demo Watch", "Demo iPhone", "startDate", "creationDate", "device_class"):
            assert needle not in text, f"{path.name} contains {needle}"
    summary = json.loads((tmp / "site" / "summary.json").read_text(encoding="utf-8"))
    assert summary["synthetic"] is True
    assert "not real measurements" in summary["notice"]


def test_export_refuses_non_synthetic_input(tmp_path, records):
    fact, stats = transform.build_daily(records)
    report = quality.profile(records, fact, stats)
    with pytest.raises(PermissionError):
        export_web.write_outputs(records, fact, report, {"synthetic": False}, tmp_path, tmp_path)


def test_power_bi_tables_reconcile_with_daily_table(synthetic_run):
    tmp, _, _ = synthetic_run
    wide = pd.read_csv(tmp / "sample" / "daily_metrics_synthetic.csv")
    fact = pd.read_csv(tmp / "sample" / "fact_daily_metric.csv")
    dim_metric = pd.read_csv(tmp / "sample" / "dim_metric.csv")
    dim_date = pd.read_csv(tmp / "sample" / "dim_date.csv")
    # Every fact row joins to exactly one metric and one date (no fan-out).
    assert dim_metric["metric"].is_unique and dim_date["date"].is_unique
    assert len(fact.merge(dim_metric, on="metric").merge(dim_date, on="date")) == len(fact)
    assert not fact.duplicated(["date", "metric"]).any()
    # Totals reconcile between the wide and long tables.
    steps_long = fact.loc[fact["metric"] == "steps", "value"].sum()
    assert steps_long == pytest.approx(wide["steps"].sum(), rel=1e-6)


def test_weekly_view_averages_additive_metrics_per_day():
    days = pd.date_range("2025-01-06", periods=7, freq="D")
    daily = pd.DataFrame({"date": days, "steps": [1000.0] * 6 + [None]})
    week = export_web.weekly(daily)
    assert week.loc[0, "steps"] == 1000  # a missing day does not drag the week down

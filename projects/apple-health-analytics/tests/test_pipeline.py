import json

import pandas as pd
import pytest

from apple_health.metrics import METRICS
from apple_health.parse import load_records
from apple_health.sanitize import PUBLIC_COLUMNS, assert_public_safe, build_tables, portfolio_summary, write_outputs
from apple_health.synthetic import FAKE_SOURCE, generate_export


@pytest.fixture(scope="module")
def export(tmp_path_factory):
    path = tmp_path_factory.mktemp("raw") / "export.xml"
    generate_export(path, days=40)
    return path


@pytest.fixture(scope="module")
def records(export):
    return load_records(export)


@pytest.fixture(scope="module")
def tables(records):
    return build_tables(records)


def test_catalog_covers_forty_metrics():
    assert len(METRICS) == 40
    assert len({m.key for m in METRICS.values()}) == 40


def test_only_allowlisted_metrics_survive(records):
    allowed = {m.key for m in METRICS.values()}
    assert set(records["metric"]) <= allowed
    assert list(records.columns) == ["date", "metric", "value"]


def test_units_are_normalized(records):
    distance = records.loc[records["metric"] == "distance_walk_run_km", "value"].sum()
    steps = records.loc[records["metric"] == "steps", "value"].sum()
    # Synthetic data writes 0.00047 mi per step; miles must be converted to km.
    assert distance / steps == pytest.approx(0.00047 * 1.609344, rel=0.01)
    spo2 = records.loc[records["metric"] == "oxygen_saturation", "value"]
    assert spo2.between(80, 100).all()  # fraction scaled to percent
    weight = records.loc[records["metric"] == "body_mass_kg", "value"]
    assert weight.between(70, 90).all()  # pounds converted to kg


def test_daily_aggregation(records, tables):
    fact = tables["fact_daily_metric"]
    assert not fact.duplicated(["date", "metric"]).any()
    first_day = records["date"].min()
    steps_raw = records[(records["date"] == first_day) & (records["metric"] == "steps")]["value"].sum()
    steps_fact = fact[(fact["date"] == first_day) & (fact["metric"] == "steps")]["value"].item()
    assert steps_fact == pytest.approx(steps_raw)
    rhr = fact[fact["metric"] == "resting_heart_rate"]
    assert (rhr["record_count"] == 1).all()


def test_outputs_contain_no_identifying_fields(tables, tmp_path):
    for name, df in tables.items():
        assert list(df.columns) == PUBLIC_COLUMNS[name]
    summary = portfolio_summary(tables, total_records=1, data_source="synthetic")
    write_outputs(tables, summary, tmp_path)
    blob = "".join(p.read_text() for p in tmp_path.iterdir())
    for needle in [FAKE_SOURCE, "HKDevice", "Apple Watch", "America/New_York", "-0500",
                   "SexualActivity", "MenstrualFlow", "Clinical", "DateOfBirth", "Demo Hospital"]:
        assert needle not in blob


def test_guard_rejects_extra_columns(tables):
    leaked = dict(tables)
    leaked["fact_daily_metric"] = tables["fact_daily_metric"].assign(sourceName="x")
    with pytest.raises(ValueError):
        assert_public_safe(leaked)


def test_summary_shape(tables, tmp_path):
    summary = portfolio_summary(tables, total_records=123, data_source="synthetic")
    assert summary["recordsProcessed"] == 123
    assert summary["daysCovered"] == 40
    assert summary["monthly"]["steps"][0]["month"] == "2024-01"
    json.dumps(summary)  # serializable


def test_empty_export(tmp_path):
    path = tmp_path / "export.xml"
    path.write_text('<?xml version="1.0"?><HealthData></HealthData>')
    tables = build_tables(load_records(path))
    assert tables["fact_daily_metric"].empty
    assert isinstance(tables["dim_date"], pd.DataFrame)

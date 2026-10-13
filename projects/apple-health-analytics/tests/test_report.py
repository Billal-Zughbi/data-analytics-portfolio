"""Contracts for the real-data build: the original report is reproduced, cleaning is explicit,
and nothing private reaches the published files."""

from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from apple_health import analysis, publish
from apple_health.catalog import BY_KEY, CATALOG
from apple_health.report_sim import filter_path, parse_shown, reproduce_cards

PROJECT = Path(__file__).resolve().parents[1]
ORIGINAL = PROJECT / "data" / "original"
DAILY = PROJECT / "data" / "daily"


@pytest.fixture(scope="module")
def raw() -> pd.DataFrame:
    return analysis.load_daily(ORIGINAL / "daily_metrics.csv")


@pytest.fixture(scope="module")
def model() -> dict:
    return json.loads((ORIGINAL / "report_model.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def fresh() -> pd.DataFrame:
    cleaned, _ = analysis.clean(analysis.load_daily(DAILY / "daily_metrics.csv"))
    return cleaned


@pytest.fixture(scope="module")
def built(tmp_path_factory) -> Path:
    out = tmp_path_factory.mktemp("build")
    publish.build(ORIGINAL, DAILY, out / "site", out / "model", out / "outputs")
    return out


# --- reproducing the original report -------------------------------------------------

def test_every_card_on_the_original_report_is_reproduced(raw, model):
    shown = pd.read_csv(ORIGINAL / "report_cards_displayed.csv")
    cards = reproduce_cards(raw, model, shown)
    assert len(cards) == len(shown) == 24
    misses = [(c["label"], c["shown"], c["rebuilt"]) for c in cards if not c["matches"]]
    assert misses == []


def test_cards_on_inactive_relationships_ignore_the_slicer(raw, model):
    shown = pd.read_csv(ORIGINAL / "report_cards_displayed.csv")
    by_label = {c["label"]: c for c in reproduce_cards(raw, model, shown)}
    walking = by_label["Average Walking Speed (mph)"]
    assert walking["slicer_reached"] is False
    assert walking["days"] == raw["walking_speed_mph"].notna().sum()


def test_filter_path_follows_only_active_date_relationships():
    rels = [
        {"from_table": "A", "from_column": "creation date", "to_table": "B", "to_column": "creation date",
         "active": True, "cross_filter": "Both"},
        {"from_table": "A", "from_column": "creation date", "to_table": "C", "to_column": "creation date",
         "active": False, "cross_filter": "Both"},
        {"from_table": "B", "from_column": "value", "to_table": "D", "to_column": "value",
         "active": True, "cross_filter": "Both"},
    ]
    assert filter_path(rels, "B", "A") == ["B", "A"]
    assert filter_path(rels, "A", "C") is None
    assert filter_path(rels, "A", "D") is None


def test_displayed_values_parse_with_their_precision():
    assert parse_shown("72.26K") == pytest.approx((72260, 5))
    assert parse_shown("61") == pytest.approx((61, 0.5))
    assert parse_shown("0.13") == pytest.approx((0.13, 0.005))


# --- cleaning ----------------------------------------------------------------------------

def test_cleaning_excludes_but_never_changes_values():
    df = pd.DataFrame({"date": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]),
                       "distance_walk_run_mi": [3.0, 544.0, 2.0], "running_power_sum_w": [250.0, np.nan, 98000.0],
                       "running_power_w": [250.0, np.nan, 9800.0]})
    cleaned, removed = analysis.clean(df)
    assert cleaned["distance_walk_run_mi"].tolist()[0] == 3.0
    assert np.isnan(cleaned["distance_walk_run_mi"].iloc[1])
    assert cleaned["running_power_sum_w"].isna().all()
    assert cleaned["running_power_w"].tolist()[0] == 250.0 and np.isnan(cleaned["running_power_w"].iloc[2])
    assert {r["metric"] for r in removed} == {"distance_walk_run_mi", "running_power_sum_w", "running_power_w"}
    assert len(removed) == 4


def test_every_metric_has_a_range_unless_it_is_unusable():
    for m in CATALOG:
        if m.kind == "summed_rate":
            continue
        assert m.lo is not None and m.hi is not None and m.lo < m.hi, m.key


def test_distance_check_flags_double_counting(raw):
    cleaned, _ = analysis.clean(raw)
    check = analysis.distance_check(cleaned)
    assert 0.3 < check["expected_mi_per_1000"] < 0.6
    assert check["ratio_to_expected"] > 1.5


def test_rebuilt_distance_matches_step_length(fresh):
    check = analysis.distance_check(fresh)
    assert 0.85 < check["ratio_to_expected"] < 1.2


def test_fresh_daily_table_starts_and_ends_with_data(fresh):
    assert fresh["date"].is_monotonic_increasing and not fresh["date"].duplicated().any()
    values = fresh.drop(columns="date")
    assert values.iloc[0].notna().any() and values.iloc[-1].notna().any()


def test_yearly_rows_carry_their_day_counts(raw):
    cleaned, _ = analysis.clean(raw)
    for row in analysis.yearly(cleaned):
        assert row["watch_days"] <= 366 and row["step_days"] <= 366
        if row["step_days"]:
            assert row["steps_total"] == pytest.approx(row["steps_mean"] * row["step_days"], rel=0.01)


# --- published files ---------------------------------------------------------------------

def test_daily_series_are_aligned_and_cleaned(built):
    payload = json.loads((built / "site" / "daily.json").read_text())
    for key, entry in payload["dense"].items():
        assert entry["offset"] >= 0 and entry["offset"] + len(entry["values"]) <= payload["days"], key
        assert entry["values"][0] is not None, key
        m = BY_KEY[key]
        nums = [v for v in entry["values"] if v is not None]
        assert min(nums) >= m.lo and max(nums) <= m.hi, key
    for key, pairs in payload["sparse"].items():
        assert all(0 <= i < payload["days"] for i, _ in pairs), key
    assert "running_power_sum_w" not in payload["dense"] and "running_power_sum_w" not in payload["sparse"]


def test_published_files_hold_no_device_names_paths_or_times(built):
    files = [*built.rglob("*.json"), *built.rglob("*.csv"), *ORIGINAL.glob("*"), *DAILY.glob("*")]
    for f in files:
        text = f.read_text(encoding="utf-8")
        assert "sourceName" not in text, f
        assert not re.search(r"[’']s (Apple Watch|iPhone)", text), f
        assert not re.search(r"[A-Z]:\\\\Users|/Users/|/home/", text), f
        assert not re.search(r"\d{2}:\d{2}:\d{2}", text), f


def test_star_schema_reconciles_with_the_daily_table(built, fresh):
    fact = pd.read_csv(built / "model" / "fact_daily_metric.csv")
    dim_metric = pd.read_csv(built / "model" / "dim_metric.csv")
    dim_date = pd.read_csv(built / "model" / "dim_date.csv")
    assert not fact.duplicated(["date", "metric"]).any()
    assert set(fact["metric"]) <= set(dim_metric["metric"])
    assert set(fact["date"]) <= set(dim_date["date"])
    assert fact.loc[fact["metric"] == "steps", "value"].sum() == pytest.approx(fresh["steps"].sum())


def test_summary_findings_and_checks_are_complete(built):
    s = json.loads((built / "site" / "summary.json").read_text())
    assert all(c["matches"] for c in s["cards"])
    for f in s["findings"]:
        assert f["title"] and f["summary"] and f["metric"] and f["caveat"]
    assert not [c for c in s["quality"]["checks"] if c["result"] == "fail"]

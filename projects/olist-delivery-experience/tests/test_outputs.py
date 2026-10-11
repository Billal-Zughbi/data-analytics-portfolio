"""Contract for the published outputs (website JSON, Power BI CSVs, figures).

These read the files the export wrote, so they also catch hand edits.
They check shape, privacy and size, not what the numbers say.
"""

from __future__ import annotations

import json

import pandas as pd
import pytest

from olist_delivery import export
from olist_delivery.config import FILES, PROJECT_DIR, SAMPLE_DIR, SITE_DATA_DIR

from conftest import real_data_dir

SITE_FILES = ["summary.json", "monthly.json", "review_by_delay.json", "routes.json", "categories.json",
              "estimate_accuracy.json"]
PBI_FILES = ["fact_route_month", "fact_category_month", "fact_item_revenue_month", "fact_delay_review",
             "fact_customer_cohort", "dim_month", "dim_state", "dim_category", "dim_delay_bucket"]

needs_outputs = pytest.mark.skipif(
    not (SITE_DATA_DIR / "summary.json").exists(),
    reason="published outputs not generated yet; run `python -m olist_delivery all`",
)


@pytest.fixture(scope="module")
def summary():
    return json.loads((SITE_DATA_DIR / "summary.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def pbi():
    return {name: pd.read_csv(SAMPLE_DIR / f"{name}.csv", keep_default_na=False, na_values=[""]) for name in PBI_FILES}


@needs_outputs
def test_summary_has_the_agreed_shape(summary):
    assert set(summary) >= {"generated_at", "source", "question", "kpis", "findings", "quality",
                            "reconciliation", "next_steps"}
    src = summary["source"]
    assert set(src) >= {"name", "publisher", "url", "license", "retrieved", "mirror_url", "coverage", "rows"}
    assert src["license"] == "CC BY-NC-SA 4.0"
    assert set(src["coverage"]) >= {"start", "end"}
    assert set(src["rows"]) >= {"orders", "items", "payments", "reviews"}
    assert 6 <= len(summary["kpis"]) <= 8
    for k in summary["kpis"]:
        assert set(k) >= {"key", "label", "value", "unit", "display", "definition"}
        assert isinstance(k["display"], str) and k["display"]
    assert 4 <= len(summary["findings"]) <= 6
    for f in summary["findings"]:
        assert set(f) >= {"id", "title", "summary", "metric", "caveat"}
        assert f["summary"].count(". ") <= 2  # one or two sentences
    assert 3 <= len(summary["next_steps"]) <= 5
    for r in summary["reconciliation"]:
        assert set(r) >= {"metric", "sql", "python", "match"}
    for c in summary["quality"]["checks"]:
        assert c["result"] in {"pass", "warn", "fail", "info"}


@needs_outputs
def test_published_checks_and_reconciliation_are_clean(summary):
    assert all(r["match"] for r in summary["reconciliation"])
    assert not [c for c in summary["quality"]["checks"] if c["result"] == "fail"]


@needs_outputs
def test_kpi_values_and_displays_agree(summary):
    for k in summary["kpis"]:
        if k["unit"] == "share":
            assert k["display"].startswith(f"{k['value'] * 100:.1f}%"), k["key"]


@needs_outputs
def test_site_json_is_small_and_carries_no_identifiers():
    paths = [SITE_DATA_DIR / f for f in SITE_FILES]
    assert all(p.exists() for p in paths)
    total = export.assert_public_safe(paths, 150_000)
    assert total < 150_000
    for p in paths:
        data = json.loads(p.read_text(encoding="utf-8"))
        assert data, p.name


@needs_outputs
def test_power_bi_tables_are_small_and_carry_no_identifiers():
    paths = [SAMPLE_DIR / f"{n}.csv" for n in PBI_FILES]
    total = export.assert_public_safe(paths, 1_500_000)
    assert total < 1_500_000


@needs_outputs
def test_power_bi_keys_are_unique_and_facts_join_without_fan_out(pbi):
    assert pbi["dim_month"]["month"].is_unique
    assert pbi["dim_state"]["state"].is_unique
    assert pbi["dim_category"]["category"].is_unique
    assert pbi["dim_delay_bucket"]["delay_bucket"].is_unique
    route = pbi["fact_route_month"]
    assert not route.duplicated(["month", "seller_state", "customer_state"]).any()
    for col, dim, key in [("month", "dim_month", "month"), ("seller_state", "dim_state", "state"),
                          ("customer_state", "dim_state", "state")]:
        assert route[col].isin(pbi[dim][key]).all(), col
    cat = pbi["fact_category_month"]
    assert not cat.duplicated(["month", "category"]).any()
    assert cat["category"].isin(pbi["dim_category"]["category"]).all()
    rev = pbi["fact_item_revenue_month"]
    assert rev["category"].isin(pbi["dim_category"]["category"]).all()
    delay = pbi["fact_delay_review"]
    assert delay["delay_bucket"].isin(pbi["dim_delay_bucket"]["delay_bucket"]).all()
    joined = route.merge(pbi["dim_state"], left_on="customer_state", right_on="state")
    assert len(joined) == len(route)


@needs_outputs
def test_power_bi_tables_reproduce_published_kpis(pbi, summary):
    route = pbi["fact_route_month"]
    kpi = {k["key"]: k["value"] for k in summary["kpis"]}
    assert route["late_orders"].sum() / route["delivered_orders"].sum() == pytest.approx(kpi["late_rate"], abs=5e-5)
    assert route["orders"].sum() == summary["source"]["rows"]["orders"]
    assert pbi["fact_category_month"]["late_orders"].sum() == route["late_orders"].sum()
    assert pbi["fact_delay_review"]["orders"].sum() == route["delivered_orders"].sum()


@needs_outputs
def test_figures_exist():
    for name in ["review_by_delay", "monthly_late_rate", "delivery_legs", "estimate_accuracy", "routes"]:
        p = PROJECT_DIR / "outputs" / "figures" / f"{name}.png"
        assert p.exists() and p.stat().st_size < 300_000, name


@needs_outputs
@pytest.mark.skipif(real_data_dir() is None, reason="raw reviews not available to compare against")
def test_no_review_text_reaches_any_published_file():
    reviews = pd.read_csv(real_data_dir() / FILES["order_reviews"], dtype=str)
    texts = pd.concat([reviews["review_comment_message"], reviews["review_comment_title"]]).dropna()
    # Distinctive snippets only: long comments, first 25 characters.
    snippets = {t.strip()[:25] for t in texts if len(t.strip()) >= 40}
    published = [SITE_DATA_DIR / f for f in SITE_FILES] + [SAMPLE_DIR / f"{n}.csv" for n in PBI_FILES]
    published += sorted((PROJECT_DIR / "outputs").rglob("*.csv")) + sorted((PROJECT_DIR / "outputs").glob("*.json"))
    published += [PROJECT_DIR / "notebooks" / "exploratory_analysis.ipynb"]
    blob = "\n".join(p.read_text(encoding="utf-8") for p in published if p.exists())
    leaked = [s for s in snippets if s in blob]
    assert not leaked, leaked[:3]

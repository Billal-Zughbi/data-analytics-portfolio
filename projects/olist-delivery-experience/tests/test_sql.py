"""The DuckDB pipeline on the fixture: same rules as pandas, and validations that fail loudly."""

from __future__ import annotations

import shutil

import pytest

from olist_delivery import analyze, database, reconcile
from olist_delivery.config import FILES



def _fact(result):
    return database.read_table(result.db_path, "core.fct_orders").set_index("order_id")


def test_fixture_build_passes_every_error_check(fixture_db):
    assert fixture_db.failed_errors.empty, fixture_db.failed_errors.to_string()
    database.assert_valid(fixture_db)


def test_sql_late_rule_uses_calendar_days(fixture_db):
    f = _fact(fixture_db)
    assert f.loc["o1", "delivery_outcome"] == "on_time"
    assert bool(f.loc["o1", "is_late_timestamp_rule"]) is True
    assert f.loc["o2", "delivery_outcome"] == "late"
    assert f.loc["o2", "days_vs_estimate"] == 1
    assert f.loc["o3", "delivery_outcome"] == "delivered_missing_date"
    assert f.loc["o8", "delivery_outcome"] == "not_delivered_status_with_date"


def test_sql_review_rule_keeps_latest_and_shares(fixture_db):
    f = _fact(fixture_db)
    assert f.loc["o1", "review_id"] == "r2"
    assert f.loc["o1", "reviews_for_order"] == 2
    assert f.loc["o5", "review_id"] == f.loc["o6", "review_id"] == "r4"


def test_sql_fan_out_check(fixture_db):
    fan = database.read_table(fixture_db.db_path, "mart.fanout_check").set_index("method")
    src = fan.loc["stg.order_items (source)"]
    naive = fan.loc["naive join orders x payments x items"]
    fact = fan.loc["core.fct_orders (payments pre-aggregated)"]
    assert naive["row_count"] == src["row_count"] + 2  # o5: 2 items x 2 payments = 4 rows instead of 2
    assert float(naive["item_revenue"]) == pytest.approx(float(src["item_revenue"]) + 115.00)
    assert float(fact["item_revenue"]) == pytest.approx(float(src["item_revenue"]))


def test_sql_payment_reconciliation(fixture_db):
    rec = database.read_table(fixture_db.db_path, "mart.payment_reconciliation").set_index("reconciliation_class")
    assert int(rec["orders"].sum()) == 8
    assert float(rec["gap"].sum()) == pytest.approx(27.50)
    assert float(rec.loc["no_items", "gap"]) == pytest.approx(25.00)
    assert float(rec.loc["payments_above_items_installments", "gap"]) == pytest.approx(2.50)


def test_sql_and_pandas_agree_on_the_fixture(fixture_db, fixture_fact):
    fact, items = fixture_fact
    fact = fact.reset_index(drop=True)
    recon = reconcile.reconcile(fixture_db.db_path, analyze.headline_metrics(fact, items),
                                analyze.all_tables(fact, items))
    assert recon["match"].all(), recon[~recon["match"]].to_string()


def test_no_review_text_below_raw(fixture_db):
    cols = database.query(fixture_db.db_path, """
        SELECT table_schema, table_name, column_name FROM information_schema.columns
        WHERE column_name LIKE 'review_comment%'
    """)
    assert set(cols["table_schema"]) == {"raw"}


@pytest.fixture()
def corrupted_dir(tmp_path, fixture_dir):
    d = tmp_path / "raw"
    shutil.copytree(fixture_dir, d)
    with open(d / FILES["order_items"], "a", encoding="utf-8") as fh:
        fh.write("o_missing,1,p1,s1,2017-03-05 10:00:00,9.00,1.00\n")  # item for an order that does not exist
    with open(d / FILES["orders"], "a", encoding="utf-8") as fh:
        fh.write("o1,c1,delivered,2017-03-01 10:00:00,,,,2017-03-10 00:00:00\n")  # duplicate order_id
    return d


def test_build_fails_loudly_on_broken_data(corrupted_dir, tmp_path):
    result = database.build(corrupted_dir, tmp_path / "bad.duckdb", verbose=False)
    failed = set(result.failed_errors["check_name"])
    assert "orphans_items_to_orders" in failed
    assert "pk_orders.order_id" in failed
    with pytest.raises(database.ValidationError):
        database.assert_valid(result)

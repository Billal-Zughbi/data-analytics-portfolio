"""Metric rules checked in pandas on a hand-written eight-order fixture.

Each expected value below can be worked out by hand from tests/fixtures/mini/.
The tests check the rules, not any conclusion about the real data.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from olist_delivery import analyze, clean, ingest
from olist_delivery.config import DELAY_BUCKETS, delay_bucket


# --- late definition ------------------------------------------------------------

def test_delivery_on_the_estimated_day_is_on_time_even_late_in_the_day(fixture_fact):
    fact, _ = fixture_fact
    o1 = fact.loc["o1"]  # delivered 2017-03-10 15:00, estimate 2017-03-10 00:00
    assert o1["days_vs_estimate"] == 0
    assert not o1["is_late"]
    assert o1["is_late_timestamp_rule"]  # the timestamp rule would call it late
    assert o1["delay_bucket"] == "on_day"


def test_delivery_one_calendar_day_after_the_estimate_is_late(fixture_fact):
    fact, _ = fixture_fact
    o2 = fact.loc["o2"]  # delivered 2017-03-12 09:00, estimate 2017-03-11
    assert o2["days_vs_estimate"] == 1
    assert o2["is_late"]
    assert o2["delivery_outcome"] == "late"
    assert o2["delay_bucket"] == "late_1_3"


def test_missing_delivery_dates_are_labelled_and_kept(fixture_fact):
    fact, _ = fixture_fact
    assert len(fact) == 8  # nothing dropped
    o3 = fact.loc["o3"]  # status delivered, no delivery date
    assert o3["delivery_outcome"] == "delivered_missing_date"
    assert not o3["in_timing_population"]
    assert pd.isna(o3["is_late"]) and pd.isna(o3["days_vs_estimate"])
    outcomes = fact["delivery_outcome"].value_counts().to_dict()
    assert outcomes == {"on_time": 2, "late": 2, "delivered_missing_date": 1, "not_delivered": 2,
                        "not_delivered_status_with_date": 1}


def test_only_delivered_status_enters_the_timing_population(fixture_fact):
    fact, _ = fixture_fact
    o8 = fact.loc["o8"]  # canceled but carries a delivery date
    assert o8["delivery_outcome"] == "not_delivered_status_with_date"
    assert not o8["in_timing_population"]
    assert set(fact.index[fact["in_timing_population"]]) == {"o1", "o2", "o5", "o6"}


@pytest.mark.parametrize("days,expected", [
    (-40, "early_15plus"), (-15, "early_15plus"), (-14, "early_8_14"), (-8, "early_8_14"),
    (-7, "early_1_7"), (-1, "early_1_7"), (0, "on_day"), (1, "late_1_3"), (3, "late_1_3"),
    (4, "late_4_7"), (7, "late_4_7"), (8, "late_8_14"), (14, "late_8_14"), (15, "late_15plus"), (200, "late_15plus"),
])
def test_delay_bucket_boundaries(days, expected):
    assert delay_bucket(days) == expected
    assert clean.bucket_series(pd.Series([days], dtype="Int64")).iloc[0] == expected


def test_delay_buckets_are_contiguous_and_only_late_buckets_are_positive():
    for (k1, _, _, hi), (k2, _, lo, _) in zip(DELAY_BUCKETS, DELAY_BUCKETS[1:]):
        assert lo == hi + 1, (k1, k2)
    for key, _, lo, _ in DELAY_BUCKETS:
        assert key.startswith("late") == (lo is not None and lo > 0)


# --- review de-duplication --------------------------------------------------------

def test_latest_answered_review_is_kept(fixture_fact):
    fact, _ = fixture_fact
    o1 = fact.loc["o1"]  # r1 (score 2) answered 03-11, r2 (score 5) answered 03-15
    assert o1["review_id"] == "r2"
    assert o1["review_score"] == 5
    assert o1["reviews_for_order"] == 2


def test_a_review_shared_by_two_orders_stays_on_both(fixture_fact):
    fact, _ = fixture_fact
    assert fact.loc["o5", "review_id"] == fact.loc["o6", "review_id"] == "r4"
    assert fact.loc["o5", "orders_sharing_review"] == 2


def test_review_tie_breaks_use_creation_date_then_review_id():
    ts = pd.Timestamp("2018-01-02 10:00:00")
    reviews = pd.DataFrame({
        "review_id": ["a", "b", "c", "d"],
        "order_id": ["x", "x", "y", "y"],
        "review_score": [1, 5, 2, 4],
        "review_creation_date": [pd.Timestamp("2018-01-01"), pd.Timestamp("2018-01-02"), ts, ts],
        "review_answer_timestamp": [ts, ts, ts, ts],
    })
    out = clean.latest_review_per_order(reviews).set_index("order_id")
    assert out.loc["x", "review_id"] == "b"  # later creation date
    assert out.loc["y", "review_id"] == "d"  # same dates, larger review_id
    assert len(out) == 2


def test_review_text_is_dropped_at_typing(fixture_frames):
    typed = clean.type_reviews(fixture_frames["order_reviews"])
    assert "review_comment_message" not in typed.columns
    assert "review_comment_title" not in typed.columns
    assert typed.set_index("review_id").loc["r2", "has_comment_message"].item() is True


def test_multiline_review_counts_as_one_row(fixture_dir):
    path = ingest.require_files(fixture_dir)["order_reviews"]
    assert ingest.count_csv_rows(path) == 7  # 8 physical lines of data, one quoted newline


# --- revenue vs payment reconciliation ----------------------------------------------

def test_reconciliation_classes_on_fixture(fixture_fact):
    fact, _ = fixture_fact
    cls = fact["reconciliation_class"]
    assert cls["o4"] == "no_items"  # canceled, paid with a voucher, no items
    assert cls["o6"] == "payments_above_items_installments"  # 52.50 paid in 3 installments for 50.00 of items
    assert (cls.drop(["o4", "o6"]) == "match_within_1_cent").all()
    gap = fact["payment_total"].sum() - fact["item_revenue"].sum()
    assert gap == pytest.approx(27.50)
    by_class = (fact["payment_total"] - fact["item_revenue"]).groupby(cls).sum()
    assert by_class.sum() == pytest.approx(gap)  # the whole gap is assigned to classes
    assert by_class["no_items"] == pytest.approx(25.00)
    assert by_class["payments_above_items_installments"] == pytest.approx(2.50)


def test_reconciliation_class_rules_cover_every_branch():
    cls = clean.reconciliation_class(
        n_items=[0, 0, 1, 1, 1, 1, 1],
        payment_rows=[0, 1, 0, 1, 1, 1, 1],
        item_revenue=[0, 0, 10, 10, 10, 10, 10],
        payment_total=[0, 5, 0, 10.005, 12, 11, 9],
        max_installments=[None, 1, None, 1, 4, 1, 1],
    )
    assert list(cls) == ["no_items_no_payments", "no_items", "no_payments", "match_within_1_cent",
                         "payments_above_items_installments", "payments_above_items_single_payment",
                         "payments_below_items"]


def test_vouchers_count_as_payment_so_split_payments_match(fixture_fact):
    fact, _ = fixture_fact
    o5 = fact.loc["o5"]  # 100.00 card + 15.00 voucher for 115.00 of items
    assert o5["payment_total"] == pytest.approx(115.00)
    assert o5["voucher_value"] == pytest.approx(15.00)
    assert o5["reconciliation_class"] == "match_within_1_cent"


# --- fan-out guard ---------------------------------------------------------------------

def test_safe_merge_refuses_to_multiply_rows(fixture_frames):
    items = clean.type_items(fixture_frames["order_items"])
    payments = clean.type_payments(fixture_frames["order_payments"])
    with pytest.raises(clean.FanOutError):
        clean.safe_merge(items, payments, on="order_id")  # o5: 2 items x 2 payments
    ok = clean.safe_merge(items, clean.payment_totals(payments), on="order_id")
    assert len(ok) == len(items)


def test_naive_join_would_double_count_and_the_fact_does_not(fixture_frames, fixture_fact):
    fact, _ = fixture_fact
    items = clean.type_items(fixture_frames["order_items"])
    payments = clean.type_payments(fixture_frames["order_payments"])
    naive = items.merge(payments, on="order_id")
    naive_revenue = (naive["price"] + naive["freight_value"]).sum()
    true_revenue = (items["price"] + items["freight_value"]).sum()
    assert true_revenue == pytest.approx(472.00)
    assert naive_revenue == pytest.approx(472.00 + 115.00)  # o5 counted twice
    assert fact["item_revenue"].sum() == pytest.approx(true_revenue)
    assert fact["payment_total"].sum() == pytest.approx(payments["payment_value"].sum())


# --- attribution and customers --------------------------------------------------------

def test_primary_seller_and_category_follow_item_revenue(fixture_fact):
    fact, _ = fixture_fact
    o5 = fact.loc["o5"]  # s1 (SP) 25.00 of items, s2 (RJ) 90.00 -> s2 is primary
    assert o5["primary_seller_id"] == "s2"
    assert o5["route"] == "RJ → SP"
    assert o5["primary_category"] == "pc_gamer"  # untranslated name kept
    assert fact.loc["o3", "primary_category"] == "unknown"  # blank category


def test_repeat_purchase_uses_customer_unique_id(fixture_fact):
    fact, _ = fixture_fact
    rep = analyze.customer_repeat(fact)
    # u1 placed o1 and o5 under two different customer_ids on different days.
    assert rep["customers"] == 4  # u1, u2, u3, u5 have status-delivered orders
    assert rep["repeat_customers"] == 1
    assert rep["repeat_rate"] == pytest.approx(0.25)


def test_answered_before_delivery_flag(fixture_fact):
    fact, _ = fixture_fact
    assert fact.loc["o2", "review_answered_before_delivery"]  # answered 03-11 12:00, delivered 03-12 09:00
    assert not fact.loc["o1", "review_answered_before_delivery"]


# --- headline metrics -------------------------------------------------------------------

def test_headline_metrics_on_fixture(fixture_fact):
    fact, items = fixture_fact
    m = analyze.headline_metrics(fact.reset_index(drop=True), items)
    assert m["orders_total"] == 8
    assert m["timing_population_orders"] == 4
    assert m["late_orders"] == 2
    assert m["late_rate"] == pytest.approx(0.5)
    assert m["late_rate_timestamp_rule"] == pytest.approx(0.75)
    assert m["avg_score_on_time"] == pytest.approx((5 + 4) / 2)
    assert m["avg_score_late"] == pytest.approx((1 + 4) / 2)
    assert m["pct_1star_late"] == pytest.approx(0.5)
    assert m["delivered_missing_date_orders"] == 1
    assert m["not_delivered_orders"] == 3


def test_rates_are_ratios_of_sums_not_means_of_rates():
    fact = pd.DataFrame({
        "in_timing_population": [True] * 4,
        "is_late": pd.array([True, False, False, False], dtype="boolean"),
        "route": ["A → B", "A → B", "A → B", "C → D"],
        "review_score": pd.array([1, 5, 5, 5], dtype="Int64"),
        "order_id": list("wxyz"),
    })
    g = analyze.group_performance(fact, ["route"], min_orders=1).set_index("route")
    assert g.loc["A → B", "late_rate"] == pytest.approx(1 / 3)
    assert g["late_orders"].sum() / g["delivered_orders"].sum() == pytest.approx(0.25)
    assert g["late_rate"].mean() != pytest.approx(0.25)  # why averages of rates are not used


def test_wilson_interval_matches_known_values():
    lo, hi = analyze.wilson_interval(np.array([5, 0]), np.array([10, 20]))
    assert lo[0] == pytest.approx(0.2366, abs=1e-4) and hi[0] == pytest.approx(0.7634, abs=1e-4)
    assert lo[1] == pytest.approx(0.0, abs=1e-12) and hi[1] == pytest.approx(0.1611, abs=1e-4)


def test_missing_folder_gives_instructions(tmp_path):
    with pytest.raises(ingest.MissingDataError, match="kaggle datasets download"):
        ingest.require_files(tmp_path / "nope")
    with pytest.raises(ingest.MissingDataError, match="9 of 9 Olist files missing"):
        ingest.require_files(tmp_path)

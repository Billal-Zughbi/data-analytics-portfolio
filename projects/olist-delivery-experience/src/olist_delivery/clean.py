"""Typed tables and metric rules in pandas.

This is a second, independent implementation of the rules in
sql/01_staging.sql and sql/02_transformations.sql. It never reads the DuckDB
database. reconcile.py compares the two.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import DELAY_BUCKETS, MONEY_TOLERANCE

TS_FORMAT = "%Y-%m-%d %H:%M:%S"
ORDER_TS_COLUMNS = [
    "order_purchase_timestamp",
    "order_approved_at",
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "order_estimated_delivery_date",
]


class FanOutError(ValueError):
    """A join changed the row count of the left table."""


def safe_merge(left: pd.DataFrame, right: pd.DataFrame, on, how: str = "left", validate: str = "many_to_one",
               **kwargs) -> pd.DataFrame:
    """Merge that refuses to multiply rows.

    pandas' own `validate` catches duplicate keys on the right; the row-count
    assertion catches anything else (for example a many-to-many on a
    composite key that someone relabelled as many-to-one).
    """
    try:
        out = left.merge(right, on=on, how=how, validate=validate, **kwargs)
    except pd.errors.MergeError as exc:
        raise FanOutError(str(exc)) from exc
    if how == "left" and len(out) != len(left):
        raise FanOutError(f"join on {on} changed rows from {len(left)} to {len(out)}")
    return out


def _ts(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s, format=TS_FORMAT, errors="coerce")


def _money(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s, errors="coerce").round(2)


# ---------------------------------------------------------------------------
# Typing (mirrors 01_staging.sql)
# ---------------------------------------------------------------------------

def type_orders(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    df["order_id"] = df["order_id"].str.strip()
    df["customer_id"] = df["customer_id"].str.strip()
    df["order_status"] = df["order_status"].str.strip().str.lower()
    for col in ORDER_TS_COLUMNS:
        df[col] = _ts(df[col])
    return df


def type_customers(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    for col in ["customer_id", "customer_unique_id", "customer_city"]:
        df[col] = df[col].str.strip()
    df["customer_zip_code_prefix"] = df["customer_zip_code_prefix"].str.strip().str.zfill(5)
    df["customer_state"] = df["customer_state"].str.strip().str.upper()
    return df


def type_items(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    for col in ["order_id", "product_id", "seller_id"]:
        df[col] = df[col].str.strip()
    df["order_item_id"] = pd.to_numeric(df["order_item_id"], errors="coerce").astype("Int64")
    df["shipping_limit_date"] = _ts(df["shipping_limit_date"])
    df["price"] = _money(df["price"])
    df["freight_value"] = _money(df["freight_value"])
    return df


def type_payments(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    df["order_id"] = df["order_id"].str.strip()
    df["payment_sequential"] = pd.to_numeric(df["payment_sequential"], errors="coerce").astype("Int64")
    df["payment_type"] = df["payment_type"].str.strip().str.lower()
    df["payment_installments"] = pd.to_numeric(df["payment_installments"], errors="coerce").astype("Int64")
    df["payment_value"] = _money(df["payment_value"])
    return df


def type_reviews(raw: pd.DataFrame) -> pd.DataFrame:
    """Typed reviews with the free text replaced by presence flags."""
    df = raw.copy()
    df["review_id"] = df["review_id"].str.strip()
    df["order_id"] = df["order_id"].str.strip()
    df["review_score"] = pd.to_numeric(df["review_score"], errors="coerce").astype("Int64")
    df["has_comment_title"] = df["review_comment_title"].fillna("").str.strip().str.len() > 0
    df["has_comment_message"] = df["review_comment_message"].fillna("").str.strip().str.len() > 0
    df["review_creation_date"] = _ts(df["review_creation_date"])
    df["review_answer_timestamp"] = _ts(df["review_answer_timestamp"])
    return df.drop(columns=["review_comment_title", "review_comment_message"])


def type_products(raw: pd.DataFrame, translation: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    df["product_id"] = df["product_id"].str.strip()
    name = df["product_category_name"].fillna("").str.strip()
    tr = translation.copy()
    tr.columns = [c.strip().lstrip("﻿") for c in tr.columns]
    tr = tr.assign(product_category_name=tr["product_category_name"].str.strip(),
                   product_category_name_english=tr["product_category_name_english"].str.strip())
    mapping = dict(zip(tr["product_category_name"], tr["product_category_name_english"]))
    english = name.map(mapping)
    df["product_category_name"] = name.replace("", np.nan)
    df["category"] = np.where(name == "", "unknown", english.fillna(name))
    df["category_source"] = np.select([name == "", english.isna()], ["missing", "untranslated"], "translated")
    return df


def type_sellers(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    df["seller_id"] = df["seller_id"].str.strip()
    df["seller_zip_code_prefix"] = df["seller_zip_code_prefix"].str.strip().str.zfill(5)
    df["seller_state"] = df["seller_state"].str.strip().str.upper()
    return df


# ---------------------------------------------------------------------------
# Rules (mirror 02_transformations.sql)
# ---------------------------------------------------------------------------

def bucket_series(days: pd.Series) -> pd.Series:
    """Delay bucket key per value, NaN outside the timing population."""
    out = pd.Series(pd.NA, index=days.index, dtype="object")
    for key, _, lo, hi in DELAY_BUCKETS:
        mask = days.notna()
        if lo is not None:
            mask &= days >= lo
        if hi is not None:
            mask &= days <= hi
        out[mask] = key
    return out


def delivery_outcomes(orders: pd.DataFrame) -> pd.DataFrame:
    """Add the timing population, lateness and day counts to typed orders.

    late = the delivered calendar date is after the estimated calendar date.
    Orders with status 'delivered' but no delivery date are labelled
    'delivered_missing_date' and kept, never dropped.
    """
    df = orders.copy()
    delivered = df["order_delivered_customer_date"]
    estimated = df["order_estimated_delivery_date"]
    purchase_date = df["order_purchase_timestamp"].dt.normalize()
    est_date = estimated.dt.normalize()
    del_date = delivered.dt.normalize()
    carrier_date = df["order_delivered_carrier_date"].dt.normalize()

    timing = (df["order_status"] == "delivered") & delivered.notna() & estimated.notna()
    days = (del_date - est_date).dt.days.where(timing)

    df["purchase_date"] = purchase_date
    df["purchase_month"] = df["order_purchase_timestamp"].dt.to_period("M").astype(str)
    df["in_timing_population"] = timing
    df["days_vs_estimate"] = days.astype("Int64")
    df["is_late"] = (days > 0).where(timing).astype("boolean")
    df["is_late_timestamp_rule"] = (delivered > estimated).where(timing).astype("boolean")
    df["delay_bucket"] = bucket_series(days)
    df["promised_days"] = (est_date - purchase_date).dt.days.astype("Int64")
    df["actual_days"] = (del_date - purchase_date).dt.days.where(timing).astype("Int64")
    legs_ok = timing & (carrier_date >= purchase_date) & (del_date >= carrier_date)
    df["seller_handling_days"] = (carrier_date - purchase_date).dt.days.where(legs_ok).astype("Int64")
    df["carrier_transit_days"] = (del_date - carrier_date).dt.days.where(legs_ok).astype("Int64")

    outcome = np.select(
        [
            timing & (days > 0),
            timing,
            df["order_status"] == "delivered",
            delivered.notna(),
        ],
        ["late", "on_time", "delivered_missing_date", "not_delivered_status_with_date"],
        "not_delivered",
    )
    df["delivery_outcome"] = outcome
    return df


def latest_review_per_order(reviews: pd.DataFrame) -> pd.DataFrame:
    """One review per order: the latest answer.

    Order of precedence: review_answer_timestamp, then review_creation_date,
    then review_id (all descending, missing values last). A review shared by
    several orders stays attached to each of them.
    """
    r = reviews.copy()
    r["reviews_for_order"] = r.groupby("order_id")["review_id"].transform("size")
    r["orders_sharing_review"] = r.groupby("review_id")["order_id"].transform("size")
    r = r.sort_values(
        ["order_id", "review_answer_timestamp", "review_creation_date", "review_id"],
        ascending=[True, False, False, False],
        na_position="last",
        kind="mergesort",
    )
    return r.drop_duplicates("order_id", keep="first").reset_index(drop=True)


def item_fact(items: pd.DataFrame, orders: pd.DataFrame, customers: pd.DataFrame,
              products: pd.DataFrame, sellers: pd.DataFrame) -> pd.DataFrame:
    """Item grain (order_id, order_item_id) with seller state, category and status."""
    f = safe_merge(items, orders[["order_id", "customer_id", "order_status", "order_purchase_timestamp"]], on="order_id")
    f = safe_merge(f, customers[["customer_id", "customer_state"]], on="customer_id")
    f = safe_merge(f, products[["product_id", "category"]], on="product_id")
    f = safe_merge(f, sellers[["seller_id", "seller_state"]], on="seller_id")
    f["category"] = f["category"].fillna("unknown")
    f["item_revenue"] = (f["price"] + f["freight_value"]).round(2)
    f["purchase_month"] = f["order_purchase_timestamp"].dt.to_period("M").astype(str)
    return f


def primary_by(item_fact_df: pd.DataFrame, key: str, out_name: str) -> pd.DataFrame:
    """Per order, the value of `key` with the most item revenue (ties: smallest key)."""
    g = item_fact_df.groupby(["order_id", key], as_index=False)["item_revenue"].sum()
    g = g.sort_values(["order_id", "item_revenue", key], ascending=[True, False, True], kind="mergesort")
    return g.drop_duplicates("order_id")[["order_id", key]].rename(columns={key: out_name})


def payment_totals(payments: pd.DataFrame) -> pd.DataFrame:
    p = payments.copy()
    p["voucher"] = p["payment_value"].where(p["payment_type"] == "voucher", 0.0)
    out = p.groupby("order_id").agg(
        payment_rows=("payment_value", "size"),
        payment_total=("payment_value", "sum"),
        voucher_value=("voucher", "sum"),
        max_installments=("payment_installments", "max"),
    ).reset_index()
    out["payment_total"] = out["payment_total"].round(2)
    return out


def reconciliation_class(n_items, payment_rows, item_revenue, payment_total, max_installments) -> np.ndarray:
    """Classify each order's payments-vs-items comparison (same rules as SQL)."""
    n_items = np.asarray(n_items)
    payment_rows = np.asarray(payment_rows)
    item_revenue = np.asarray(item_revenue, dtype=float)
    payment_total = np.asarray(payment_total, dtype=float)
    inst = pd.to_numeric(pd.Series(np.asarray(max_installments, dtype=object)), errors="coerce").fillna(0).to_numpy()
    gap = payment_total - item_revenue
    return np.select(
        [
            (n_items == 0) & (payment_rows == 0),
            n_items == 0,
            payment_rows == 0,
            np.abs(gap) <= MONEY_TOLERANCE + 1e-9,
            (gap > 0) & (inst > 1),
            gap > 0,
        ],
        [
            "no_items_no_payments",
            "no_items",
            "no_payments",
            "match_within_1_cent",
            "payments_above_items_installments",
            "payments_above_items_single_payment",
        ],
        "payments_below_items",
    )


def order_fact(frames: dict[str, pd.DataFrame]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build (order fact, item fact) from raw string frames."""
    orders = delivery_outcomes(type_orders(frames["orders"]))
    customers = type_customers(frames["customers"])
    items = type_items(frames["order_items"])
    payments = type_payments(frames["order_payments"])
    reviews = type_reviews(frames["order_reviews"])
    products = type_products(frames["products"], frames["category_translation"])
    sellers = type_sellers(frames["sellers"])

    items_f = item_fact(items, orders, customers, products, sellers)

    item_agg = items_f.groupby("order_id").agg(
        n_items=("order_item_id", "size"),
        n_sellers=("seller_id", "nunique"),
        item_price=("price", "sum"),
        item_freight=("freight_value", "sum"),
        item_revenue=("item_revenue", "sum"),
    ).reset_index()
    for c in ["item_price", "item_freight", "item_revenue"]:
        item_agg[c] = item_agg[c].round(2)

    fact = safe_merge(orders, customers[["customer_id", "customer_unique_id", "customer_state"]], on="customer_id")
    fact = safe_merge(fact, item_agg, on="order_id", validate="one_to_one")
    fact = safe_merge(fact, payment_totals(payments), on="order_id", validate="one_to_one")
    fact = safe_merge(fact, primary_by(items_f, "seller_id", "primary_seller_id"), on="order_id", validate="one_to_one")
    fact = safe_merge(fact, sellers[["seller_id", "seller_state"]].rename(
        columns={"seller_id": "primary_seller_id", "seller_state": "primary_seller_state"}), on="primary_seller_id")
    fact = safe_merge(fact, primary_by(items_f, "category", "primary_category"), on="order_id", validate="one_to_one")
    review = latest_review_per_order(reviews)[
        ["order_id", "review_id", "review_score", "review_answer_timestamp", "reviews_for_order", "orders_sharing_review"]
    ]
    fact = safe_merge(fact, review, on="order_id", validate="one_to_one")

    for c in ["n_items", "n_sellers", "payment_rows"]:
        fact[c] = fact[c].fillna(0).astype(int)
    for c in ["item_price", "item_freight", "item_revenue", "payment_total", "voucher_value"]:
        fact[c] = fact[c].fillna(0.0)
    fact["route"] = np.where(
        fact["primary_seller_state"].notna(),
        fact["primary_seller_state"].fillna("") + " → " + fact["customer_state"].fillna(""),
        None,
    )
    fact["review_answered_before_delivery"] = (
        fact["review_answer_timestamp"] < fact["order_delivered_customer_date"]
    ).where(fact["in_timing_population"] & fact["review_answer_timestamp"].notna()).astype("boolean")

    delivered = fact["order_status"] == "delivered"
    seq = fact.loc[delivered].sort_values(["customer_unique_id", "order_purchase_timestamp", "order_id"], kind="mergesort")
    seq = seq.assign(customer_delivered_order_seq=seq.groupby("customer_unique_id").cumcount() + 1)
    seq["customer_purchase_day_seq"] = seq.groupby("customer_unique_id")["purchase_date"].rank(method="dense").astype(int)
    fact = safe_merge(fact, seq[["order_id", "customer_delivered_order_seq", "customer_purchase_day_seq"]],
                      on="order_id", validate="one_to_one")
    fact["reconciliation_class"] = reconciliation_class(
        fact["n_items"], fact["payment_rows"], fact["item_revenue"], fact["payment_total"], fact["max_installments"]
    )
    return fact, items_f

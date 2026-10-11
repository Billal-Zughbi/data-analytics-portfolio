"""Data contract on the real Olist files. Skips when they are not on this machine.

Point $OLIST_DATA_DIR at the folder with the nine CSVs (or put them in
data/raw/) to run these. They check structure and rules, not results.
"""

from __future__ import annotations

import csv

import pytest

from olist_delivery import analyze, clean, database, ingest, reconcile
from olist_delivery.config import EXPECTED_ROWS_KAGGLE_V2, EXPECTED_ROWS_MIRROR, FILES

from conftest import real_data_dir

DATA_DIR = real_data_dir()
pytestmark = pytest.mark.skipif(
    DATA_DIR is None,
    reason="Olist raw CSVs not found: set OLIST_DATA_DIR or copy the nine files into data/raw/ to run the data contract",
)

EXPECTED_COLUMNS = {
    "orders": ["order_id", "customer_id", "order_status", "order_purchase_timestamp", "order_approved_at",
               "order_delivered_carrier_date", "order_delivered_customer_date", "order_estimated_delivery_date"],
    "customers": ["customer_id", "customer_unique_id", "customer_zip_code_prefix", "customer_city", "customer_state"],
    "order_items": ["order_id", "order_item_id", "product_id", "seller_id", "shipping_limit_date", "price",
                    "freight_value"],
    "order_payments": ["order_id", "payment_sequential", "payment_type", "payment_installments", "payment_value"],
    "order_reviews": ["review_id", "order_id", "review_score", "review_comment_title", "review_comment_message",
                      "review_creation_date", "review_answer_timestamp"],
    "products": ["product_id", "product_category_name", "product_name_lenght", "product_description_lenght",
                 "product_photos_qty", "product_weight_g", "product_length_cm", "product_height_cm", "product_width_cm"],
    "sellers": ["seller_id", "seller_zip_code_prefix", "seller_city", "seller_state"],
    "geolocation": ["geolocation_zip_code_prefix", "geolocation_lat", "geolocation_lng", "geolocation_city",
                    "geolocation_state"],
    "category_translation": ["product_category_name", "product_category_name_english"],
}


@pytest.fixture(scope="module")
def source_check():
    return ingest.check_sources(DATA_DIR, hashes=True)


@pytest.fixture(scope="module")
def real_build(tmp_path_factory):
    return database.build(DATA_DIR, tmp_path_factory.mktemp("real") / "olist.duckdb", verbose=False)


@pytest.fixture(scope="module")
def real_pandas():
    frames = ingest.read_raw(DATA_DIR)
    return clean.order_fact(frames)


def test_headers_match_the_published_layout():
    for key, expected in EXPECTED_COLUMNS.items():
        with open(DATA_DIR / FILES[key], newline="", encoding="utf-8-sig") as fh:
            assert next(csv.reader(fh)) == expected, key


def test_row_counts_match_a_known_release(source_check):
    assert source_check.ok, source_check.problems
    assert source_check.rows in (EXPECTED_ROWS_KAGGLE_V2, EXPECTED_ROWS_MIRROR)


def test_every_error_check_passes_on_real_data(real_build):
    assert real_build.failed_errors.empty, real_build.failed_errors.to_string()


def test_every_order_is_accounted_for(real_build, source_check):
    pop = database.read_table(real_build.db_path, "mart.delivery_population")
    assert int(pop["orders"].sum()) == source_check.rows["orders"]
    assert set(pop["delivery_outcome"]) <= {"on_time", "late", "delivered_missing_date", "not_delivered",
                                            "not_delivered_status_with_date"}


def test_sql_and_pandas_reconcile_on_real_data(real_build, real_pandas):
    fact, items = real_pandas
    recon = reconcile.reconcile(real_build.db_path, analyze.headline_metrics(fact, items),
                                analyze.all_tables(fact, items))
    assert recon["match"].all(), recon[~recon["match"]].to_string()


def test_pandas_fact_keeps_one_row_per_order(real_pandas, source_check):
    fact, items = real_pandas
    assert len(fact) == source_check.rows["orders"] and fact["order_id"].is_unique
    assert len(items) == source_check.rows["order_items"]

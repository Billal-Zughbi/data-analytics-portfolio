"""Paths, source metadata and the analysis rules that every module shares.

Rules live here once so that the SQL runner, the pandas pipeline, the exports
and the tests all use the same thresholds.
"""

from __future__ import annotations

import os
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = PROJECT_DIR.parents[1]
SQL_DIR = PROJECT_DIR / "sql"
OUTPUTS_DIR = PROJECT_DIR / "outputs"
ANALYSIS_DIR = OUTPUTS_DIR / "analysis"
FIGURES_DIR = OUTPUTS_DIR / "figures"
SAMPLE_DIR = PROJECT_DIR / "data" / "sample"
# data/interim/ is git-ignored by the repository's .gitignore (projects/**/data/interim/).
DEFAULT_DB_PATH = PROJECT_DIR / "data" / "interim" / "olist.duckdb"
DEFAULT_RAW_DIR = PROJECT_DIR / "data" / "raw"
SITE_DATA_DIR = REPO_DIR / "website" / "src" / "data" / "generated" / "olist-delivery-experience"

DATA_DIR_ENV = "OLIST_DATA_DIR"

# ---------------------------------------------------------------------------
# Source files. Keys are the short names used everywhere else in the package.
# ---------------------------------------------------------------------------
FILES = {
    "customers": "olist_customers_dataset.csv",
    "geolocation": "olist_geolocation_dataset.csv",
    "order_items": "olist_order_items_dataset.csv",
    "order_payments": "olist_order_payments_dataset.csv",
    "order_reviews": "olist_order_reviews_dataset.csv",
    "orders": "olist_orders_dataset.csv",
    "products": "olist_products_dataset.csv",
    "sellers": "olist_sellers_dataset.csv",
    "category_translation": "product_category_name_translation.csv",
}

# Row counts (excluding the header) parsed with a CSV reader, so multi-line
# review comments count as one row. Kaggle v2 is the published version; the
# GitHub mirror used for this run differs only in the reviews file, which is
# an earlier 100,000-row release (see docs/data-quality-report.md).
EXPECTED_ROWS_KAGGLE_V2 = {
    "customers": 99_441,
    "geolocation": 1_000_163,
    "order_items": 112_650,
    "order_payments": 103_886,
    "order_reviews": 99_224,
    "orders": 99_441,
    "products": 32_951,
    "sellers": 3_095,
    "category_translation": 71,
}
EXPECTED_ROWS_MIRROR = {**EXPECTED_ROWS_KAGGLE_V2, "order_reviews": 100_000}

# SHA-256 of the mirror files retrieved on 2026-10-11 (also in the private
# SHA256SUMS next to the raw files). Used only to say which version is loaded.
MIRROR_SHA256 = {
    "customers": "983a422239e1712ded753b3bf9ecf47dc73f144d306029dcfa99e70a226883d2",
    "geolocation": "b514f6fc991b9566aeba02aa5d67e2c3630f034b60a0e05aa0d082a3b66d88d6",
    "order_items": "0bc4d068c4fe38cbb01bd90e8746e3c613fe7b4baef75fab7b0e329701c3e279",
    "order_payments": "4f713964f2815dbbaa40b9488268c55aac3627bfce5aa96cf58d1f3616de3cc0",
    "order_reviews": "0dff69f6fed33a13648020198ea94d7ae12afbdd4904186c6cd904e27a3e1ccd",
    "orders": "8df58ef3d2d7e9944010f7beecd9b75367f5588ec6e3c91cec19ae3345ef9ecf",
    "products": "3e6569628a17fbc75fd206ee357b59e20364b9afa90f5b6cd5b4d624c58aa9cc",
    "sellers": "1f643d2b950373b85735e7794b20986f528d7a000432e7c6f9bcbb44d0846a0e",
    "category_translation": "a81f0d1f27b27e7293f761bc79e3ce8f348ee39c4b3ed3e49bde38f478586278",
}

SOURCE = {
    "name": "Brazilian E-Commerce Public Dataset by Olist",
    "publisher": "Olist",
    "url": "https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce",
    "license": "CC BY-NC-SA 4.0",
    "kaggle_version": 2,
    "kaggle_last_updated": "2021-10-01",
    "kaggle_total_bytes": 126_186_995,
    "retrieved": "2026-10-11T19:24:00Z",
    "mirror_url": "https://raw.githubusercontent.com/dujiaying/olist/master/data/",
    "mirror_total_bytes": 126_144_332,
}

ATTRIBUTION = (
    "Derived from the Brazilian E-Commerce Public Dataset by Olist "
    "(https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce), licensed CC BY-NC-SA 4.0. "
    "Aggregates only; shared under the same licence for non-commercial use."
)

# ---------------------------------------------------------------------------
# Analysis rules
# ---------------------------------------------------------------------------
# Purchase months shown in the monthly series. 2016 has three sparse months
# (1, 265 and 1 delivered orders) and Sep-Oct 2018 have no delivered orders.
MONTH_START = "2017-01"
MONTH_END = "2018-08"

# Days vs estimate buckets: delivered date minus estimated date, in whole days.
# Each tuple is (key, label, lower bound inclusive, upper bound inclusive).
DELAY_BUCKETS = [
    ("early_15plus", "15+ days early", None, -15),
    ("early_8_14", "8-14 days early", -14, -8),
    ("early_1_7", "1-7 days early", -7, -1),
    ("on_day", "On the estimated day", 0, 0),
    ("late_1_3", "1-3 days late", 1, 3),
    ("late_4_7", "4-7 days late", 4, 7),
    ("late_8_14", "8-14 days late", 8, 14),
    ("late_15plus", "15+ days late", 15, None),
]

# Routes and categories need this many delivered orders before their late
# rate is ranked or shown on the site; smaller groups go to "other".
MIN_GROUP_ORDERS = 100
WILSON_Z = 1.96

# Money values are compared to the cent.
MONEY_TOLERANCE = 0.01


def resolve_data_dir(cli_value: str | os.PathLike | None = None) -> Path:
    """Raw CSV folder: --data-dir, then $OLIST_DATA_DIR, then data/raw/."""
    if cli_value:
        return Path(cli_value).expanduser().resolve()
    env = os.environ.get(DATA_DIR_ENV)
    if env:
        return Path(env).expanduser().resolve()
    return DEFAULT_RAW_DIR


def delay_bucket(days: int | float | None) -> str | None:
    """Bucket key for a days-vs-estimate value (None when not delivered)."""
    if days is None or days != days:  # NaN check without numpy
        return None
    for key, _, lo, hi in DELAY_BUCKETS:
        if (lo is None or days >= lo) and (hi is None or days <= hi):
            return key
    raise ValueError(days)

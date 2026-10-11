-- =============================================================================
-- 00_schema.sql: schemas and raw landing tables
-- Dialect: DuckDB 1.5 (tested with 1.5.6). DuckDB-specific features used in this
-- folder: SET VARIABLE / getvariable(), read_csv(), CREATE OR REPLACE TABLE,
-- QUALIFY, date_diff(), quantile_cont(), median(), string_agg(... ORDER BY),
-- FILTER (WHERE ...) on aggregates, and boolean-to-integer casts.
--
-- The runner (python -m olist_delivery build) sets one variable before this file:
--   SET VARIABLE olist_data_dir = '/absolute/path/to/raw/csvs';
-- To run by hand in the DuckDB CLI, set it yourself and then run 00 to 04 in order.
--
-- Layers
--   raw   text exactly as landed (every column VARCHAR, nothing dropped)
--   stg   typed, trimmed, one table per source file; review free text removed
--   core  order-level and item-level facts with documented grain
--   mart  analysis tables read by the exporter and the reconciliation step
--   qa    validation results (04_validation.sql)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS stg;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS mart;
CREATE SCHEMA IF NOT EXISTS qa;

-- Landing tables are declared explicitly so a changed source layout fails here
-- (column count mismatch) instead of shifting columns silently.

CREATE OR REPLACE TABLE raw.orders (
    order_id                       VARCHAR,
    customer_id                    VARCHAR,
    order_status                   VARCHAR,
    order_purchase_timestamp       VARCHAR,
    order_approved_at              VARCHAR,
    order_delivered_carrier_date   VARCHAR,
    order_delivered_customer_date  VARCHAR,
    order_estimated_delivery_date  VARCHAR
);

CREATE OR REPLACE TABLE raw.customers (
    customer_id               VARCHAR,
    customer_unique_id        VARCHAR,
    customer_zip_code_prefix  VARCHAR,
    customer_city             VARCHAR,
    customer_state            VARCHAR
);

CREATE OR REPLACE TABLE raw.order_items (
    order_id             VARCHAR,
    order_item_id        VARCHAR,
    product_id           VARCHAR,
    seller_id            VARCHAR,
    shipping_limit_date  VARCHAR,
    price                VARCHAR,
    freight_value        VARCHAR
);

CREATE OR REPLACE TABLE raw.order_payments (
    order_id              VARCHAR,
    payment_sequential    VARCHAR,
    payment_type          VARCHAR,
    payment_installments  VARCHAR,
    payment_value         VARCHAR
);

-- Holds review free text. This table stays in the local database file only;
-- nothing downstream of stg selects the comment columns.
CREATE OR REPLACE TABLE raw.order_reviews (
    review_id                VARCHAR,
    order_id                 VARCHAR,
    review_score             VARCHAR,
    review_comment_title     VARCHAR,
    review_comment_message   VARCHAR,
    review_creation_date     VARCHAR,
    review_answer_timestamp  VARCHAR
);

CREATE OR REPLACE TABLE raw.products (
    product_id                  VARCHAR,
    product_category_name       VARCHAR,
    product_name_lenght         VARCHAR,  -- source spelling kept
    product_description_lenght  VARCHAR,  -- source spelling kept
    product_photos_qty          VARCHAR,
    product_weight_g            VARCHAR,
    product_length_cm           VARCHAR,
    product_height_cm           VARCHAR,
    product_width_cm            VARCHAR
);

CREATE OR REPLACE TABLE raw.sellers (
    seller_id               VARCHAR,
    seller_zip_code_prefix  VARCHAR,
    seller_city             VARCHAR,
    seller_state            VARCHAR
);

CREATE OR REPLACE TABLE raw.geolocation (
    geolocation_zip_code_prefix  VARCHAR,
    geolocation_lat              VARCHAR,
    geolocation_lng              VARCHAR,
    geolocation_city             VARCHAR,
    geolocation_state            VARCHAR
);

CREATE OR REPLACE TABLE raw.category_translation (
    product_category_name          VARCHAR,
    product_category_name_english  VARCHAR
);

-- Load. all_varchar keeps leading zeros in zip prefixes and lets 01_staging.sql
-- count cast failures instead of the reader guessing types. Quoted fields may
-- contain newlines (review comments), which read_csv handles.

INSERT INTO raw.orders SELECT * FROM read_csv(
    getvariable('olist_data_dir') || '/olist_orders_dataset.csv',
    header = true, delim = ',', quote = '"', escape = '"', all_varchar = true);

INSERT INTO raw.customers SELECT * FROM read_csv(
    getvariable('olist_data_dir') || '/olist_customers_dataset.csv',
    header = true, delim = ',', quote = '"', escape = '"', all_varchar = true);

INSERT INTO raw.order_items SELECT * FROM read_csv(
    getvariable('olist_data_dir') || '/olist_order_items_dataset.csv',
    header = true, delim = ',', quote = '"', escape = '"', all_varchar = true);

INSERT INTO raw.order_payments SELECT * FROM read_csv(
    getvariable('olist_data_dir') || '/olist_order_payments_dataset.csv',
    header = true, delim = ',', quote = '"', escape = '"', all_varchar = true);

INSERT INTO raw.order_reviews SELECT * FROM read_csv(
    getvariable('olist_data_dir') || '/olist_order_reviews_dataset.csv',
    header = true, delim = ',', quote = '"', escape = '"', all_varchar = true);

INSERT INTO raw.products SELECT * FROM read_csv(
    getvariable('olist_data_dir') || '/olist_products_dataset.csv',
    header = true, delim = ',', quote = '"', escape = '"', all_varchar = true);

INSERT INTO raw.sellers SELECT * FROM read_csv(
    getvariable('olist_data_dir') || '/olist_sellers_dataset.csv',
    header = true, delim = ',', quote = '"', escape = '"', all_varchar = true);

INSERT INTO raw.geolocation SELECT * FROM read_csv(
    getvariable('olist_data_dir') || '/olist_geolocation_dataset.csv',
    header = true, delim = ',', quote = '"', escape = '"', all_varchar = true);

INSERT INTO raw.category_translation SELECT * FROM read_csv(
    getvariable('olist_data_dir') || '/product_category_name_translation.csv',
    header = true, delim = ',', quote = '"', escape = '"', all_varchar = true);

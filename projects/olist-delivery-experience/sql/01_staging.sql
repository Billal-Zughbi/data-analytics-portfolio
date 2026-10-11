-- =============================================================================
-- 01_staging.sql: typed staging tables (one per source file)
-- Dialect: DuckDB 1.5.
-- * TRY_CAST so a bad value becomes NULL; 04_validation.sql counts every value
--   that was present in raw but NULL after the cast (expected: 0).
-- * Money as DECIMAL(12,2) so totals reconcile to the cent.
-- * Column names follow the source so the data dictionary maps one to one.
-- * Review comment text is reduced to presence flags. No free text below raw.
-- =============================================================================

CREATE OR REPLACE TABLE stg.orders AS
SELECT
    trim(order_id)                                          AS order_id,
    trim(customer_id)                                       AS customer_id,
    lower(trim(order_status))                               AS order_status,
    TRY_CAST(order_purchase_timestamp AS TIMESTAMP)         AS order_purchase_timestamp,
    TRY_CAST(order_approved_at AS TIMESTAMP)                AS order_approved_at,
    TRY_CAST(order_delivered_carrier_date AS TIMESTAMP)     AS order_delivered_carrier_date,
    TRY_CAST(order_delivered_customer_date AS TIMESTAMP)    AS order_delivered_customer_date,
    TRY_CAST(order_estimated_delivery_date AS TIMESTAMP)    AS order_estimated_delivery_date
FROM raw.orders;

CREATE OR REPLACE TABLE stg.customers AS
SELECT
    trim(customer_id)                     AS customer_id,
    trim(customer_unique_id)              AS customer_unique_id,
    lpad(trim(customer_zip_code_prefix), 5, '0') AS customer_zip_code_prefix,
    trim(customer_city)                   AS customer_city,
    upper(trim(customer_state))           AS customer_state
FROM raw.customers;

CREATE OR REPLACE TABLE stg.order_items AS
SELECT
    trim(order_id)                                  AS order_id,
    TRY_CAST(order_item_id AS INTEGER)              AS order_item_id,
    trim(product_id)                                AS product_id,
    trim(seller_id)                                 AS seller_id,
    TRY_CAST(shipping_limit_date AS TIMESTAMP)      AS shipping_limit_date,
    TRY_CAST(price AS DECIMAL(12, 2))               AS price,
    TRY_CAST(freight_value AS DECIMAL(12, 2))       AS freight_value
FROM raw.order_items;

CREATE OR REPLACE TABLE stg.order_payments AS
SELECT
    trim(order_id)                                  AS order_id,
    TRY_CAST(payment_sequential AS INTEGER)         AS payment_sequential,
    lower(trim(payment_type))                       AS payment_type,
    TRY_CAST(payment_installments AS INTEGER)       AS payment_installments,
    TRY_CAST(payment_value AS DECIMAL(12, 2))       AS payment_value
FROM raw.order_payments;

-- review_creation_date is when Olist sent the satisfaction survey;
-- review_answer_timestamp is when the customer answered it.
CREATE OR REPLACE TABLE stg.order_reviews AS
SELECT
    trim(review_id)                                         AS review_id,
    trim(order_id)                                          AS order_id,
    TRY_CAST(review_score AS INTEGER)                       AS review_score,
    coalesce(length(trim(review_comment_title)), 0) > 0     AS has_comment_title,
    coalesce(length(trim(review_comment_message)), 0) > 0   AS has_comment_message,
    TRY_CAST(review_creation_date AS TIMESTAMP)             AS review_creation_date,
    TRY_CAST(review_answer_timestamp AS TIMESTAMP)          AS review_answer_timestamp
FROM raw.order_reviews;

CREATE OR REPLACE TABLE stg.category_translation AS
SELECT
    trim(product_category_name)          AS product_category_name,
    trim(product_category_name_english)  AS product_category_name_english
FROM raw.category_translation;

-- Two Portuguese category names have no English translation in the source;
-- they keep their Portuguese name. Products with no category become 'unknown'.
CREATE OR REPLACE TABLE stg.products AS
SELECT
    trim(p.product_id)                                        AS product_id,
    nullif(trim(p.product_category_name), '')                 AS product_category_name,
    CASE
        WHEN nullif(trim(p.product_category_name), '') IS NULL THEN 'unknown'
        ELSE coalesce(t.product_category_name_english, trim(p.product_category_name))
    END                                                       AS category,
    CASE
        WHEN nullif(trim(p.product_category_name), '') IS NULL THEN 'missing'
        WHEN t.product_category_name_english IS NULL THEN 'untranslated'
        ELSE 'translated'
    END                                                       AS category_source,
    TRY_CAST(p.product_photos_qty AS INTEGER)                 AS product_photos_qty,
    TRY_CAST(p.product_weight_g AS DOUBLE)                    AS product_weight_g,
    TRY_CAST(p.product_length_cm AS DOUBLE)                   AS product_length_cm,
    TRY_CAST(p.product_height_cm AS DOUBLE)                   AS product_height_cm,
    TRY_CAST(p.product_width_cm AS DOUBLE)                    AS product_width_cm
FROM raw.products AS p
LEFT JOIN stg.category_translation AS t
    ON trim(p.product_category_name) = t.product_category_name;

CREATE OR REPLACE TABLE stg.sellers AS
SELECT
    trim(seller_id)                               AS seller_id,
    lpad(trim(seller_zip_code_prefix), 5, '0')    AS seller_zip_code_prefix,
    trim(seller_city)                             AS seller_city,
    upper(trim(seller_state))                     AS seller_state
FROM raw.sellers;

-- Geolocation has many points per zip prefix (and exact duplicates). It is only
-- used for coverage checks, so it is reduced to one row per prefix.
CREATE OR REPLACE TABLE stg.zip_prefixes AS
SELECT
    lpad(trim(geolocation_zip_code_prefix), 5, '0')     AS zip_code_prefix,
    count(*)                                            AS geolocation_points,
    count(DISTINCT upper(trim(geolocation_state)))      AS states_seen
FROM raw.geolocation
GROUP BY 1;

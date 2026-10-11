-- =============================================================================
-- 04_validation.sql: data contract and logic checks
-- Dialect: DuckDB 1.5.
--
-- Every check writes one row to qa.validation_results:
--   severity  'error'  the build fails if passed = false
--             'warn'   a known data-quality issue; reported, build continues
--             'info'   a measurement worth recording (passed is always true)
--   actual    the measured number; expected describes the rule in words.
-- The runner prints every row and exits non-zero on any failed 'error' check.
-- =============================================================================

CREATE OR REPLACE TABLE qa.validation_results (
    check_group  VARCHAR,
    check_name   VARCHAR,
    severity     VARCHAR,
    actual       DOUBLE,
    expected     VARCHAR,
    passed       BOOLEAN,
    detail       VARCHAR
);

-- ---------------------------------------------------------------------------
-- Load completeness: staging keeps every landed row
-- ---------------------------------------------------------------------------
INSERT INTO qa.validation_results
SELECT 'load', 'raw_vs_stg_rows_' || t, 'error', abs(r - s), '= 0 rows lost between raw and stg', r = s,
       format('raw {:d}, stg {:d}', r, s)
FROM (
    SELECT 'orders' AS t, (SELECT count(*) FROM raw.orders) AS r, (SELECT count(*) FROM stg.orders) AS s
    UNION ALL SELECT 'customers', (SELECT count(*) FROM raw.customers), (SELECT count(*) FROM stg.customers)
    UNION ALL SELECT 'order_items', (SELECT count(*) FROM raw.order_items), (SELECT count(*) FROM stg.order_items)
    UNION ALL SELECT 'order_payments', (SELECT count(*) FROM raw.order_payments), (SELECT count(*) FROM stg.order_payments)
    UNION ALL SELECT 'order_reviews', (SELECT count(*) FROM raw.order_reviews), (SELECT count(*) FROM stg.order_reviews)
    UNION ALL SELECT 'products', (SELECT count(*) FROM raw.products), (SELECT count(*) FROM stg.products)
    UNION ALL SELECT 'sellers', (SELECT count(*) FROM raw.sellers), (SELECT count(*) FROM stg.sellers)
    UNION ALL SELECT 'category_translation', (SELECT count(*) FROM raw.category_translation), (SELECT count(*) FROM stg.category_translation)
);

-- ---------------------------------------------------------------------------
-- Type casts: a value present in raw must survive the cast
-- ---------------------------------------------------------------------------
INSERT INTO qa.validation_results
SELECT 'types', 'cast_failures_' || t, 'error', n, '= 0', n = 0, 'values present in raw but NULL after TRY_CAST'
FROM (
    SELECT 'orders_timestamps' AS t, (
        SELECT count(*) FILTER (WHERE order_purchase_timestamp IS NOT NULL AND TRY_CAST(order_purchase_timestamp AS TIMESTAMP) IS NULL)
             + count(*) FILTER (WHERE order_approved_at IS NOT NULL AND TRY_CAST(order_approved_at AS TIMESTAMP) IS NULL)
             + count(*) FILTER (WHERE order_delivered_carrier_date IS NOT NULL AND TRY_CAST(order_delivered_carrier_date AS TIMESTAMP) IS NULL)
             + count(*) FILTER (WHERE order_delivered_customer_date IS NOT NULL AND TRY_CAST(order_delivered_customer_date AS TIMESTAMP) IS NULL)
             + count(*) FILTER (WHERE order_estimated_delivery_date IS NOT NULL AND TRY_CAST(order_estimated_delivery_date AS TIMESTAMP) IS NULL)
        FROM raw.orders) AS n
    UNION ALL SELECT 'order_items_numbers', (
        SELECT count(*) FILTER (WHERE TRY_CAST(order_item_id AS INTEGER) IS NULL)
             + count(*) FILTER (WHERE TRY_CAST(price AS DECIMAL(12, 2)) IS NULL)
             + count(*) FILTER (WHERE TRY_CAST(freight_value AS DECIMAL(12, 2)) IS NULL)
             + count(*) FILTER (WHERE TRY_CAST(shipping_limit_date AS TIMESTAMP) IS NULL)
        FROM raw.order_items)
    UNION ALL SELECT 'order_payments_numbers', (
        SELECT count(*) FILTER (WHERE TRY_CAST(payment_sequential AS INTEGER) IS NULL)
             + count(*) FILTER (WHERE TRY_CAST(payment_installments AS INTEGER) IS NULL)
             + count(*) FILTER (WHERE TRY_CAST(payment_value AS DECIMAL(12, 2)) IS NULL)
        FROM raw.order_payments)
    UNION ALL SELECT 'order_reviews_fields', (
        SELECT count(*) FILTER (WHERE TRY_CAST(review_score AS INTEGER) IS NULL)
             + count(*) FILTER (WHERE review_creation_date IS NOT NULL AND TRY_CAST(review_creation_date AS TIMESTAMP) IS NULL)
             + count(*) FILTER (WHERE review_answer_timestamp IS NOT NULL AND TRY_CAST(review_answer_timestamp AS TIMESTAMP) IS NULL)
        FROM raw.order_reviews)
);

-- ---------------------------------------------------------------------------
-- Primary keys and duplicates
-- ---------------------------------------------------------------------------
INSERT INTO qa.validation_results
SELECT 'primary key', 'pk_' || t, 'error', dupes + nulls, '= 0 duplicate or NULL keys', dupes + nulls = 0,
       format('{:d} duplicate, {:d} NULL', dupes, nulls)
FROM (
    SELECT 'orders.order_id' AS t,
           (SELECT count(*) - count(DISTINCT order_id) FROM stg.orders) AS dupes,
           (SELECT count(*) FILTER (WHERE order_id IS NULL) FROM stg.orders) AS nulls
    UNION ALL SELECT 'customers.customer_id',
           (SELECT count(*) - count(DISTINCT customer_id) FROM stg.customers),
           (SELECT count(*) FILTER (WHERE customer_id IS NULL) FROM stg.customers)
    UNION ALL SELECT 'order_items.(order_id, order_item_id)',
           (SELECT count(*) - (SELECT count(*) FROM (SELECT DISTINCT order_id, order_item_id FROM stg.order_items)) FROM stg.order_items),
           (SELECT count(*) FILTER (WHERE order_id IS NULL OR order_item_id IS NULL) FROM stg.order_items)
    UNION ALL SELECT 'order_payments.(order_id, payment_sequential)',
           (SELECT count(*) - (SELECT count(*) FROM (SELECT DISTINCT order_id, payment_sequential FROM stg.order_payments)) FROM stg.order_payments),
           (SELECT count(*) FILTER (WHERE order_id IS NULL OR payment_sequential IS NULL) FROM stg.order_payments)
    UNION ALL SELECT 'order_reviews.(review_id, order_id)',
           (SELECT count(*) - (SELECT count(*) FROM (SELECT DISTINCT review_id, order_id FROM stg.order_reviews)) FROM stg.order_reviews),
           (SELECT count(*) FILTER (WHERE review_id IS NULL OR order_id IS NULL) FROM stg.order_reviews)
    UNION ALL SELECT 'products.product_id',
           (SELECT count(*) - count(DISTINCT product_id) FROM stg.products),
           (SELECT count(*) FILTER (WHERE product_id IS NULL) FROM stg.products)
    UNION ALL SELECT 'sellers.seller_id',
           (SELECT count(*) - count(DISTINCT seller_id) FROM stg.sellers),
           (SELECT count(*) FILTER (WHERE seller_id IS NULL) FROM stg.sellers)
    UNION ALL SELECT 'category_translation.product_category_name',
           (SELECT count(*) - count(DISTINCT product_category_name) FROM stg.category_translation),
           (SELECT count(*) FILTER (WHERE product_category_name IS NULL) FROM stg.category_translation)
);

-- Known many-to-many in reviews: recorded, handled by the review rule.
INSERT INTO qa.validation_results
SELECT 'duplicates', 'review_id_repeated_across_orders', 'info',
       (SELECT count(*) FROM (SELECT review_id FROM stg.order_reviews GROUP BY review_id HAVING count(*) > 1)),
       'informational', true, 'review_ids linked to more than one order; each order keeps the score'
UNION ALL
SELECT 'duplicates', 'orders_with_multiple_reviews', 'info',
       (SELECT count(*) FROM (SELECT order_id FROM stg.order_reviews GROUP BY order_id HAVING count(*) > 1)),
       'informational', true, 'orders with more than one review; the latest answer is kept'
UNION ALL
SELECT 'duplicates', 'geolocation_exact_duplicate_rows', 'info',
       (SELECT count(*) FROM raw.geolocation) - (SELECT count(*) FROM (SELECT DISTINCT * FROM raw.geolocation)),
       'informational', true, 'exact duplicate rows in the geolocation file (not used for metrics)';

-- ---------------------------------------------------------------------------
-- Domains
-- ---------------------------------------------------------------------------
INSERT INTO qa.validation_results
SELECT 'domain', 'review_score_between_1_and_5', 'error',
       count(*) FILTER (WHERE review_score NOT BETWEEN 1 AND 5), '= 0',
       count(*) FILTER (WHERE review_score NOT BETWEEN 1 AND 5) = 0, 'scores outside 1-5'
FROM stg.order_reviews
UNION ALL
SELECT 'domain', 'order_status_known', 'error',
       count(*) FILTER (WHERE order_status NOT IN ('delivered', 'shipped', 'canceled', 'unavailable',
                                                   'invoiced', 'processing', 'created', 'approved')), '= 0',
       count(*) FILTER (WHERE order_status NOT IN ('delivered', 'shipped', 'canceled', 'unavailable',
                                                   'invoiced', 'processing', 'created', 'approved')) = 0,
       'statuses outside the documented set'
FROM stg.orders
UNION ALL
SELECT 'domain', 'item_price_positive_freight_non_negative', 'error',
       count(*) FILTER (WHERE price <= 0 OR freight_value < 0), '= 0',
       count(*) FILTER (WHERE price <= 0 OR freight_value < 0) = 0, 'items with price <= 0 or negative freight'
FROM stg.order_items
UNION ALL
SELECT 'domain', 'payment_value_non_negative', 'error',
       count(*) FILTER (WHERE payment_value < 0), '= 0', count(*) FILTER (WHERE payment_value < 0) = 0,
       'negative payments'
FROM stg.order_payments
UNION ALL
SELECT 'domain', 'zero_value_payments', 'warn',
       count(*) FILTER (WHERE payment_value = 0), '= 0', count(*) FILTER (WHERE payment_value = 0) = 0,
       'payment rows with value 0 (mostly voucher / not_defined)'
FROM stg.order_payments
UNION ALL
SELECT 'domain', 'estimated_date_at_midnight', 'error',
       count(*) FILTER (WHERE order_estimated_delivery_date <> date_trunc('day', order_estimated_delivery_date)), '= 0',
       count(*) FILTER (WHERE order_estimated_delivery_date <> date_trunc('day', order_estimated_delivery_date)) = 0,
       'the day-resolution late rule assumes estimates carry no time of day'
FROM stg.orders;

-- ---------------------------------------------------------------------------
-- Referential integrity (orphans must be zero)
-- ---------------------------------------------------------------------------
INSERT INTO qa.validation_results
SELECT 'referential integrity', 'orphans_' || rel, 'error', n, '= 0', n = 0, 'child rows with no parent'
FROM (
    SELECT 'items_to_orders' AS rel, (SELECT count(*) FROM stg.order_items i ANTI JOIN stg.orders o USING (order_id)) AS n
    UNION ALL SELECT 'items_to_products', (SELECT count(*) FROM stg.order_items i ANTI JOIN stg.products p USING (product_id))
    UNION ALL SELECT 'items_to_sellers', (SELECT count(*) FROM stg.order_items i ANTI JOIN stg.sellers s USING (seller_id))
    UNION ALL SELECT 'orders_to_customers', (SELECT count(*) FROM stg.orders o ANTI JOIN stg.customers c USING (customer_id))
    UNION ALL SELECT 'reviews_to_orders', (SELECT count(*) FROM stg.order_reviews r ANTI JOIN stg.orders o USING (order_id))
    UNION ALL SELECT 'payments_to_orders', (SELECT count(*) FROM stg.order_payments p ANTI JOIN stg.orders o USING (order_id))
);

-- Coverage gaps that are real features of the source (warn, counted).
INSERT INTO qa.validation_results
SELECT 'coverage', name, 'warn', n, '= 0', n = 0, detail
FROM (
    SELECT 'orders_without_items' AS name,
           (SELECT count(*) FROM stg.orders o ANTI JOIN stg.order_items i USING (order_id)) AS n,
           (SELECT 'statuses: ' || string_agg(order_status || ' ' || c, ', ' ORDER BY c DESC)
            FROM (SELECT order_status, count(*) c FROM stg.orders o ANTI JOIN stg.order_items i USING (order_id) GROUP BY 1)) AS detail
    UNION ALL SELECT 'orders_without_payments',
           (SELECT count(*) FROM stg.orders o ANTI JOIN stg.order_payments p USING (order_id)), 'orders with no payment row'
    UNION ALL SELECT 'orders_without_review',
           (SELECT count(*) FROM stg.orders o ANTI JOIN stg.order_reviews r USING (order_id)), 'orders with no review'
    UNION ALL SELECT 'products_without_category',
           (SELECT count(*) FROM stg.products WHERE category_source = 'missing'), 'products with blank category (shown as unknown)'
    UNION ALL SELECT 'categories_without_translation',
           (SELECT count(DISTINCT product_category_name) FROM stg.products WHERE category_source = 'untranslated'),
           'Portuguese names kept: ' || coalesce((SELECT string_agg(DISTINCT product_category_name, ', ') FROM stg.products WHERE category_source = 'untranslated'), '')
    UNION ALL SELECT 'customer_zip_not_in_geolocation',
           (SELECT count(*) FROM stg.customers c ANTI JOIN stg.zip_prefixes z ON z.zip_code_prefix = c.customer_zip_code_prefix),
           'customers whose zip prefix is missing from the geolocation file (state is still known)'
    UNION ALL SELECT 'seller_zip_not_in_geolocation',
           (SELECT count(*) FROM stg.sellers s ANTI JOIN stg.zip_prefixes z ON z.zip_code_prefix = s.seller_zip_code_prefix),
           'sellers whose zip prefix is missing from the geolocation file (state is still known)'
);

-- ---------------------------------------------------------------------------
-- Timestamp order (warn: these rows stay in, the legs metric skips them)
-- ---------------------------------------------------------------------------
INSERT INTO qa.validation_results
SELECT 'timestamps', 'delivered_before_purchase', 'error',
       count(*) FILTER (WHERE order_delivered_customer_date < order_purchase_timestamp), '= 0',
       count(*) FILTER (WHERE order_delivered_customer_date < order_purchase_timestamp) = 0,
       'customer delivery earlier than purchase would make delivery days negative'
FROM stg.orders
UNION ALL
SELECT 'timestamps', 'carrier_handoff_before_purchase', 'warn',
       count(*) FILTER (WHERE order_delivered_carrier_date < order_purchase_timestamp), '= 0',
       count(*) FILTER (WHERE order_delivered_carrier_date < order_purchase_timestamp) = 0,
       'carrier date earlier than purchase; excluded from handling/transit legs only'
FROM stg.orders
UNION ALL
SELECT 'timestamps', 'customer_delivery_before_carrier_handoff', 'warn',
       count(*) FILTER (WHERE order_delivered_customer_date < order_delivered_carrier_date), '= 0',
       count(*) FILTER (WHERE order_delivered_customer_date < order_delivered_carrier_date) = 0,
       'customer delivery earlier than carrier hand-off; excluded from legs only'
FROM stg.orders
UNION ALL
SELECT 'timestamps', 'non_delivered_status_with_delivery_date', 'warn',
       count(*) FILTER (WHERE order_status <> 'delivered' AND order_delivered_customer_date IS NOT NULL), '= 0',
       count(*) FILTER (WHERE order_status <> 'delivered' AND order_delivered_customer_date IS NOT NULL) = 0,
       'orders not marked delivered that still carry a delivery date; outside the timing population'
FROM stg.orders;

-- ---------------------------------------------------------------------------
-- Fact grain and fan-out guards
-- ---------------------------------------------------------------------------
INSERT INTO qa.validation_results
SELECT 'grain', 'fct_orders_one_row_per_order', 'error',
       abs((SELECT count(*) FROM core.fct_orders) - (SELECT count(*) FROM stg.orders))
         + (SELECT count(*) - count(DISTINCT order_id) FROM core.fct_orders),
       '= 0', NULL, 'row count equals stg.orders and order_id is unique'
UNION ALL
SELECT 'grain', 'fct_order_items_one_row_per_item', 'error',
       abs((SELECT count(*) FROM core.fct_order_items) - (SELECT count(*) FROM stg.order_items)),
       '= 0', NULL, 'row count equals stg.order_items'
UNION ALL
SELECT 'grain', 'order_review_one_row_per_reviewed_order', 'error',
       abs((SELECT count(*) FROM core.order_review) - (SELECT count(DISTINCT order_id) FROM stg.order_reviews))
         + (SELECT count(*) - count(DISTINCT order_id) FROM core.order_review),
       '= 0', NULL, 'one chosen review per order that has any review'
UNION ALL
SELECT 'review rule', 'chosen_review_is_latest_answer', 'error',
       (SELECT count(*) FROM core.order_review c JOIN stg.order_reviews r USING (order_id)
        WHERE r.review_answer_timestamp > c.review_answer_timestamp),
       '= 0', NULL, 'no review for the same order was answered after the chosen one'
UNION ALL
SELECT 'fan-out', 'fct_orders_item_count_equals_source', 'error',
       abs((SELECT sum(n_items) FROM core.fct_orders) - (SELECT count(*) FROM stg.order_items)),
       '= 0', NULL, 'sum of n_items over orders equals item rows'
UNION ALL
SELECT 'fan-out', 'fct_orders_item_revenue_equals_source', 'error',
       abs((SELECT sum(item_revenue) FROM core.fct_orders) - (SELECT sum(price + freight_value) FROM stg.order_items)),
       '<= 0.005', NULL, 'item revenue is not inflated by the payment join'
UNION ALL
SELECT 'fan-out', 'fct_orders_payment_total_equals_source', 'error',
       abs((SELECT sum(payment_total) FROM core.fct_orders) - (SELECT sum(payment_value) FROM stg.order_payments)),
       '<= 0.005', NULL, 'payments are not inflated by the item join'
UNION ALL
SELECT 'fan-out', 'naive_join_revenue_inflation', 'info',
       (SELECT item_revenue FROM mart.fanout_check WHERE method LIKE 'naive%')
         - (SELECT item_revenue FROM mart.fanout_check WHERE method LIKE 'stg%'),
       'informational', true, 'extra item revenue a naive orders x payments x items join would report';

-- ---------------------------------------------------------------------------
-- Delivery outcome logic
-- ---------------------------------------------------------------------------
INSERT INTO qa.validation_results
SELECT 'delivery rule', 'outcomes_cover_every_order', 'error',
       abs((SELECT sum(orders) FROM mart.delivery_population) - (SELECT count(*) FROM stg.orders)),
       '= 0', NULL, 'on_time + late + every excluded group = all orders'
UNION ALL
SELECT 'delivery rule', 'is_late_set_only_in_timing_population', 'error',
       (SELECT count(*) FROM core.fct_orders WHERE (is_late IS NULL) = in_timing_population),
       '= 0', NULL, 'is_late is NULL exactly when the order is outside the timing population'
UNION ALL
SELECT 'delivery rule', 'late_means_later_calendar_day', 'error',
       (SELECT count(*) FROM core.fct_orders
        WHERE in_timing_population AND is_late <> (delivered_customer_date > estimated_delivery_date)),
       '= 0', NULL, 'is_late agrees with a direct date comparison'
UNION ALL
SELECT 'delivery rule', 'delay_bucket_matches_days', 'error',
       (SELECT count(*) FROM core.fct_orders
        WHERE in_timing_population AND (delay_bucket LIKE 'late%') <> is_late),
       '= 0', NULL, 'every late order sits in a late bucket and vice versa'
UNION ALL
SELECT 'delivery rule', 'delivered_status_missing_date', 'info',
       (SELECT count(*) FROM core.fct_orders WHERE delivery_outcome = 'delivered_missing_date'),
       'informational', true, 'status delivered but no delivery date: counted, excluded from timing'
UNION ALL
SELECT 'delivery rule', 'promised_days_non_negative', 'error',
       (SELECT count(*) FROM core.fct_orders WHERE promised_days < 0),
       '= 0', NULL, 'estimate earlier than purchase';

-- ---------------------------------------------------------------------------
-- Reconciliation of totals across layers
-- ---------------------------------------------------------------------------
INSERT INTO qa.validation_results
SELECT 'reconciliation', 'payment_gap_classes_sum_to_total_gap', 'error',
       abs((SELECT sum(gap) FROM mart.payment_reconciliation)
           - ((SELECT sum(payment_value) FROM stg.order_payments) - (SELECT sum(price + freight_value) FROM stg.order_items))),
       '<= 0.005', NULL, 'the whole payments minus items gap is assigned to a class'
UNION ALL
SELECT 'reconciliation', 'payment_classes_cover_every_order', 'error',
       abs((SELECT sum(orders) FROM mart.payment_reconciliation) - (SELECT count(*) FROM stg.orders)),
       '= 0', NULL, 'each order in exactly one reconciliation class'
UNION ALL
SELECT 'reconciliation', 'route_totals_equal_timing_population', 'error',
       abs((SELECT sum(delivered_orders) FROM mart.route_performance) - (SELECT count(*) FROM core.fct_orders WHERE in_timing_population))
         + abs((SELECT sum(late_orders) FROM mart.route_performance) - (SELECT count(*) FROM core.fct_orders WHERE is_late)),
       '= 0', NULL, 'routes partition the timing population (primary seller rule)'
UNION ALL
SELECT 'reconciliation', 'category_totals_equal_timing_population', 'error',
       abs((SELECT sum(delivered_orders) FROM mart.category_performance) - (SELECT count(*) FROM core.fct_orders WHERE in_timing_population))
         + abs((SELECT sum(late_orders) FROM mart.category_performance) - (SELECT count(*) FROM core.fct_orders WHERE is_late)),
       '= 0', NULL, 'categories partition the timing population (primary category rule)'
UNION ALL
SELECT 'reconciliation', 'monthly_totals_equal_timing_population', 'error',
       abs((SELECT sum(delivered_orders) FROM mart.monthly_delivery) - (SELECT count(*) FROM core.fct_orders WHERE in_timing_population))
         + abs((SELECT sum(orders_placed) FROM mart.monthly_delivery) - (SELECT count(*) FROM stg.orders)),
       '= 0', NULL, 'monthly series adds back to the order totals'
UNION ALL
SELECT 'reconciliation', 'delay_buckets_equal_timing_population', 'error',
       abs((SELECT sum(orders) FROM mart.review_by_delay) - (SELECT count(*) FROM core.fct_orders WHERE in_timing_population)),
       '= 0', NULL, 'every timed order falls in exactly one delay bucket'
UNION ALL
SELECT 'reconciliation', 'category_revenue_equals_delivered_item_revenue', 'error',
       abs((SELECT sum(revenue) FROM mart.category_revenue)
           - (SELECT sum(item_revenue) FROM core.fct_orders WHERE order_status = 'delivered')),
       '<= 0.005', NULL, 'item-level category revenue equals order-level revenue for delivered orders'
UNION ALL
SELECT 'reconciliation', 'wilson_bounds_contain_rate', 'error',
       (SELECT count(*) FROM mart.route_performance WHERE NOT (late_rate_low <= late_rate + 1e-12 AND late_rate <= late_rate_high + 1e-12
                                                         AND late_rate_low >= -1e-12 AND late_rate_high <= 1 + 1e-12)),
       '= 0', NULL, 'every route interval brackets its observed rate';

-- Fill in passed for rows that left it NULL: 'error' and 'warn' checks pass
-- when actual meets the rule in the expected column.
UPDATE qa.validation_results
SET passed = CASE
    WHEN expected = '= 0' THEN actual = 0
    WHEN expected = '<= 0.005' THEN actual <= 0.005
    ELSE passed
END
WHERE passed IS NULL;

-- =============================================================================
-- 03_analytics.sql: analysis marts
-- Dialect: DuckDB 1.5.
-- Variables set by the runner (values come from src/olist_delivery/config.py):
--   month_start, month_end   'YYYY-MM' range of purchase months in the series
--   min_group_orders         minimum delivered orders before a group's rate is ranked
--   wilson_z                 z value for 95% Wilson intervals (1.96)
--
-- Rates are stored as fractions (0.0677), never percentages, and are always
-- computed as sum(numerator) / sum(denominator) inside the group, never as an
-- average of rates.
-- =============================================================================

-- Wilson score interval for a binomial proportion (late / n).
CREATE OR REPLACE MACRO wilson_low(k, n, z) AS
    CASE WHEN n > 0 THEN
        ((k / n) + z * z / (2 * n) - z * sqrt((k / n) * (1 - k / n) / n + z * z / (4 * n * n)))
        / (1 + z * z / n)
    END;
CREATE OR REPLACE MACRO wilson_high(k, n, z) AS
    CASE WHEN n > 0 THEN
        ((k / n) + z * z / (2 * n) + z * sqrt((k / n) * (1 - k / n) / n + z * z / (4 * n * n)))
        / (1 + z * z / n)
    END;

-- ---------------------------------------------------------------------------
-- 1. Who is in the timing population, and who is not (nothing dropped silently)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE mart.delivery_population AS
SELECT
    delivery_outcome,
    order_status,
    count(*) AS orders
FROM core.fct_orders
GROUP BY ALL
ORDER BY delivery_outcome, orders DESC;

-- ---------------------------------------------------------------------------
-- 2. Estimate accuracy: distribution of days vs estimate (clamped for display)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE mart.estimate_accuracy AS
WITH d AS (
    SELECT greatest(least(days_vs_estimate, 30), -40) AS days_vs_estimate_clamped
    FROM core.fct_orders
    WHERE in_timing_population
)
SELECT
    days_vs_estimate_clamped                                         AS days_vs_estimate,
    count(*)                                                         AS orders,
    count(*) / sum(count(*)) OVER ()                                 AS share,
    sum(count(*)) OVER (ORDER BY days_vs_estimate_clamped) / sum(count(*)) OVER () AS cumulative_share
FROM d
GROUP BY days_vs_estimate_clamped
ORDER BY days_vs_estimate_clamped;

-- ---------------------------------------------------------------------------
-- 3. Review score by delay bucket (association, not effect)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE mart.review_by_delay AS
WITH buckets(delay_bucket, label, sort_order, lower_days, upper_days) AS (
    VALUES
        ('early_15plus', '15+ days early',       1, NULL, -15),
        ('early_8_14',   '8-14 days early',      2, -14,  -8),
        ('early_1_7',    '1-7 days early',       3, -7,   -1),
        ('on_day',       'On the estimated day', 4, 0,    0),
        ('late_1_3',     '1-3 days late',        5, 1,    3),
        ('late_4_7',     '4-7 days late',        6, 4,    7),
        ('late_8_14',    '8-14 days late',       7, 8,    14),
        ('late_15plus',  '15+ days late',        8, 15,   NULL)
)
SELECT
    b.delay_bucket,
    b.label,
    b.sort_order,
    b.lower_days,
    b.upper_days,
    count(f.order_id)                                                       AS orders,
    count(f.review_score)                                                   AS reviewed_orders,
    avg(f.review_score)                                                     AS avg_score,
    count(*) FILTER (WHERE f.review_score = 1) / count(f.review_score)      AS pct_1star,
    count(*) FILTER (WHERE f.review_score = 5) / count(f.review_score)      AS pct_5star,
    count(*) FILTER (WHERE f.review_answered_before_delivery)
        / count(f.review_answered_before_delivery)                          AS pct_answered_before_delivery
FROM buckets AS b
LEFT JOIN core.fct_orders AS f
    ON f.delay_bucket = b.delay_bucket AND f.in_timing_population
GROUP BY ALL
ORDER BY b.sort_order;

-- ---------------------------------------------------------------------------
-- 4. Monthly time series by purchase month, with window functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE mart.monthly_delivery AS
WITH m AS (
    SELECT
        purchase_month,
        count(*)                                                    AS orders_placed,
        count(*) FILTER (WHERE in_timing_population)                AS delivered_orders,
        count(*) FILTER (WHERE is_late)                             AS late_orders,
        avg(days_vs_estimate)                                       AS avg_days_vs_estimate,
        avg(promised_days) FILTER (WHERE in_timing_population)      AS avg_promised_days,
        avg(actual_days)                                            AS avg_actual_days,
        avg(seller_handling_days)                                   AS avg_seller_handling_days,
        avg(carrier_transit_days)                                   AS avg_carrier_transit_days,
        count(review_score) FILTER (WHERE in_timing_population)     AS reviewed_orders,
        avg(review_score) FILTER (WHERE in_timing_population)       AS avg_score
    FROM core.fct_orders
    GROUP BY purchase_month
)
SELECT
    strftime(purchase_month, '%Y-%m')                               AS month,
    orders_placed,
    delivered_orders,
    late_orders,
    late_orders / nullif(delivered_orders, 0)                       AS late_rate,
    1 - late_orders / nullif(delivered_orders, 0)                   AS on_time_rate,
    avg_days_vs_estimate,
    avg_promised_days,
    avg_actual_days,
    avg_seller_handling_days,
    avg_carrier_transit_days,
    reviewed_orders,
    avg_score,
    -- Rolling three-month late rate, weighted by volume (sum of late / sum of delivered).
    sum(late_orders) OVER w3 / nullif(sum(delivered_orders) OVER w3, 0) AS late_rate_3m,
    (late_orders / nullif(delivered_orders, 0))
        - lag(late_orders / nullif(delivered_orders, 0)) OVER (ORDER BY purchase_month) AS late_rate_change,
    strftime(purchase_month, '%Y-%m') BETWEEN getvariable('month_start') AND getvariable('month_end') AS in_window
FROM m
WINDOW w3 AS (ORDER BY purchase_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)
ORDER BY purchase_month;

-- Late rate by month and destination, to see whether spikes were broad or local.
CREATE OR REPLACE TABLE mart.monthly_by_destination AS
SELECT
    strftime(purchase_month, '%Y-%m')                               AS month,
    CASE WHEN customer_state IN ('SP', 'RJ', 'MG') THEN customer_state ELSE 'Other' END AS destination,
    count(*)                                                        AS delivered_orders,
    count(*) FILTER (WHERE is_late)                                 AS late_orders,
    count(*) FILTER (WHERE is_late) / count(*)                      AS late_rate
FROM core.fct_orders
WHERE in_timing_population
  AND strftime(purchase_month, '%Y-%m') BETWEEN getvariable('month_start') AND getvariable('month_end')
GROUP BY ALL
ORDER BY month, destination;

-- ---------------------------------------------------------------------------
-- 5. Where late orders come from: routes, categories, destination states.
--    Volume share vs late share, Wilson intervals, minimum-n flag, rankings.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE mart.route_performance AS
WITH overall AS (
    SELECT count(*) AS n, count(*) FILTER (WHERE is_late) AS late
    FROM core.fct_orders WHERE in_timing_population
),
g AS (
    SELECT
        primary_seller_state                                        AS seller_state,
        customer_state,
        route,
        count(*)                                                    AS delivered_orders,
        count(*) FILTER (WHERE is_late)                             AS late_orders,
        avg(review_score)                                           AS avg_score,
        median(actual_days)                                         AS median_actual_days,
        median(promised_days)                                       AS median_promised_days
    FROM core.fct_orders
    WHERE in_timing_population
    GROUP BY ALL
)
SELECT
    g.*,
    g.late_orders / g.delivered_orders                                      AS late_rate,
    wilson_low(g.late_orders, g.delivered_orders, getvariable('wilson_z'))  AS late_rate_low,
    wilson_high(g.late_orders, g.delivered_orders, getvariable('wilson_z')) AS late_rate_high,
    g.delivered_orders / o.n                                                AS share_of_delivered,
    g.late_orders / o.late                                                  AS share_of_late,
    g.late_orders - g.delivered_orders * o.late / o.n                       AS excess_late_orders,
    g.delivered_orders >= getvariable('min_group_orders')                   AS meets_min_orders,
    dense_rank() OVER (ORDER BY g.late_orders DESC)                         AS rank_by_late_orders,
    CASE WHEN g.delivered_orders >= getvariable('min_group_orders')
         THEN rank() OVER (PARTITION BY g.delivered_orders >= getvariable('min_group_orders')
                           ORDER BY g.late_orders / g.delivered_orders DESC) END AS rank_by_late_rate
FROM g CROSS JOIN overall AS o
ORDER BY g.late_orders DESC, g.route;

CREATE OR REPLACE TABLE mart.category_performance AS
WITH overall AS (
    SELECT count(*) AS n, count(*) FILTER (WHERE is_late) AS late
    FROM core.fct_orders WHERE in_timing_population
),
g AS (
    SELECT
        primary_category                                            AS category,
        count(*)                                                    AS delivered_orders,
        count(*) FILTER (WHERE is_late)                             AS late_orders,
        avg(review_score)                                           AS avg_score,
        median(actual_days)                                         AS median_actual_days,
        count(*) FILTER (WHERE primary_seller_state = 'SP')         AS from_sp_orders
    FROM core.fct_orders
    WHERE in_timing_population
    GROUP BY ALL
)
SELECT
    g.*,
    g.late_orders / g.delivered_orders                                      AS late_rate,
    wilson_low(g.late_orders, g.delivered_orders, getvariable('wilson_z'))  AS late_rate_low,
    wilson_high(g.late_orders, g.delivered_orders, getvariable('wilson_z')) AS late_rate_high,
    g.delivered_orders / o.n                                                AS share_of_delivered,
    g.late_orders / o.late                                                  AS share_of_late,
    g.late_orders - g.delivered_orders * o.late / o.n                       AS excess_late_orders,
    g.delivered_orders >= getvariable('min_group_orders')                   AS meets_min_orders,
    dense_rank() OVER (ORDER BY g.late_orders DESC)                         AS rank_by_late_orders,
    CASE WHEN g.delivered_orders >= getvariable('min_group_orders')
         THEN rank() OVER (PARTITION BY g.delivered_orders >= getvariable('min_group_orders')
                           ORDER BY g.late_orders / g.delivered_orders DESC) END AS rank_by_late_rate
FROM g CROSS JOIN overall AS o
ORDER BY g.late_orders DESC, g.category;

CREATE OR REPLACE TABLE mart.state_performance AS
WITH overall AS (
    SELECT count(*) AS n, count(*) FILTER (WHERE is_late) AS late
    FROM core.fct_orders WHERE in_timing_population
),
g AS (
    SELECT
        customer_state,
        count(*)                                                    AS delivered_orders,
        count(*) FILTER (WHERE is_late)                             AS late_orders,
        avg(review_score)                                           AS avg_score,
        median(actual_days)                                         AS median_actual_days,
        median(promised_days)                                       AS median_promised_days
    FROM core.fct_orders
    WHERE in_timing_population
    GROUP BY ALL
)
SELECT
    g.*,
    g.late_orders / g.delivered_orders                                      AS late_rate,
    wilson_low(g.late_orders, g.delivered_orders, getvariable('wilson_z'))  AS late_rate_low,
    wilson_high(g.late_orders, g.delivered_orders, getvariable('wilson_z')) AS late_rate_high,
    g.delivered_orders / o.n                                                AS share_of_delivered,
    g.late_orders / o.late                                                  AS share_of_late,
    g.late_orders - g.delivered_orders * o.late / o.n                       AS excess_late_orders,
    dense_rank() OVER (ORDER BY g.late_orders DESC)                         AS rank_by_late_orders
FROM g CROSS JOIN overall AS o
ORDER BY g.late_orders DESC, g.customer_state;

-- ---------------------------------------------------------------------------
-- 6. Does the score gap hold inside states, categories and sellers?
--    Weighted mean of (late avg - on-time avg) within each group, weighted by
--    the group's reviewed late orders. Groups lacking either side drop out.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE mart.score_gap_within_groups AS
WITH r AS (
    SELECT customer_state, primary_category, primary_seller_id, is_late, review_score
    FROM core.fct_orders
    WHERE in_timing_population AND review_score IS NOT NULL
),
by_group AS (
    SELECT 'customer_state' AS grouping, customer_state AS group_key,
           avg(review_score) FILTER (WHERE is_late) AS late_avg,
           avg(review_score) FILTER (WHERE NOT is_late) AS on_time_avg,
           count(*) FILTER (WHERE is_late) AS late_n
    FROM r GROUP BY customer_state
    UNION ALL
    SELECT 'primary_category', primary_category,
           avg(review_score) FILTER (WHERE is_late),
           avg(review_score) FILTER (WHERE NOT is_late),
           count(*) FILTER (WHERE is_late)
    FROM r GROUP BY primary_category
    UNION ALL
    SELECT 'primary_seller', primary_seller_id,
           avg(review_score) FILTER (WHERE is_late),
           avg(review_score) FILTER (WHERE NOT is_late),
           count(*) FILTER (WHERE is_late)
    FROM r GROUP BY primary_seller_id
)
SELECT
    grouping,
    count(*)                                            AS groups_compared,
    sum(late_n)                                         AS late_reviews_covered,
    sum((late_avg - on_time_avg) * late_n) / sum(late_n) AS weighted_score_gap
FROM by_group
WHERE late_avg IS NOT NULL AND on_time_avg IS NOT NULL
GROUP BY grouping
ORDER BY grouping;

-- ---------------------------------------------------------------------------
-- 7. Context: revenue composition by category (item grain, delivered orders).
--    Revenue here is item price + freight as charged. There is no cost data,
--    so nothing in this project is profit or margin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE mart.category_revenue AS
WITH c AS (
    SELECT
        category,
        count(*)                         AS items,
        count(DISTINCT order_id)         AS orders,
        sum(price)                       AS price,
        sum(freight_value)               AS freight,
        sum(item_revenue)                AS revenue
    FROM core.fct_order_items
    WHERE order_status = 'delivered'
    GROUP BY category
)
SELECT
    c.*,
    c.revenue / sum(c.revenue) OVER ()                                         AS revenue_share,
    sum(c.revenue) OVER (ORDER BY c.revenue DESC, c.category) / sum(c.revenue) OVER () AS cumulative_share,
    c.freight / c.revenue                                                      AS freight_share_of_revenue,
    row_number() OVER (ORDER BY c.revenue DESC, c.category)                    AS revenue_rank
FROM c
ORDER BY revenue_rank;

-- ---------------------------------------------------------------------------
-- 8. Context: repeat purchase (customer_unique_id, delivered orders only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE mart.customer_repeat AS
WITH per_customer AS (
    SELECT
        customer_unique_id,
        count(*)                         AS delivered_orders,
        count(DISTINCT purchase_date)    AS purchase_days
    FROM core.fct_orders
    WHERE order_status = 'delivered'
    GROUP BY customer_unique_id
)
SELECT
    count(*)                                                AS customers,
    count(*) FILTER (WHERE purchase_days >= 2)              AS repeat_customers,
    count(*) FILTER (WHERE purchase_days >= 2) / count(*)   AS repeat_rate,
    count(*) FILTER (WHERE delivered_orders >= 2)           AS customers_two_plus_orders,
    count(*) FILTER (WHERE delivered_orders >= 2) / count(*) AS two_plus_orders_rate,
    max(delivered_orders)                                   AS max_orders_one_customer
FROM per_customer;

-- Cohorts by month of first delivered purchase. A return is a delivered order
-- on a later purchase date. Cohorts whose first month ends fewer than 180 days
-- before the last purchase date in the data cannot show a full 180 days.
CREATE OR REPLACE TABLE mart.cohort_repeat AS
WITH firsts AS (
    SELECT customer_unique_id, min(purchase_date) AS first_date
    FROM core.fct_orders WHERE order_status = 'delivered'
    GROUP BY customer_unique_id
),
returns AS (
    SELECT
        f.customer_unique_id,
        f.first_date,
        min(o.purchase_date) FILTER (WHERE o.purchase_date > f.first_date) AS next_date
    FROM firsts AS f
    JOIN core.fct_orders AS o
      ON o.customer_unique_id = f.customer_unique_id AND o.order_status = 'delivered'
    GROUP BY ALL
),
data_end AS (
    SELECT max(purchase_date) AS last_date FROM core.fct_orders WHERE order_status = 'delivered'
)
SELECT
    strftime(date_trunc('month', r.first_date), '%Y-%m')                            AS cohort_month,
    count(*)                                                                        AS customers,
    count(*) FILTER (WHERE date_diff('day', r.first_date, r.next_date) <= 90)       AS returned_90d,
    count(*) FILTER (WHERE date_diff('day', r.first_date, r.next_date) <= 180)      AS returned_180d,
    count(r.next_date)                                                              AS returned_any,
    count(*) FILTER (WHERE date_diff('day', r.first_date, r.next_date) <= 90) / count(*)  AS return_rate_90d,
    count(*) FILTER (WHERE date_diff('day', r.first_date, r.next_date) <= 180) / count(*) AS return_rate_180d,
    (last_day(date_trunc('month', r.first_date)) + INTERVAL 180 DAY) <= d.last_date AS full_180d_followup
FROM returns AS r CROSS JOIN data_end AS d
GROUP BY ALL
ORDER BY cohort_month;

-- First delivered order late vs on time, and whether the customer came back
-- within 180 days. Only first orders with 180 days of follow-up in the data.
CREATE OR REPLACE TABLE mart.repeat_by_first_delivery AS
WITH data_end AS (
    SELECT max(purchase_date) AS last_date FROM core.fct_orders WHERE order_status = 'delivered'
),
firsts AS (
    SELECT f.customer_unique_id, f.purchase_date, f.is_late
    FROM core.fct_orders AS f
    WHERE f.customer_delivered_order_seq = 1 AND f.in_timing_population
),
nexts AS (
    SELECT customer_unique_id, min(purchase_date) AS next_date
    FROM core.fct_orders
    WHERE order_status = 'delivered' AND customer_purchase_day_seq = 2
    GROUP BY customer_unique_id
)
SELECT
    CASE WHEN f.is_late THEN 'late' ELSE 'on_time' END                         AS first_order_outcome,
    count(*)                                                                    AS customers,
    count(*) FILTER (WHERE date_diff('day', f.purchase_date, n.next_date) <= 180) AS returned_180d,
    count(*) FILTER (WHERE date_diff('day', f.purchase_date, n.next_date) <= 180) / count(*) AS return_rate_180d
FROM firsts AS f
LEFT JOIN nexts AS n USING (customer_unique_id)
CROSS JOIN data_end AS d
WHERE f.purchase_date + INTERVAL 180 DAY <= d.last_date
GROUP BY ALL
ORDER BY first_order_outcome;

-- ---------------------------------------------------------------------------
-- 9. Reconciliation: item revenue vs payments, per order, then classified
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE mart.payment_reconciliation AS
WITH o AS (
    SELECT
        order_id,
        order_status,
        n_items,
        payment_rows,
        item_revenue,
        payment_total,
        voucher_value,
        max_installments,
        payment_total - item_revenue AS gap,
        CASE
            WHEN n_items = 0 AND payment_rows = 0 THEN 'no_items_no_payments'
            WHEN n_items = 0 THEN 'no_items'
            WHEN payment_rows = 0 THEN 'no_payments'
            WHEN abs(payment_total - item_revenue) <= 0.01 THEN 'match_within_1_cent'
            WHEN payment_total > item_revenue AND max_installments > 1 THEN 'payments_above_items_installments'
            WHEN payment_total > item_revenue THEN 'payments_above_items_single_payment'
            ELSE 'payments_below_items'
        END AS reconciliation_class
    FROM core.fct_orders
)
SELECT
    reconciliation_class,
    count(*)                                        AS orders,
    sum(item_revenue)                               AS item_revenue,
    sum(payment_total)                              AS payment_total,
    sum(gap)                                        AS gap,
    count(*) FILTER (WHERE voucher_value > 0)       AS orders_with_voucher,
    string_agg(DISTINCT order_status, ', ' ORDER BY order_status) AS statuses
FROM o
GROUP BY reconciliation_class
ORDER BY abs(sum(gap)) DESC;

CREATE OR REPLACE TABLE mart.payment_type_summary AS
SELECT
    payment_type,
    count(*)                    AS payment_rows,
    count(DISTINCT order_id)    AS orders,
    sum(payment_value)          AS payment_value,
    avg(payment_installments)   AS avg_installments
FROM stg.order_payments
GROUP BY payment_type
ORDER BY payment_value DESC;

-- Join fan-out: what a naive three-way join does to item revenue.
CREATE OR REPLACE TABLE mart.fanout_check AS
SELECT 'stg.order_items (source)' AS method, count(*) AS row_count, sum(price + freight_value) AS item_revenue
FROM stg.order_items
UNION ALL
SELECT 'naive join orders x payments x items', count(*), sum(i.price + i.freight_value)
FROM stg.orders AS o
JOIN stg.order_payments AS p ON p.order_id = o.order_id
JOIN stg.order_items AS i ON i.order_id = o.order_id
UNION ALL
SELECT 'core.fct_orders (payments pre-aggregated)', sum(n_items), sum(item_revenue)
FROM core.fct_orders;

-- ---------------------------------------------------------------------------
-- 10. Headline metrics in long form (metric, value). The pandas pipeline
--     computes the same keys independently; reconcile.py compares them.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE mart.headline_metrics AS
WITH f AS (SELECT * FROM core.fct_orders),
t AS (SELECT * FROM core.fct_orders WHERE in_timing_population),
rv AS (SELECT * FROM t WHERE review_score IS NOT NULL),
win AS (SELECT * FROM mart.monthly_delivery WHERE in_window)
SELECT 'orders_total' AS metric, count(*)::DOUBLE AS value FROM f
UNION ALL SELECT 'timing_population_orders', count(*) FROM t
UNION ALL SELECT 'delivered_missing_date_orders', count(*) FILTER (WHERE delivery_outcome = 'delivered_missing_date') FROM f
UNION ALL SELECT 'not_delivered_orders', count(*) FILTER (WHERE delivery_outcome IN ('not_delivered', 'not_delivered_status_with_date')) FROM f
UNION ALL SELECT 'late_orders', count(*) FILTER (WHERE is_late) FROM t
UNION ALL SELECT 'late_rate', count(*) FILTER (WHERE is_late) / count(*) FROM t
UNION ALL SELECT 'late_rate_timestamp_rule', count(*) FILTER (WHERE is_late_timestamp_rule) / count(*) FROM t
UNION ALL SELECT 'median_days_vs_estimate', median(days_vs_estimate) FROM t
UNION ALL SELECT 'mean_days_vs_estimate', avg(days_vs_estimate) FROM t
UNION ALL SELECT 'pct_7plus_days_early', count(*) FILTER (WHERE days_vs_estimate <= -7) / count(*) FROM t
UNION ALL SELECT 'median_promised_days', median(promised_days) FROM t
UNION ALL SELECT 'median_actual_days', median(actual_days) FROM t
UNION ALL SELECT 'reviewed_delivered_orders', count(*) FROM rv
UNION ALL SELECT 'avg_score_on_time', avg(review_score) FILTER (WHERE NOT is_late) FROM rv
UNION ALL SELECT 'avg_score_late', avg(review_score) FILTER (WHERE is_late) FROM rv
UNION ALL SELECT 'score_gap_late_minus_on_time',
    avg(review_score) FILTER (WHERE is_late) - avg(review_score) FILTER (WHERE NOT is_late) FROM rv
UNION ALL SELECT 'pct_1star_on_time', count(*) FILTER (WHERE review_score = 1 AND NOT is_late) / count(*) FILTER (WHERE NOT is_late) FROM rv
UNION ALL SELECT 'pct_1star_late', count(*) FILTER (WHERE review_score = 1 AND is_late) / count(*) FILTER (WHERE is_late) FROM rv
UNION ALL SELECT 'late_share_of_1star_reviews', count(*) FILTER (WHERE review_score = 1 AND is_late) / count(*) FILTER (WHERE review_score = 1) FROM rv
UNION ALL SELECT 'pct_late_answered_before_delivery',
    count(*) FILTER (WHERE is_late AND review_answered_before_delivery) / count(*) FILTER (WHERE is_late) FROM rv
UNION ALL SELECT 'pct_late_low_scores_answered_before_delivery',
    count(*) FILTER (WHERE is_late AND review_score <= 2 AND review_answered_before_delivery)
        / count(*) FILTER (WHERE is_late AND review_score <= 2) FROM rv
UNION ALL SELECT 'score_gap_within_state', weighted_score_gap FROM mart.score_gap_within_groups WHERE grouping = 'customer_state'
UNION ALL SELECT 'score_gap_within_category', weighted_score_gap FROM mart.score_gap_within_groups WHERE grouping = 'primary_category'
UNION ALL SELECT 'score_gap_within_seller', weighted_score_gap FROM mart.score_gap_within_groups WHERE grouping = 'primary_seller'
UNION ALL SELECT 'orders_multi_seller', count(*) FILTER (WHERE n_sellers > 1) FROM f
UNION ALL SELECT 'route_sp_rj_share_of_delivered', share_of_delivered FROM mart.route_performance WHERE route = 'SP → RJ'
UNION ALL SELECT 'route_sp_rj_share_of_late', share_of_late FROM mart.route_performance WHERE route = 'SP → RJ'
UNION ALL SELECT 'route_sp_rj_late_rate', late_rate FROM mart.route_performance WHERE route = 'SP → RJ'
UNION ALL SELECT 'state_rj_late_rate', late_rate FROM mart.state_performance WHERE customer_state = 'RJ'
UNION ALL SELECT 'peak_month_late_rate', max(late_rate) FROM win
UNION ALL SELECT 'min_month_late_rate', min(late_rate) FROM win
UNION ALL SELECT 'items_revenue_all_orders', sum(item_revenue) FROM f
UNION ALL SELECT 'payments_total_all_orders', sum(payment_total) FROM f
UNION ALL SELECT 'payments_minus_items', sum(payment_total) - sum(item_revenue) FROM f
UNION ALL SELECT 'items_revenue_delivered', sum(item_revenue) FILTER (WHERE order_status = 'delivered') FROM f
UNION ALL SELECT 'top_category_revenue_share', max(revenue_share) FROM mart.category_revenue
UNION ALL SELECT 'top10_categories_revenue_share', max(cumulative_share) FILTER (WHERE revenue_rank = 10) FROM mart.category_revenue
UNION ALL SELECT 'customers_with_delivered_order', customers FROM mart.customer_repeat
UNION ALL SELECT 'repeat_customer_rate', repeat_rate FROM mart.customer_repeat
UNION ALL SELECT 'two_plus_orders_rate', two_plus_orders_rate FROM mart.customer_repeat;

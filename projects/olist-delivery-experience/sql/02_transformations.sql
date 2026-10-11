-- =============================================================================
-- 02_transformations.sql: core facts
-- Dialect: DuckDB 1.5.
--
-- Grain
--   core.fct_order_items   one row per order item (order_id, order_item_id)
--   core.order_payments    one row per order that has payments (order_id)
--   core.order_items_agg   one row per order that has items (order_id)
--   core.order_review      one row per order that has a review (order_id), the chosen review
--   core.fct_orders        one row per order (order_id), every order in the source
--
-- Definitions used everywhere downstream (also in docs/methodology.md):
--   timing population  order_status = 'delivered' AND delivered and estimated dates present
--   days_vs_estimate   delivered DATE minus estimated DATE, in days (negative = early)
--   is_late            days_vs_estimate > 0, i.e. delivered on a later calendar day than
--                      the estimate. Dates, not timestamps: the estimate is always stored
--                      at 00:00:00, so a timestamp comparison would call every delivery
--                      made during the estimated day late.
--   primary seller /   the seller (category) with the largest item revenue in the order,
--   primary category   ties broken alphabetically. Used to give each order one route
--                      and one category so shares add to 100%.
--   chosen review      latest answer per order (review_answer_timestamp, then
--                      review_creation_date, then review_id, all descending).
-- =============================================================================

-- Item grain. LEFT JOINs so an orphan item would stay visible (and fail 04).
CREATE OR REPLACE TABLE core.fct_order_items AS
SELECT
    i.order_id,
    i.order_item_id,
    i.product_id,
    i.seller_id,
    s.seller_state,
    c.customer_state,
    coalesce(p.category, 'unknown')                         AS category,
    o.order_status,
    date_trunc('month', o.order_purchase_timestamp)::DATE   AS purchase_month,
    i.price,
    i.freight_value,
    i.price + i.freight_value                               AS item_revenue
FROM stg.order_items AS i
LEFT JOIN stg.orders    AS o ON o.order_id = i.order_id
LEFT JOIN stg.customers AS c ON c.customer_id = o.customer_id
LEFT JOIN stg.products  AS p ON p.product_id = i.product_id
LEFT JOIN stg.sellers   AS s ON s.seller_id = i.seller_id;

-- Order grain payment totals. Joining stg.order_payments straight onto items
-- repeats each item once per payment row (fan-out), so payments are rolled up
-- to the order first.
CREATE OR REPLACE TABLE core.order_payments AS
SELECT
    order_id,
    count(*)                                                        AS payment_rows,
    sum(payment_value)                                              AS payment_total,
    coalesce(sum(payment_value) FILTER (WHERE payment_type = 'voucher'), 0) AS voucher_value,
    max(payment_installments)                                       AS max_installments,
    string_agg(DISTINCT payment_type, '+' ORDER BY payment_type)    AS payment_types
FROM stg.order_payments
GROUP BY order_id;

CREATE OR REPLACE TABLE core.order_items_agg AS
SELECT
    order_id,
    count(*)                         AS n_items,
    count(DISTINCT seller_id)        AS n_sellers,
    count(DISTINCT seller_state)     AS n_seller_states,
    count(DISTINCT category)         AS n_categories,
    sum(price)                       AS item_price,
    sum(freight_value)               AS item_freight,
    sum(item_revenue)                AS item_revenue
FROM core.fct_order_items
GROUP BY order_id;

-- Primary seller and category per order (ranking with a window function).
CREATE OR REPLACE TABLE core.order_primary_seller AS
WITH by_seller AS (
    SELECT order_id, seller_id, seller_state, sum(item_revenue) AS revenue
    FROM core.fct_order_items
    GROUP BY order_id, seller_id, seller_state
)
SELECT
    order_id,
    seller_id     AS primary_seller_id,
    seller_state  AS primary_seller_state
FROM by_seller
QUALIFY row_number() OVER (PARTITION BY order_id ORDER BY revenue DESC, seller_id) = 1;

CREATE OR REPLACE TABLE core.order_primary_category AS
WITH by_category AS (
    SELECT order_id, category, sum(item_revenue) AS revenue
    FROM core.fct_order_items
    GROUP BY order_id, category
)
SELECT order_id, category AS primary_category
FROM by_category
QUALIFY row_number() OVER (PARTITION BY order_id ORDER BY revenue DESC, category) = 1;

-- Review de-duplication. Counts are taken over the full review table before
-- filtering, so the fact keeps how many reviews an order had and how many
-- orders shared the chosen review.
CREATE OR REPLACE TABLE core.order_review AS
WITH ranked AS (
    SELECT
        r.*,
        count(*) OVER (PARTITION BY r.order_id)  AS reviews_for_order,
        count(*) OVER (PARTITION BY r.review_id) AS orders_sharing_review,
        row_number() OVER (
            PARTITION BY r.order_id
            ORDER BY r.review_answer_timestamp DESC NULLS LAST,
                     r.review_creation_date DESC NULLS LAST,
                     r.review_id DESC
        ) AS review_rank
    FROM stg.order_reviews AS r
)
SELECT
    order_id,
    review_id,
    review_score,
    has_comment_message,
    review_creation_date,
    review_answer_timestamp,
    reviews_for_order,
    orders_sharing_review
FROM ranked
WHERE review_rank = 1;

-- Order grain fact: every order in stg.orders, with the delivery outcome made explicit.
CREATE OR REPLACE TABLE core.fct_orders AS
WITH base AS (
    SELECT
        o.*,
        c.customer_unique_id,
        c.customer_state,
        o.order_purchase_timestamp::DATE          AS purchase_date,
        o.order_estimated_delivery_date::DATE     AS estimated_delivery_date,
        o.order_delivered_customer_date::DATE     AS delivered_customer_date,
        o.order_delivered_carrier_date::DATE      AS delivered_carrier_date,
        (o.order_status = 'delivered'
            AND o.order_delivered_customer_date IS NOT NULL
            AND o.order_estimated_delivery_date IS NOT NULL) AS in_timing_population
    FROM stg.orders AS o
    LEFT JOIN stg.customers AS c ON c.customer_id = o.customer_id
),
customer_seq AS (
    -- Repeat purchase uses customer_unique_id (customer_id is issued per order)
    -- and delivered orders only.
    SELECT
        order_id,
        row_number() OVER (PARTITION BY customer_unique_id
                           ORDER BY order_purchase_timestamp, order_id)  AS customer_delivered_order_seq,
        dense_rank() OVER (PARTITION BY customer_unique_id
                           ORDER BY purchase_date)                      AS customer_purchase_day_seq,
        min(purchase_date) OVER (PARTITION BY customer_unique_id)      AS customer_first_purchase_date
    FROM base
    WHERE order_status = 'delivered'
),
timed AS (
    SELECT
        b.*,
        CASE WHEN b.in_timing_population
             THEN date_diff('day', b.estimated_delivery_date, b.delivered_customer_date) END AS days_vs_estimate
    FROM base AS b
)
SELECT
    t.order_id,
    t.customer_id,
    t.customer_unique_id,
    t.customer_state,
    t.order_status,
    t.order_purchase_timestamp,
    t.purchase_date,
    date_trunc('month', t.purchase_date)::DATE                AS purchase_month,
    t.order_approved_at,
    t.order_delivered_carrier_date,
    t.order_delivered_customer_date,
    t.order_estimated_delivery_date,
    t.estimated_delivery_date,
    t.delivered_customer_date,
    t.in_timing_population,
    CASE
        WHEN t.in_timing_population AND t.days_vs_estimate > 0 THEN 'late'
        WHEN t.in_timing_population                            THEN 'on_time'
        WHEN t.order_status = 'delivered'                      THEN 'delivered_missing_date'
        WHEN t.order_delivered_customer_date IS NOT NULL       THEN 'not_delivered_status_with_date'
        ELSE 'not_delivered'
    END                                                        AS delivery_outcome,
    t.days_vs_estimate,
    CASE WHEN t.in_timing_population THEN t.days_vs_estimate > 0 END            AS is_late,
    -- Alternative rule kept only to show how much the definition matters.
    CASE WHEN t.in_timing_population
         THEN t.order_delivered_customer_date > t.order_estimated_delivery_date END AS is_late_timestamp_rule,
    CASE
        WHEN NOT t.in_timing_population THEN NULL
        WHEN t.days_vs_estimate <= -15 THEN 'early_15plus'
        WHEN t.days_vs_estimate <= -8  THEN 'early_8_14'
        WHEN t.days_vs_estimate <= -1  THEN 'early_1_7'
        WHEN t.days_vs_estimate = 0    THEN 'on_day'
        WHEN t.days_vs_estimate <= 3   THEN 'late_1_3'
        WHEN t.days_vs_estimate <= 7   THEN 'late_4_7'
        WHEN t.days_vs_estimate <= 14  THEN 'late_8_14'
        ELSE 'late_15plus'
    END                                                        AS delay_bucket,
    date_diff('day', t.purchase_date, t.estimated_delivery_date)              AS promised_days,
    CASE WHEN t.in_timing_population
         THEN date_diff('day', t.purchase_date, t.delivered_customer_date) END AS actual_days,
    -- Legs of the trip, only where the carrier hand-off date is in order.
    CASE WHEN t.in_timing_population AND t.delivered_carrier_date >= t.purchase_date
              AND t.delivered_customer_date >= t.delivered_carrier_date
         THEN date_diff('day', t.purchase_date, t.delivered_carrier_date) END  AS seller_handling_days,
    CASE WHEN t.in_timing_population AND t.delivered_carrier_date >= t.purchase_date
              AND t.delivered_customer_date >= t.delivered_carrier_date
         THEN date_diff('day', t.delivered_carrier_date, t.delivered_customer_date) END AS carrier_transit_days,
    coalesce(ia.n_items, 0)                                    AS n_items,
    coalesce(ia.n_sellers, 0)                                  AS n_sellers,
    coalesce(ia.n_seller_states, 0)                            AS n_seller_states,
    coalesce(ia.n_categories, 0)                               AS n_categories,
    coalesce(ia.item_price, 0)::DECIMAL(14, 2)                 AS item_price,
    coalesce(ia.item_freight, 0)::DECIMAL(14, 2)               AS item_freight,
    coalesce(ia.item_revenue, 0)::DECIMAL(14, 2)               AS item_revenue,
    coalesce(pa.payment_rows, 0)                               AS payment_rows,
    coalesce(pa.payment_total, 0)::DECIMAL(14, 2)              AS payment_total,
    coalesce(pa.voucher_value, 0)::DECIMAL(14, 2)              AS voucher_value,
    pa.max_installments,
    pa.payment_types,
    ps.primary_seller_id,
    ps.primary_seller_state,
    CASE WHEN ps.primary_seller_state IS NOT NULL
         THEN ps.primary_seller_state || ' → ' || t.customer_state END   AS route,
    pc.primary_category,
    rv.review_id,
    rv.review_score,
    rv.reviews_for_order,
    rv.orders_sharing_review,
    rv.has_comment_message                                     AS review_has_comment,
    rv.review_creation_date,
    rv.review_answer_timestamp,
    CASE WHEN t.in_timing_population AND rv.review_answer_timestamp IS NOT NULL
         THEN rv.review_answer_timestamp < t.order_delivered_customer_date END AS review_answered_before_delivery,
    cs.customer_delivered_order_seq,
    cs.customer_purchase_day_seq,
    cs.customer_first_purchase_date
FROM timed AS t
LEFT JOIN core.order_items_agg        AS ia ON ia.order_id = t.order_id
LEFT JOIN core.order_payments         AS pa ON pa.order_id = t.order_id
LEFT JOIN core.order_primary_seller   AS ps ON ps.order_id = t.order_id
LEFT JOIN core.order_primary_category AS pc ON pc.order_id = t.order_id
LEFT JOIN core.order_review           AS rv ON rv.order_id = t.order_id
LEFT JOIN customer_seq                AS cs ON cs.order_id = t.order_id;

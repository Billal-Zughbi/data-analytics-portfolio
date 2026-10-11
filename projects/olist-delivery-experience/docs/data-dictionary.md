# Data dictionary

Three parts: the source files, the core facts built in DuckDB, and the published Power BI tables. Website
JSON fields are documented in [`outputs/website-data/README.md`](../outputs/website-data/README.md).

Money is in Brazilian reais (BRL). Rates are fractions between 0 and 1 in every table and file; only the
`display` strings in `summary.json` are formatted as percentages.

## Source files (local only, not in git)

| File | Rows (this copy) | Key | Used for |
|---|---|---|---|
| `olist_orders_dataset.csv` | 99,441 | `order_id` | status and the five order timestamps |
| `olist_customers_dataset.csv` | 99,441 | `customer_id` | `customer_unique_id`, customer state |
| `olist_order_items_dataset.csv` | 112,650 | `(order_id, order_item_id)` | price, freight, product, seller |
| `olist_order_payments_dataset.csv` | 103,886 | `(order_id, payment_sequential)` | payment type, instalments, value |
| `olist_order_reviews_dataset.csv` | 100,000 | `(review_id, order_id)` | score and survey timestamps (text never used) |
| `olist_products_dataset.csv` | 32,951 | `product_id` | category |
| `olist_sellers_dataset.csv` | 3,095 | `seller_id` | seller state |
| `olist_geolocation_dataset.csv` | 1,000,163 | none (many points per zip prefix) | zip coverage check only |
| `product_category_name_translation.csv` | 71 | `product_category_name` | English category names |

Source column meanings follow the Kaggle dataset description. Two that matter here:
`review_creation_date` is the date the satisfaction survey was sent, and `review_answer_timestamp` is when the
customer answered it. `order_estimated_delivery_date` is the date shown to the customer at purchase and is
always stored at midnight.

## `core.fct_orders` (one row per order, 99,441 rows)

| Column | Type | Meaning |
|---|---|---|
| `order_id`, `customer_id`, `customer_unique_id` | text | identifiers (local database only, never published) |
| `customer_state` | text | two-letter state of the customer |
| `order_status` | text | source status, lower case |
| `order_purchase_timestamp` … `order_estimated_delivery_date` | timestamp | source timestamps, typed |
| `purchase_date`, `purchase_month` | date | purchase calendar day and first day of its month |
| `estimated_delivery_date`, `delivered_customer_date` | date | calendar days used by the late rule |
| `in_timing_population` | boolean | status `delivered` and both delivery and estimated dates present |
| `delivery_outcome` | text | `on_time`, `late`, `delivered_missing_date`, `not_delivered`, `not_delivered_status_with_date` |
| `days_vs_estimate` | integer, days | delivered date minus estimated date; negative = early; NULL outside the timing population |
| `is_late` | boolean | `days_vs_estimate > 0`; NULL outside the timing population |
| `is_late_timestamp_rule` | boolean | delivery timestamp after the estimate timestamp (sensitivity check only) |
| `delay_bucket` | text | one of eight buckets (see methodology) |
| `promised_days`, `actual_days` | integer, days | purchase to estimate; purchase to delivery |
| `seller_handling_days`, `carrier_transit_days` | integer, days | purchase to carrier hand-off; hand-off to delivery |
| `n_items`, `n_sellers`, `n_seller_states`, `n_categories` | integer | counts from the item table (0 when the order has no items) |
| `item_price`, `item_freight`, `item_revenue` | decimal, BRL | sums over the order's items; revenue = price + freight |
| `payment_rows`, `payment_total`, `voucher_value`, `max_installments`, `payment_types` | mixed | payments rolled up to the order |
| `primary_seller_id`, `primary_seller_state` | text | seller with the most item revenue in the order |
| `route` | text | `primary_seller_state → customer_state` |
| `primary_category` | text | category with the most item revenue in the order |
| `review_id`, `review_score` | text, integer 1-5 | the chosen review (latest answer) |
| `reviews_for_order`, `orders_sharing_review` | integer | how many reviews the order had; how many orders share the chosen review |
| `review_has_comment` | boolean | the chosen review has a written comment (the text itself is not kept) |
| `review_answered_before_delivery` | boolean | answer timestamp earlier than the delivery timestamp |
| `customer_delivered_order_seq` | integer | order number among the customer's delivered orders, by purchase time |
| `customer_purchase_day_seq` | integer | dense rank of the purchase day among the customer's delivered orders |
| `customer_first_purchase_date` | date | first delivered purchase day of the customer |

## `core.fct_order_items` (one row per item, 112,650 rows)

`order_id`, `order_item_id`, `product_id`, `seller_id`, `seller_state`, `customer_state`, `category` (English,
Portuguese when untranslated, `unknown` when blank), `order_status`, `purchase_month`, `price`,
`freight_value`, `item_revenue` (= price + freight).

## Power BI tables ([`data/sample/`](../data/sample))

All are aggregates written by `python -m olist_delivery export`. None has an order, customer, seller,
product or review identifier, and none has review text.

| Table | Grain | Rows |
|---|---|---|
| `fact_route_month` | purchase month × primary seller state × customer state (all orders) | 3,996 |
| `fact_category_month` | purchase month × primary category (all orders) | 1,302 |
| `fact_item_revenue_month` | purchase month × item category × delivered-order flag (all items) | 1,858 |
| `fact_delay_review` | purchase month × delay bucket × review score (timing population) | 785 |
| `fact_customer_cohort` | month of first delivered purchase | 23 |
| `dim_month` | month (`YYYY-MM`) | 26 |
| `dim_state` | state code (plus `(none)` for orders without items) | 28 |
| `dim_category` | category (plus `(no items)`) | 75 |
| `dim_delay_bucket` | delay bucket | 8 |

### `fact_route_month` columns

| Column | Unit | Meaning |
|---|---|---|
| `month`, `seller_state`, `customer_state` | key | `seller_state` is `(none)` for orders with no items |
| `orders` | orders | all orders in the cell |
| `delivered_orders` | orders | timing population |
| `late_orders` | orders | late orders |
| `delivered_missing_date_orders` | orders | status delivered, no delivery date |
| `days_vs_estimate_sum`, `promised_days_sum`, `actual_days_sum` | days | sums over the timing population; divide by `delivered_orders` |
| `reviewed_orders`, `review_score_sum`, `one_star_reviews` | orders, stars, orders | over the timing population |
| `late_reviewed_orders`, `late_review_score_sum`, `late_one_star_reviews` | orders, stars, orders | late orders only; on-time values are the totals minus these |
| `item_revenue`, `item_freight`, `payment_total` | BRL | all orders in the cell |

### Other fact columns

* `fact_category_month`: `orders`, `delivered_orders`, `late_orders`, `reviewed_orders`, `review_score_sum`,
  `one_star_reviews`, same meanings as above, attributed by primary category. `(no items)` holds orders with no
  items.
* `fact_item_revenue_month`: `is_delivered_order` (order status is `delivered`), `items`, `price`, `freight`,
  `item_revenue` (BRL), attributed by each item's own category.
* `fact_delay_review`: `delay_bucket`, `review_score` (blank when the order has no review), `orders`.
* `fact_customer_cohort`: `customers` (first delivered purchase in the month), `returned_90d`, `returned_180d`,
  `returned_any` (a later delivered purchase on another day), `full_180d_followup` (the cohort has 180 days of
  data after its month ends).

### Dimensions

* `dim_month`: `month`, `month_start`, `year`, `quarter`, `month_number`, `month_name`, `in_analysis_window`
  (January 2017 to August 2018).
* `dim_state`: `state`, `state_name`, `region` (IBGE macro-region). Loaded twice in Power BI, as customer and
  seller state.
* `dim_category`: `category` (English name), `category_pt`, `category_source` (`translated`, `untranslated`,
  `missing`, `no_items`).
* `dim_delay_bucket`: `delay_bucket`, `label`, `sort_order`, `lower_days`, `upper_days`, `is_late`.

## Analysis outputs ([`outputs/`](../outputs))

| File | Contents |
|---|---|
| `analysis/*.csv` | one CSV per SQL mart (headline metrics, monthly series, routes, categories, states, buckets, revenue, cohorts, reconciliation, fan-out) plus `peak_period_comparison.csv` from pandas |
| `validation_results.csv` | every check from `04_validation.sql` with severity, value and result |
| `reconciliation.csv` | metric or table, SQL value, pandas value, difference, tolerance, match |
| `source_check.json` | row counts, bytes, SHA-256 and detected version of the raw files |
| `statistics.json` | Welch test, 1-star gap interval, Spearman correlation, repeat-rate intervals, estimate distribution |
| `powerbi_expected_values.csv` | measures recomputed from the Power BI CSVs next to the pipeline values |
| `figures/*.png` | README figures |

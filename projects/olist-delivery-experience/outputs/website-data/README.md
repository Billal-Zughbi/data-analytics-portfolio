# Website data contract

`python -m olist_delivery export` writes six JSON files to
`website/src/data/generated/olist-delivery-experience/`. They are generated, never edited by hand, and
`tests/test_outputs.py` checks their shape, size (under 150 KB together; about 81 KB now) and that they hold
no identifiers or review text.

Conventions used in every file:

* **Rates and shares** are fractions between 0 and 1 (`0.0677` means 6.77%), rounded to 4 decimals unless noted.
  Only `summary.json` → `kpis[].display` holds formatted strings.
* **Scores** are review stars on a 1-5 scale, rounded to 3 decimals in chart files.
* **Days** are whole calendar days, averaged values rounded to 2 decimals. Negative days vs estimate means early.
* **Money** is BRL, rounded to cents.
* **Months** are purchase months as `YYYY-MM`.
* `null` means not applicable (for example an open-ended bucket bound).
* Every chart file has `description` (one sentence) and `license` (attribution text for CC BY-NC-SA 4.0).

## `summary.json`

| Field | Type | Meaning |
|---|---|---|
| `generated_at` | string, ISO 8601 UTC | when the export ran |
| `source.name`, `publisher`, `url`, `license` | string | dataset identity; licence is `CC BY-NC-SA 4.0` |
| `source.attribution` | string | attribution sentence to show with any chart |
| `source.retrieved` | string, ISO 8601 | when the raw files were downloaded |
| `source.mirror_url` | string | base URL of the GitHub mirror used |
| `source.version_note` | string | how this copy differs from Kaggle v2 (the reviews file) |
| `source.coverage.start`, `.end` | date | first and last purchase date in the data |
| `source.coverage.last_purchase_with_delivery`, `.last_delivery` | date | where delivered data stops |
| `source.coverage.analysis_months.start`, `.end` | `YYYY-MM` | window of the monthly series |
| `source.rows.*` | integer | rows parsed per file: `orders`, `items`, `payments`, `reviews`, `customers`, `products`, `sellers`, `geolocation`, `category_translation` |
| `question` | string | the main question |
| `kpis[]` | 8 objects | `key`, `label`, `value` (number), `unit` (`share`, `days`, `stars (1-5)`), `display` (formatted), `definition` |
| `findings[]` | 6 objects | `id`, `title`, `summary` (1-2 sentences), `metric` (definition and units), `caveat` |
| `statistics` | object | `late_reviews`, `on_time_reviews`, `mean_score_diff` (stars) and `mean_score_diff_ci95`, `pct_1star_diff` and `pct_1star_diff_ci95` (fraction), `spearman_rho_days_vs_score`, `note` |
| `quality.summary` | object | `error_checks`, `error_checks_failed`, `warnings` (failed warn-level checks) |
| `quality.checks[]` | objects | `name`, `result` (`pass`, `warn`, `fail`, `info`), `detail`; source row counts, then every SQL validation |
| `reconciliation[]` | objects | `metric` (headline metric key, or `table:<mart>` for a whole-table comparison), `sql`, `python` (for tables: row counts), `match` (boolean) |
| `next_steps[]` | strings | proposed follow-ups for a hypothetical operations lead; none has been tried |

KPI keys: `late_rate`, `median_days_vs_estimate`, `avg_score_on_time`, `avg_score_late`, `pct_1star_late`,
`route_sp_rj_share_of_late`, `peak_month_late_rate`, `repeat_customer_rate`.

## `monthly.json`

`window` (`start`, `end`), then:

* `rows[]`, one per purchase month in the window (20): `month`, `orders_placed` (all statuses),
  `delivered_orders` (timing population), `late_orders`, `on_time_rate`, `late_rate`, `avg_days_vs_estimate`,
  `avg_promised_days`, `avg_actual_days`, `avg_seller_handling_days` (purchase to carrier hand-off),
  `avg_carrier_transit_days` (hand-off to delivery), `avg_score`, `late_rate_3m` (sum of late over the sum of
  delivered for this and the two previous months).
* `by_destination[]`: `month`, `destination` (`SP`, `RJ`, `MG`, `Other`), `delivered_orders`, `late_orders`,
  `late_rate`.

## `review_by_delay.json`

`rows[]`, eight buckets in order: `delay_bucket` (key), `label`, `sort_order`, `lower_days` and `upper_days`
(inclusive bounds of days vs estimate; `null` = open-ended), `orders`, `reviewed_orders`, `avg_score`,
`pct_1star`, `pct_5star`, `pct_answered_before_delivery` (share of reviews answered before the delivery
timestamp).

## `routes.json`

* `overall_late_rate`, `min_orders_for_rate_ranking` (100), `routes_total`.
* `top_by_late_orders[]` (15 routes with the most late orders) and `highest_rate_min_orders[]` (10 highest late
  rates among routes with at least 100 delivered orders). Fields: `route` (`SP → RJ`), `seller_state`,
  `customer_state`, `delivered_orders`, `late_orders`, `late_rate`, `late_rate_low` and `late_rate_high` (95%
  Wilson interval), `share_of_delivered`, `share_of_late`, `excess_late_orders` (late orders minus
  `delivered_orders × overall_late_rate`; can be negative), `avg_score`.
* `other_routes`: `routes`, `delivered_orders`, `late_orders`, `late_rate`, `share_of_late` for every route
  outside the top 15, so the chart can show the remainder.
* `destination_states[]` (27): `customer_state`, `state_name`, `region`, `delivered_orders`, `late_orders`,
  `late_rate`, `late_rate_low`, `late_rate_high`, `share_of_delivered`, `share_of_late`, `avg_score`.

A route is the primary seller's state → the customer's state; the primary seller is the one with the most item
revenue in the order.

## `categories.json`

* `late_by_category[]`: the 15 categories with the most late orders among those with at least 100 delivered
  orders. Fields: `category`, `delivered_orders`, `late_orders`, `late_rate`, `late_rate_low`,
  `late_rate_high`, `share_of_delivered`, `share_of_late`, `excess_late_orders`, `avg_score`. Orders are
  assigned to their primary category.
* `categories_below_min_orders`: how many categories were left out for size.
* `revenue_by_category[]`: the 12 largest item categories by revenue plus one `other (N categories)` row.
  Fields: `category`, `items`, `orders` (`null` on the other row), `price`, `freight`, `revenue` (price +
  freight, BRL), `revenue_share`, `cumulative_share`, `freight_share_of_revenue`. Delivered orders only, each
  item in its own category.
* `revenue_total` (BRL), `revenue_currency` (`BRL`).

## `estimate_accuracy.json`

* `clamp`: `min` (-40), `max` (30), `note`. The first row counts every order 40 or more days early and the last
  row every order 30 or more days late.
* `summary`: percentiles of days vs estimate (`days_vs_estimate_p05` … `_p95`), of promised days and of actual
  days (`_p25`, `_median`, `_p75`), `orders_below_clamp`, `orders_above_clamp`, `min_days_vs_estimate`,
  `max_days_vs_estimate`.
* `rows[]` (71): `days_vs_estimate`, `orders`, `share` and `cumulative_share` (5 decimals).

# Methodology

This page explains how I turned the nine Olist files into the numbers in this project, and why I made each
choice. The SQL in [`sql/`](../sql) and the pandas code in [`src/olist_delivery/`](../src/olist_delivery)
implement every rule below separately, and the build checks that they agree
([`outputs/reconciliation.csv`](../outputs/reconciliation.csv)).

## Source and version

The Brazilian E-Commerce Public Dataset by Olist, published on Kaggle
(<https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce>) under CC BY-NC-SA 4.0. Kaggle's API listed
version 2, last updated 2021-10-01, 126,186,995 bytes, when I checked on 2026-10-11.

The environment I built this in could not reach Kaggle, so I downloaded the nine CSVs on 2026-10-11 at 19:24 UTC
from a public GitHub mirror (`https://raw.githubusercontent.com/dujiaying/olist/master/data/<file>.csv`).
They total 126,144,332 bytes. `python -m olist_delivery check` counts rows with a CSV parser and records
SHA-256 checksums ([`outputs/source_check.json`](../outputs/source_check.json)):

* Eight files match the Kaggle v2 row counts exactly.
* The reviews file has 100,000 rows where Kaggle v2 has 99,224. It has 99,173 distinct review ids and covers
  all 99,441 orders. This matches the dataset's earlier 100,000-review release, so the mirror's reviews file is
  older than Kaggle v2. Every review number in this project comes from that file.

The pipeline accepts either version and says which one it loaded. To reproduce from Kaggle, download the
dataset into `data/raw/` (see [`data/README.md`](../data/README.md)) and run `python -m olist_delivery all`.
Review metrics will move slightly; everything else should match.

## Layers and grain

| Layer | Tables | Grain |
|---|---|---|
| `raw` | one table per file, every column text | as landed |
| `stg` | typed copies; review comments replaced by presence flags | one row per source row |
| `core.fct_order_items` | item fact | `(order_id, order_item_id)` |
| `core.order_payments` | payments rolled up | `order_id` |
| `core.order_review` | chosen review | `order_id` (orders with a review) |
| `core.fct_orders` | order fact with outcome, days, review, route | `order_id`, every order in the source |
| `mart.*` | analysis tables | stated in each table's comment in `03_analytics.sql` |

Payments are always rolled up to the order before they meet items. Joining the raw payment rows to items
repeats each item once per payment row: on this data a naive `orders × payments × items` join reports
R$16,566,543.85 of item revenue instead of R$15,843,553.24 (`mart.fanout_check`).

## Delivery definitions

**Timing population.** Orders with `order_status = 'delivered'` and both a delivery date and an estimated date:
96,470 of 99,441 orders. Everything else is counted in `mart.delivery_population` and never dropped silently:

| Outcome | Orders |
|---|---|
| on time (delivered on or before the estimated day) | 89,936 |
| late | 6,534 |
| status `delivered` but no delivery date | 8 |
| not delivered (shipped, canceled, unavailable, invoiced, processing, created, approved) | 2,957 |
| canceled but carrying a delivery date | 6 |

**Late.** `CAST(order_delivered_customer_date AS DATE) > CAST(order_estimated_delivery_date AS DATE)`. I compare
calendar dates. Every estimated date in the file is stored at 00:00:00 (a validation check
confirms this), so a timestamp comparison would call an order late if it arrived at any time on its estimated
day. The timestamp rule gives 8.1% late against 6.8% for the date rule; 1,292 orders arrived on the estimated
day itself.

**Days vs estimate.** Delivered date minus estimated date in whole days. Negative means early. **Promised
days** is estimated date minus purchase date; **actual days** is delivered date minus purchase date.

**Delivery legs.** Seller handling is purchase date to carrier hand-off date; carrier transit is hand-off to
delivery. Orders whose hand-off falls on a calendar day before the purchase or after the delivery (23 delivered
orders) are left out of the legs only.

**Delay buckets.** 15+ days early, 8-14 early, 1-7 early, on the estimated day, 1-3 late, 4-7 late, 8-14 late,
15+ late. The edges are in `config.DELAY_BUCKETS` and the same `CASE` in `02_transformations.sql`; a test
checks every boundary.

**Months.** Orders are grouped by purchase month. The monthly series covers January 2017 to August 2018: 2016
has three sparse months (1, 265 and 1 delivered orders) and no order bought in September or October 2018 was
delivered before the data ends.

## Review rule

Some orders have two or three reviews (555 orders; the scores differ in 209 of them), and 802 review ids are
attached to more than one order. I keep **the latest answered review per order**: highest
`review_answer_timestamp`, then highest `review_creation_date`, then highest `review_id` so the choice is
deterministic. A review linked to several orders keeps its score on each of them. `test_rules.py` checks the
rule and both tie-breaks on a hand-written fixture, and `04_validation.sql` checks that no other review for the
same order was answered later.

`review_creation_date` is when Olist sent the survey and `review_answer_timestamp` is when the customer
answered. I compare the answer time with the delivery timestamp to flag reviews written before the parcel
arrived.

## Attributing orders to routes and categories

An order can include items from several sellers (1,278 orders) and several categories. Delivery dates exist
only at order level, so each order gets one **primary seller** and one **primary category**: the seller (or
category) with the most item revenue in that order, ties broken alphabetically. A route is primary seller
state → customer state. With this rule routes and categories each add back to exactly the timing population,
which a validation check confirms.

Revenue composition uses the item's own category instead (item grain), because revenue is additive by item.

## Comparing groups fairly

* Rates are always `sum(late) / sum(delivered)` inside the group. No measure averages rates.
* Each group has its share of delivered orders, share of late orders, and **excess late orders**: late orders
  minus what the group would have at the overall 6.8% rate.
* 95% **Wilson** intervals for every group late rate. Routes and categories with fewer than 100 delivered
  orders are not ranked by rate (70 of 410 routes meet that bar and they hold 94.6% of delivered orders).

## Association between lateness and reviews

I show it descriptively (average score and share of 1-star reviews by delay bucket), then add two simple
comparisons in `analyze.score_comparison`: a Welch t-test on mean scores and a normal-approximation interval
for the difference in 1-star share. Both assume independent orders, which repeat customers and shared reviews
slightly break, so I treat them as a check that the gap is far larger than noise and nothing more.

To see whether the gap is a mix effect, I also compute it inside each customer state, primary category and
primary seller and take the average weighted by late reviews (`mart.score_gap_within_groups`). That rules out
some confounding by where the customer lives, what they bought and who sold it. It does not make the result
causal: within a seller, late orders can still differ in product, size, price or timing.

## Repeat purchase

Olist issues a new `customer_id` for every order, so customers are counted by `customer_unique_id`. A repeat
customer has delivered orders on two or more different purchase days. Counting two or more orders instead
gives 3.0% against 2.2%, because some people placed two orders at the same checkout. Cohorts are by month of
first delivered purchase; 90- and 180-day return rates are flagged when a cohort does not have 180 days of data
after it.

## Revenue and reconciliation

Revenue here is item price plus freight as charged to the customer. The dataset has no costs, so nothing in
this project is profit or margin. Payments and item revenue are compared per order and each order goes into
one class (`mart.payment_reconciliation`); the classes add up to the full gap, which a validation check
confirms. Vouchers are payment rows, so they are inside `payment_value` and don't cause a gap by themselves.

## Two pipelines, one answer

`python -m olist_delivery build` runs `00` to `04` in DuckDB and stops if any `error` check fails.
`python -m olist_delivery analyze` rebuilds the same metrics from the raw CSVs in pandas without reading the
database, then compares 40 headline metrics and 12 whole tables against the SQL marts: counts must match
exactly, rates within 1e-9, money within one cent. The current run matches 52 of 52.

## What I did not do

* No causal model. The data has no carrier, shipping method, weight-based routing or promotion fields, and
  there is no experiment.
* No profit, margin or cost analysis (no cost data).
* No text analysis of review comments. The text never leaves the local database.

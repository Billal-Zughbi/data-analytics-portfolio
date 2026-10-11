# Data quality report

What I checked, what passed, and what the data gets wrong. All values are from the run on the GitHub mirror
copy (2026-10-11). Full results: [`outputs/validation_results.csv`](../outputs/validation_results.csv),
[`outputs/source_check.json`](../outputs/source_check.json) and
[`outputs/reconciliation.csv`](../outputs/reconciliation.csv). `python -m olist_delivery build` prints the
same table and exits non-zero if any `error` check fails.

## Summary

| | Result |
|---|---|
| Source files | 9 of 9 present, SHA-256 verified against the checksums recorded at download |
| Row counts | 8 files match Kaggle v2; reviews has 100,000 rows (Kaggle v2: 99,224), see below |
| Error-level checks (`04_validation.sql`) | 52 of 52 pass |
| Known data issues (warn) | 10 recorded, all handled as described below |
| SQL vs pandas reconciliation | 52 of 52 match (40 headline metrics, 12 whole tables) |
| Power BI CSVs vs pipeline | 21 of 21 expected values reproduced from the published CSVs |
| Tests | 60 pass with the real data present (53 pass and 7 skip without it) |

## Source version

| File | Rows parsed | Kaggle v2 rows |
|---|---|---|
| orders | 99,441 | 99,441 |
| customers | 99,441 | 99,441 |
| order items | 112,650 | 112,650 |
| order payments | 103,886 | 103,886 |
| order reviews | **100,000** | **99,224** |
| products | 32,951 | 32,951 |
| sellers | 3,095 | 3,095 |
| geolocation | 1,000,163 | 1,000,163 |
| category translation | 71 | 71 |

The mirror's files total 126,144,332 bytes against 126,186,995 listed for Kaggle v2, so they are not
byte-identical. The reviews file has 100,000 rows, 99,173 distinct review ids and a review for every one of the
99,441 orders, which matches the dataset's earlier 100,000-review release. Rows are counted with a CSV parser
because some review comments contain line breaks, so a plain line count overstates the file. I could not
download Kaggle v2 from this environment to compare directly. The pipeline recognises both versions; running it
on Kaggle v2 would mainly change the review metrics.

## Error-level checks (all pass)

| Group | Checks | What they cover |
|---|---|---|
| load | 8 | every landed row survives typing in each staging table |
| types | 4 | no value present in raw becomes NULL after `TRY_CAST` (timestamps, prices, payments, review fields) |
| primary key | 8 | uniqueness and non-null for orders, customers, items `(order_id, order_item_id)`, payments `(order_id, payment_sequential)`, reviews `(review_id, order_id)`, products, sellers, category translation |
| referential integrity | 6 | zero orphans for items→orders, items→products, items→sellers, orders→customers, reviews→orders, payments→orders |
| domain | 5 | review score 1-5, known statuses, price > 0 and freight ≥ 0, payments ≥ 0, estimates stored at midnight |
| grain | 3 | order fact = one row per order, item fact = one row per item, one chosen review per reviewed order |
| review rule | 1 | no review for the same order was answered after the chosen one |
| fan-out | 3 | order fact item count, item revenue and payment total equal the source tables |
| delivery rule | 5 | outcomes cover every order; `is_late` only in the timing population and equal to a direct date comparison; buckets agree with lateness; no estimate before purchase |
| timestamps | 1 | no delivery before purchase |
| reconciliation | 8 | payment gap classes add up to the whole gap and cover every order; routes, categories, months and delay buckets add back to the timing population; category revenue equals order revenue; Wilson bounds contain each rate |

`tests/test_sql.py` builds a deliberately broken copy of the fixture (an orphan item and a duplicate order id)
and confirms the build fails with `orphans_items_to_orders` and `pk_orders.order_id`.

## Known data issues (warn) and how each is handled

| Check | Value | Handling |
|---|---|---|
| orders without items | 775 | unavailable 603, canceled 164, created 5, invoiced 2, shipped 1. Kept in order counts; they explain R$162,591.95 of the payments vs items gap |
| orders without payments | 1 | a delivered order with R$143.46 of items; shown as its own reconciliation class |
| zero-value payments | 9 | kept; they add nothing to totals |
| products without category | 610 | category shown as `unknown` |
| categories without translation | 2 | `pc_gamer` and `portateis_cozinha_e_preparadores_de_alimentos` keep their Portuguese names |
| customer zip prefixes not in geolocation | 278 | state comes from the customer file, so no effect on any metric |
| seller zip prefixes not in geolocation | 7 | same as above |
| carrier hand-off before purchase (timestamp) | 166 | left in all metrics; the 23 delivered orders where it is out of order by calendar day are left out of the handling and transit legs only |
| customer delivery before carrier hand-off | 23 | same as above |
| non-delivered status with a delivery date | 6 | canceled orders; outside the timing population and counted separately |

One more warn-level check, orders without any review, passes in this copy (0).

## Recorded measurements (info)

| Check | Value | Meaning |
|---|---|---|
| status delivered but no delivery date | 8 | counted as `delivered_missing_date`, outside the timing population |
| orders with more than one review | 555 | the latest answered review is kept (scores differ in 209 of them) |
| review ids linked to more than one order | 802 | each order keeps that review's score |
| exact duplicate geolocation rows | 261,831 | geolocation is only used for zip coverage |
| extra item revenue from a naive join | R$722,990.61 | `orders × payments × items` reports R$16,566,543.85 instead of R$15,843,553.24 |

## Reconciliation of money

| Class | Orders | Payments minus items (BRL) |
|---|---|---|
| no items (canceled, unavailable and similar) | 775 | 162,591.95 |
| paid in instalments, payments above items | 249 | 3,063.69 |
| single payment, payments above items | 15 | 6.45 |
| payments below items | 39 | -199.08 |
| no payments | 1 | -143.46 |
| match within one cent | 98,362 | -0.67 |
| **Total** | **99,441** | **165,318.88** |

Payment types: credit card R$12,542,084.19, boleto R$2,869,361.27, voucher R$379,436.87, debit card
R$217,989.79, not defined R$0.00. Vouchers are payment rows, so an order paid partly by voucher still
matches its items.

## What is not checked

* Whether delivery and estimated dates are correct in the real world. I can only check that they are
  internally consistent.
* Review text. It is never read beyond counting whether a comment exists.
* Geolocation coordinates, which no metric uses.

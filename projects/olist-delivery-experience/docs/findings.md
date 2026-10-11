# Findings

**Question:** how much does late delivery cost in customer review scores, and where do the late orders come
from?

Every number below comes from the generated outputs listed under each finding. The scope throughout is the
Olist public dataset (purchases from 2016-09-04 to 2018-10-17), using the GitHub mirror copy described in the
[methodology](methodology.md). Its reviews file is the earlier 100,000-row release. "Delivered orders" means the
96,470 orders with status `delivered` and both dates present. These are associations in observational data;
none of them is a measured effect of an intervention.

## 1. Late orders score about two stars lower

* **Metric and units.** Mean review score (1-5 stars) and share of reviews scored 1, using the latest review
  per order, for late vs on-time delivered orders. Late = delivered on a later calendar day than estimated.
* **Source.** `mart.review_by_delay`, `mart.headline_metrics`, `mart.score_gap_within_groups`
  ([`outputs/analysis/`](../outputs/analysis)); `outputs/statistics.json`; figure `review_by_delay.png`.
* **Result.** Late orders averaged **2.26** stars against **4.28** for orders that arrived on time or early, a gap
  of 2.02 stars (95% interval 1.99 to 2.06; Welch t = -102.5). **54.2%** of late orders got a 1-star review,
  against **6.8%** of on-time orders. Late orders are 6.8% of delivered orders but carry **36.5%** of all 1-star
  reviews.
* **Shape.** The drop starts as soon as an order is late and levels off after about a week:

  | Days vs estimate | Orders | Average score | 1-star share |
  |---|---|---|---|
  | 15+ days early | 34,939 | 4.31 | 6.7% |
  | 8-14 days early | 36,364 | 4.30 | 6.7% |
  | 1-7 days early | 17,341 | 4.19 | 7.3% |
  | On the estimated day | 1,292 | 4.01 | 9.1% |
  | 1-3 days late | 1,870 | 3.28 | 25.3% |
  | 4-7 days late | 1,802 | 2.09 | 59.1% |
  | 8-14 days late | 1,478 | 1.67 | 70.6% |
  | 15+ days late | 1,384 | 1.72 | 69.1% |

  Arriving very early adds little: 15+ days early and 1-7 days early differ by about 0.13 stars. The Spearman
  correlation between days vs estimate and score is only -0.18, because most orders sit in the flat, early
  part of the curve.
* **Baseline.** On-time and early orders (89,936).
* **Why it matters.** Review scores are what other buyers see. Lateness is the clearest pattern linked to 1-star
  reviews in this data, and it is something an operations team can measure every day.
* **Alternative explanations and limits.** Late orders may differ in other ways: a seller who ships late may
  also pack badly or answer slowly. To check for mix effects I compared late and on-time orders inside the same
  customer state, primary category and primary seller. The weighted gaps are -2.01, -2.02 and -1.98 stars (the
  seller comparison covers 1,220 sellers and 6,475 of the 6,534 late orders), so the gap is not explained by
  where customers live, what they bought or who sold it. It is still a correlation: within a seller, late
  orders can differ in size, price, product or season, and I have no carrier data. Finding 5 adds that most of
  these scores were given before the parcel arrived. Every order in this copy has a review; Kaggle v2 has
  fewer reviews, so the numbers could shift slightly there.

## 2. Estimates are generous, yet 6.8% of orders still miss them

* **Metric and units.** Days vs estimate (delivered date minus estimated date, days); promised days (purchase to
  estimate) and actual days (purchase to delivery); late rate (share of delivered orders).
* **Source.** `mart.estimate_accuracy`, `mart.headline_metrics`, `mart.state_performance`,
  `outputs/statistics.json`; figure `estimate_accuracy.png`.
* **Result.** The median order arrived **12 days early** (middle half: 17 to 7 days early; 95th percentile: 3
  days late). **78.9%** arrived at least a week early. The median estimate was 24 days from purchase and the
  median delivery took 10. Even so, **6,534 orders (6.8%)** arrived after the estimated day.
* **The rule matters.** Comparing timestamps instead of calendar dates would put the late rate at 8.1%, because
  estimates are stored at midnight and 1,292 orders arrived on the estimated day itself. I use dates.
* **Padding varies by place.** São Paulo customers had a median estimate of 19 days for a median delivery of 7;
  Rio de Janeiro customers 25 days for 12. Some distant northern states had the longest estimates (median 46 days
  for Amazonas, 48 for Amapá) and few late orders, but they are small (145 and 67 delivered orders) and their
  intervals are wide.
* **Baseline.** All 96,470 delivered orders.
* **Why it matters.** Large padding with a 6.8% miss rate suggests the estimates are not tuned to the route: the
  buffer is wide on average but too thin where delays are common.
* **Alternative explanations and limits.** I can't see how Olist set estimates or whether they were changed on
  purpose. The average estimate fell in mid-2018 (from 28.4 days for June purchases to 15.8 for August) while
  the late rate rose from 1.2% to 6.2%. That fits tighter estimates, but the last months are also cut off by the
  end of the data: slow orders bought in August 2018 may not have been delivered yet, which would make that
  month look faster than it was.

## 3. Late orders cluster on a few routes; product category matters much less

* **Metric and units.** Per route (primary seller state → customer state), customer state and primary category:
  delivered orders, late orders, late rate with a 95% Wilson interval, share of delivered and of late orders,
  and excess late orders (late orders minus what the group would have at the 6.8% overall rate). Rates are only
  ranked for groups with at least 100 delivered orders.
* **Source.** `mart.route_performance`, `mart.state_performance`, `mart.category_performance`; figure
  `routes.png`; `routes.json` and `categories.json`.
* **Result.**
  * **SP → RJ** carried **8.5%** of delivered orders but **17.6%** of late ones. Its late rate was **14.1%**
    (13.4% to 14.9%), about 600 late orders more than the overall rate would give.
  * **SP → SP** is the largest route (31.9% of delivered orders) and the largest source of late orders by count
    (21.9%), but its late rate is low (4.6%, 4.4% to 4.9%), about 653 fewer late orders than average.
  * By destination, **Rio de Janeiro** customers were 12.8% of delivered orders and 22.9% of late ones (late rate
    12.1%). Several Northeast states had the highest rates: Alagoas 21.4% (17.7% to 25.7%, 397 orders),
    Maranhão 17.4%, Sergipe 15.2%, Piauí 13.9%, Ceará 13.8%, Bahia 12.2%.
  * The highest route rates among routes with 100+ orders were SP → AL at 23.9% (19.1% to 29.5%, 255 orders)
    and SP → MA at 18.9% (15.7% to 22.6%).
  * Among the 52 categories with 100+ delivered orders, the late rate ranges from 2.6%
    (construction_tools_safety, 154 orders) to 11.9% (audio, 344 orders, 8.9% to 15.8%). The largest excess for
    any category is 64 late orders (health_beauty, with bed_bath_table about the same), against 600 for the
    SP → RJ route.
* **Baseline.** The overall late rate of 6.8%.
* **Why it matters.** A handful of destination routes, led by São Paulo to Rio de Janeiro, account for a share
  of late orders well beyond their volume. That points at delivery estimates or carrier performance on those
  lanes before anything product-related.
* **Alternative explanations and limits.** Route stands in for distance, carrier network, urban access and
  local conditions all at once; the data has no carrier or shipping-method fields to separate them. Most sellers
  are in São Paulo, so most routes start there. Each order is assigned to its primary seller; 1,278 orders
  (1.3%) have more than one seller. Category rates partly reflect where each category is shipped to.

## 4. Four months produced over half of all late orders

* **Metric and units.** Late rate by purchase month; average days per leg (purchase to carrier hand-off, hand-off
  to delivery) and promised days, weighted by delivered orders.
* **Source.** `mart.monthly_delivery`, `mart.monthly_by_destination`,
  `outputs/analysis/peak_period_comparison.csv`; figures `monthly_late_rate.png` and `delivery_legs.png`.
* **Result.** Purchases from November-December 2017 and February-March 2018 were **27%** of delivered orders but
  **55%** of late orders. The late rate reached **12.4%** for November 2017 purchases (7,288 delivered orders, the
  busiest month) and **19.0%** for March 2018, against 2.8% to 4.6% in most months of 2017.

  | Period (purchase month) | Delivered | Late rate | Promised days | Seller handling days | Carrier transit days |
  |---|---|---|---|---|---|
  | Oct 2017 | 4,478 | 4.2% | 23.7 | 3.3 | 8.4 |
  | Nov-Dec 2017 | 12,801 | 10.3% | 25.4 | 3.8 | 11.4 |
  | Jan 2018 | 7,069 | 5.7% | 26.9 | 3.5 | 10.5 |
  | Feb-Mar 2018 | 13,558 | 16.6% | 23.9 | 3.4 | 13.2 |
  | Apr-May 2018 | 13,547 | 5.5% | 23.9 | 2.8 | 8.6 |

  In February-March 2018 the promised days were the same as in April-May and seller handling barely moved, but
  carrier transit took about 4.6 days longer. The spike was broad but worst for Rio de Janeiro customers: 34.0%
  late for February purchases and 34.5% for March, against 7.3% and 9.4% for São Paulo customers.
* **Baseline.** Neighbouring calm months (October 2017, April-May 2018).
* **Why it matters.** Lateness is not a steady background rate. A monthly view would have shown these periods
  as they happened, and the legs show which part of the trip slowed down.
* **Alternative explanations and limits.** November 2017 includes Black Friday, so volume alone may explain part
  of it. Nothing in the data names a cause for February-March 2018: it could be carrier capacity, weather,
  a local disruption in Rio de Janeiro or something else, and I can't test any of these here. Grouping by
  purchase month spreads a disruption in one delivery month across two purchase months. The final months are
  cut off by the end of the data (see finding 2).

## 5. Most late orders were reviewed before they arrived

* **Metric and units.** Share of late orders whose review answer timestamp is earlier than the delivery
  timestamp.
* **Source.** `mart.headline_metrics` (`pct_late_answered_before_delivery`,
  `pct_late_low_scores_answered_before_delivery`), `mart.review_by_delay`.
* **Result.** **70.4%** of reviews on late orders were answered before the recorded delivery time, and **90.6%**
  of the 1- and 2-star reviews on late orders were. For on-time orders the share is under 1% in every bucket.
  It rises with lateness: 22.7% for 1-3 days late, 77.4% for 4-7 days, 96.1% for 8-14 days.
* **Baseline.** On-time orders.
* **Why it matters.** For most late orders, the score was given while the customer was still waiting. Those
  scores are about the delivery, and they also land on the seller's and product's ratings.
* **Alternative explanations and limits.** The dataset says when surveys were sent and answered but not what
  triggered them. Delivery timestamps could be recorded late in some cases, which would inflate this share
  somewhat. It does not change the score gap in finding 1; it changes how to read it.

## 6. Context: revenue mix and repeat buying

* **Metric and units.** Item revenue = price + freight (BRL), delivered orders, by item category. Repeat rate =
  share of customers (`customer_unique_id`) with delivered orders on two or more purchase days. Return within
  180 days after a late vs on-time first order, with Wilson intervals.
* **Source.** `mart.category_revenue`, `mart.customer_repeat`, `mart.repeat_by_first_delivery`,
  `mart.payment_reconciliation`, `outputs/statistics.json`.
* **Revenue.** Delivered orders carried R$15,419,773.75 of item revenue, of which freight was 14.3%. The largest
  categories were health_beauty (9.2%), watches_gifts (8.2%) and bed_bath_table (7.9%); the top 10 categories
  made up 62.4%. There are no cost fields, so this says nothing about profit or margin.
* **Payments vs items.** Payments total R$16,008,872.12 against R$15,843,553.24 of item revenue across all
  orders, a gap of R$165,318.88. R$162,591.95 of it is 775 canceled or unavailable orders that have payments but
  no items, and R$3,063.69 is 249 orders paid in instalments where the total paid is above the item value, which
  looks like instalment interest. Vouchers are recorded as payments, so they don't create a gap. 98,362 orders
  match to the cent.
* **Repeat buying is rare.** Only **2.2%** of the 93,358 customers with a delivered order bought again on a
  later day (3.0% if two orders at the same checkout count). Customers whose first order was late came back
  within 180 days at 1.6% (61 of 3,819; 1.2% to 2.0%), against 2.0% after an on-time first order (1,048 of
  52,215; 1.9% to 2.1%). The intervals overlap, so this data can't show whether lateness changes repeat buying.
* **Why it matters.** With so few repeat customers, review scores seen by new buyers may matter more to this
  marketplace than loyalty does. I can't test that here.
* **Limits.** The data covers about two years and has no marketing, returns or customer-service fields.

## Next steps for a marketplace operations lead

These follow from the findings and are sized to what the data can support. None of them has been tried.

1. **Review estimates on the routes with the most excess late orders**, starting with São Paulo to Rio de Janeiro
   and the Northeast states. Change the buffer on a small share of orders first and compare late rates and
   scores against the rest.
2. **Report the late rate weekly by route and destination state** with a simple alert threshold, so a period like
   February-March 2018 is visible within days, and show the handling and transit legs next to it.
3. **Test sending the review survey only after delivery**, or asking about delivery separately, on a sample of
   orders. That would show how much of the low scoring is about waiting and keep delivery delays out of seller
   and product ratings.
4. **Add carrier and shipping-method data** to the order fact. Without it I can't tell whether a slow route is a
   distance problem, a carrier problem or a seller problem.

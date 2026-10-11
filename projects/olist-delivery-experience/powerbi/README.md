# Power BI: model and report kit

## What exists, and what does not

| Artifact | Status |
|---|---|
| Star-schema CSVs | **Built.** Nine aggregate tables in [`../data/sample/`](../data/sample), written by `python -m olist_delivery export`. |
| Power Query (M) | [`powerquery.m`](powerquery.m): a folder parameter, one loader function and one query per table. |
| DAX measures | [`measures.dax`](measures.dax): explicit measures only, every rate a ratio of sums. |
| Theme | [`theme.json`](theme.json), matching the portfolio site's palette. |
| `.pbix` / `.pbip` report | **Not created.** Power BI Desktop runs only on Windows and was not available where I built this. Nothing in this folder is a report file. |

**Validation status.** The CSV tables are checked in Python: keys are unique, every fact row joins to its
dimensions without fan-out, and 21 headline measures recomputed from the CSVs exactly as the DAX defines them
match the pipeline (table below, from [`../outputs/powerbi_expected_values.csv`](../outputs/powerbi_expected_values.csv)).
The M queries, the relationships, the DAX and the report pages below have **not been run or opened in Power BI
Desktop**. Treat them as a specification until someone builds the file and checks the expected values.

## Why the facts are aggregated

An order-level fact without identifiers would still be 99,441 rows and several megabytes, too large to keep in
git next to the code. I publish facts at the coarsest grain that still answers the report's questions:

| Table | Grain | Rows | Answers |
|---|---|---|---|
| `fact_route_month` | month × primary seller state × customer state | 3,996 | volume, late rate, days vs estimate, reviews by late/on-time, revenue, payments, by route and month |
| `fact_category_month` | month × primary category | 1,302 | late rate and reviews by category |
| `fact_item_revenue_month` | month × item category × delivered flag | 1,858 | revenue composition |
| `fact_delay_review` | month × delay bucket × review score | 785 | score distribution by how late or early the order was |
| `fact_customer_cohort` | first-purchase month | 23 | repeat purchase |

Every numeric column is additive (counts and sums), so averages and rates are rebuilt correctly at any level.
The cost of aggregating is cross-filtering: a category slicer can't filter route visuals and a route slicer
can't filter category visuals, because no single table holds both. The report spec keeps those on separate
pages, and each page says which slicers apply.

## Model

```
                        dim_month (month)
             ┌──────────────┬───┴──────────┬───────────────────┬────────────────────┐
             │1             │1             │1                  │1                   │1
             ▼*             ▼*             ▼*                  ▼*                   ▼*
   fact_route_month  fact_category_month  fact_item_revenue_month  fact_delay_review  fact_customer_cohort
      ▲*      ▲*            ▲*               ▲*                        ▲*
      │1      │1            │1               │1                        │1
dim_customer  dim_seller    └── dim_category ┘                   dim_delay_bucket
   _state       _state          (category)                        (delay_bucket)
```

| From (many) | To (one) | Cardinality | Filter direction |
|---|---|---|---|
| `fact_route_month[month]` | `dim_month[month]` | many-to-one | single |
| `fact_route_month[customer_state]` | `dim_customer_state[customer_state]` | many-to-one | single |
| `fact_route_month[seller_state]` | `dim_seller_state[seller_state]` | many-to-one | single |
| `fact_category_month[month]` | `dim_month[month]` | many-to-one | single |
| `fact_category_month[category]` | `dim_category[category]` | many-to-one | single |
| `fact_item_revenue_month[month]` | `dim_month[month]` | many-to-one | single |
| `fact_item_revenue_month[category]` | `dim_category[category]` | many-to-one | single |
| `fact_delay_review[month]` | `dim_month[month]` | many-to-one | single |
| `fact_delay_review[delay_bucket]` | `dim_delay_bucket[delay_bucket]` | many-to-one | single |
| `fact_customer_cohort[month]` | `dim_month[month]` | many-to-one | single |

`dim_state.csv` is loaded twice (customer and seller roles) so both state columns can have active
relationships. `dim_month[month]` is text (`YYYY-MM`); use `month_start` for date axes, and sort
`month_name` by `month_number` and `dim_delay_bucket[label]` by `sort_order`. Hide every numeric fact column
so visuals use measures.

## Report pages

Use the default slicer **Purchase month** (`dim_month[month_start]`, between, default January 2017 to August
2018 via `in_analysis_window`) on every page.

### 1. Executive overview
* Cards: `Delivered Orders`, `Late Rate`, `Avg Days vs Estimate`, `Avg Review Score (On Time)`,
  `Avg Review Score (Late)`, `% 1-Star (Late)`, `Repeat Customer Rate`.
* Line: `Late Rate` by `dim_month[month_start]`, with `Late Rate 3M` as a second series.
* Column: `Delivered Orders` by month, as a separate visual so each chart keeps one axis.
* Text box with the scope note: delivered orders only for timing; data from the Olist public dataset, CC BY-NC-SA 4.0.

### 2. Delivery performance
* Column: `Delay Orders` by `dim_delay_bucket[label]` (sorted by `sort_order`).
* Line: `Avg Promised Days` and `Avg Actual Days` by month.
* Matrix: month rows with `Delivered Orders`, `Late Orders`, `Late Rate`, `Late Rate Change vs Prior Month`.
* Card: `Orders Outside Timing` and `Delivered Missing Date Orders`, so excluded orders stay visible.

### 3. Routes and categories
Two halves that do not cross-filter each other (see above).
* Routes: table of seller state × customer state with `Delivered Orders`, `Late Orders`, `Late Rate (min orders)`,
  `Late Rate Low 95`, `Late Rate High 95`, `Share of Delivered Orders`, `Share of Late Orders`,
  `Excess Late Orders`, sorted by `Late Orders`. Bar: `Share of Late Orders` vs `Share of Delivered Orders` for
  the top 10 routes. Filled map or bar by `dim_customer_state[customer_state]` showing `Late Rate`.
  Slicers: customer region, seller state.
* Categories: table by `dim_category[category]` with `Category Delivered Orders`, `Category Late Rate (min orders)`,
  `Category Share of Late Orders`, `Category Avg Review Score`. Bar: `Category Revenue Share` (top 12) with
  `Freight Share of Revenue` in the tooltip. Slicer: category.

### 4. Reviews and customers
* Column: `Avg Review Score by Delay` by delay bucket; second column visual `% 1-Star by Delay`.
* Cards: `Review Score Gap (Late - On Time)`, `Late Share of 1-Star Reviews`.
* Table by customer state: `Avg Review Score (Late)`, `Avg Review Score (On Time)`, `Late Rate`.
* Customers: `Repeat Customer Rate` card; column `Return Rate 180d` by cohort month (only cohorts with
  `full_180d_followup`).
* Note on the page: scores are associations with lateness, and most late-order reviews were answered before
  the parcel arrived (see `docs/findings.md`).

## Refresh steps

1. From `projects/olist-delivery-experience`, with the raw CSVs available:
   `PYTHONPATH=src python -m olist_delivery all --data-dir /path/to/olist/csvs`. This rebuilds the database,
   runs every validation and rewrites `data/sample/`.
2. In Power BI Desktop, create the text parameter `OlistSampleFolder` with the absolute path of `data/sample/`
   (ending in a path separator).
3. Add a blank query `fnLoadCsv` and one blank query per table, pasting the sections of
   [`powerquery.m`](powerquery.m).
4. Create the relationships in the table above (Model view). Turn off auto date/time.
5. Add a `_Measures` table and paste [`measures.dax`](measures.dax).
6. Import [`theme.json`](theme.json) (View → Themes → Browse for themes).
7. Build the four pages from measures only.
8. Check the measures against the table below with no filters applied (all months), then save as a Power BI
   Project (`.pbip`). `.pbix`, `cache.abf` and `localSettings.json` are git-ignored.

## Expected values (all months, no filters)

Recomputed from the published CSVs and compared with the pipeline by `export.powerbi_expected_values`.

| Measure | Expected |
|---|---|
| `Orders` | 99,441 |
| `Delivered Orders` | 96,470 |
| `Late Orders` | 6,534 |
| `Late Rate` | 6.77% (0.067731) |
| `Avg Days vs Estimate` | -11.88 days |
| `Avg Review Score (Late)` | 2.2553 |
| `Avg Review Score (On Time)` | 4.2795 |
| `% 1-Star (Late)` | 54.16% |
| `% 1-Star (On Time)` | 6.85% |
| `Late Share of 1-Star Reviews` | 36.49% |
| `Late Rate`, customer state RJ | 12.11% |
| `Late Rate`, route SP → RJ | 14.12% |
| `Share of Late Orders`, route SP → RJ | 17.63% |
| `Item Revenue (All Orders)` | R$15,843,553.24 |
| `Payments (All Orders)` | R$16,008,872.12 |
| `Item Revenue (Delivered Orders)` | R$15,419,773.75 |
| `Category Late Orders` (total) | 6,534 |
| `Delay Orders` (total) | 96,470 |
| `Cohort Customers` | 93,358 |
| `Repeat Customer Rate` | 2.16% |
| `Avg Review Score by Delay`, late buckets only | 2.2553 |

If the pipeline changes, regenerate this table from `outputs/powerbi_expected_values.csv`.

# Power BI model

The report is built on the three sanitized CSVs produced by the pipeline:

| Table | Grain | Columns |
|---|---|---|
| `fact_daily_metric` | one row per date × metric | date, metric, value, record_count |
| `dim_metric` | one row per metric (40) | metric, label, category, unit, daily_aggregation |
| `dim_date` | one row per calendar day | date, year, quarter, month, month_name, week, day_of_week, is_weekend |

```
dim_date 1 ──< fact_daily_metric >── 1 dim_metric
```

Measures live in [`measures.dax`](measures.dax): base value, step-goal consistency,
7/30-day rolling trends, year-over-year deltas and weekend vs weekday comparisons.

## Report pages

1. **Overview**: KPI cards (avg steps, resting HR, HRV, exercise minutes), monthly trend.
2. **Cardiovascular**: resting HR and HRV with 30-day rolling lines, VO2 max.
3. **Activity**: steps, distance, energy, step-goal attainment, weekday vs weekend.
4. **Mobility**: walking speed, step length, asymmetry and steadiness.
5. **Environment**: daylight, sound exposure, UV.

## Version control rules

* Save the report as a **Power BI Project (`.pbip`)** inside this folder so the model
  and report definitions are text files that diff cleanly.
* `.pbix` / `.pbit` files are git-ignored because they embed the imported data.
* The `.pbi/cache.abf` and `localSettings.json` files are git-ignored for the same reason.
* Point the data source at `../data/sample/` (synthetic, safe to publish) or at
  `../data/sanitized/` (your aggregated data). Never at a raw export.

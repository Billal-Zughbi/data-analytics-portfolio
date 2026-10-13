# Power BI: original report and rebuild kit

## What exists, and what is (and isn't) in this repository

| Artifact | Status |
|---|---|
| Original report `AppleHealthReport.pbix` (March 2025) | **Not committed.** A `.pbix` embeds its imported data model, and this one holds personal health records. It is git-ignored. |
| Original report screenshots | **Not committed.** They show real personal values. |
| Original report structure | Documented below, read from the report's `Report/Layout` definition. |
| Rebuilt model inputs | `../data/model/` star schema built from the daily tables (one value per day per metric). |
| Power Query (M) | [`powerquery.m`](powerquery.m) |
| DAX measures | [`measures.dax`](measures.dax) |
| Theme | [`theme.json`](theme.json), matching the website's palette |
| Native rebuilt `.pbix` / `.pbip` | **Not created yet.** Power BI Desktop runs only on Windows and was not available in the environment used for this rebuild. Nothing in this folder is a fake report file. |

**Validation status:** the CSV tables are tested in Python (keys unique, no join fan-out, totals reconcile with
the daily table). The M and DAX are written against that schema but have **not been executed in Power BI
Desktop yet**. The expected values below are what each measure should return; check them after building.

## Original report structure (from the layout definition)

Four pages, each with a navigator, KPI cards, a date slicer and trend visuals. Aggregations are the ones
stored in each visual's query, so this is what the report actually asked Power BI to compute.

| Page | Cards | Charts |
|---|---|---|
| Energy and Activity | Active energy (Sum), Average daily active kcal (Average), Average stand hours (Average), Total exercise minutes (Sum), Flights climbed (Sum) | Active kcal by date (line, Sum), Exercise minutes by date (column, Sum) |
| Cardiovascular | Average active HR, Average resting HR, Average HRV (Average); Minimum and maximum VO2 max | Active and resting HR by date (line, **Sum**), VO2 max by date (area, **Sum**), HRV by date (area, **Sum**) |
| Mobility and Movement | Average walking speed, step length, running speed, running stride, 6-minute walk distance (Average); Total steps, distance cycled (Sum) | Steps by date (column, Sum), Step length by date (line, **Sum**) |
| Physical and Environmental | Average physical effort, environmental and headphone audio (Average); Min/max audio levels | Headphone audio by date (column, **Sum**), Physical effort by date (line, **Sum**) |

The data model was read with `pbixray` (`ingest-pbix`, private): 28 tables, one per record type, each grouped
to one row per `creation date` in Power Query, with 25 relationships, most of them two-way and one-to-one on the
date. Every card value is reproduced in [`report_sim.py`](../src/apple_health/report_sim.py) by following the
same filter paths, and all 24 match what the report displayed.

### Review findings (confirmed against the data model)

1. **Four date relationships were inactive** (VO2 max, walking speed, step length, running stride). Cards on
   those tables ignored the page's date slicer and showed all-time values.
2. **Three tables were joined on their `value` column** instead of the date, which links unrelated readings.
3. **The stand card averaged minutes but was labelled hours** (127 "hours" is 2.1 hours of standing). A
   `StandHours` measure that divides by 60 existed but the card did not use it.
4. **Daily rules in Power Query:** running power was summed per day, headphone exposure kept each day's
   quietest reading (`List.Min`) with nine values hard-coded out, and environmental sound was averaged
   arithmetically, which understates decibels.
5. **Device handling:** steps, exercise and stand were filtered to the watch, but distance and flights kept every
   device, so walks logged by both the watch and the phone counted twice (0.84 miles per 1,000 steps against
   0.42 expected from step length).
6. **"Active" heart rate** was the average of every heart-rate reading, resting included.

## Rebuild steps (Power BI Desktop)

1. Run the pipeline: `PYTHONPATH=src python -m apple_health build` from the project folder.
2. In Power BI Desktop, create a text parameter `SampleFolder` with the absolute path of `data/model/`
   (ending in a path separator).
3. Add three blank queries and paste the sections of [`powerquery.m`](powerquery.m).
4. Model view: relate `fact_daily_metric[date]` → `dim_date[date]` and `fact_daily_metric[metric]` →
   `dim_metric[metric]` (many-to-one, single direction). Mark `dim_date` as the date table; sort
   `month_name` by `month`.
5. Add the measures from [`measures.dax`](measures.dax) to a `_Measures` table.
6. Import [`theme.json`](theme.json) (View → Themes → Browse for themes).
7. Rebuild the four pages using the measures, never raw columns with default aggregations.
8. Save as a **Power BI Project (`.pbip`)** so the model and report are text files that diff cleanly. Check the
   `.pbip` files contain no personal data before committing; `.pbi/cache.abf` and `localSettings.json` are git-ignored.

## Expected values on the full data range

Values from the Python pipeline over every day in `data/model/` (September 2014 to October 2026). Small
differences (≤ 0.1%) can come from rounding in the CSVs.

| Measure | Expected |
|---|---|
| `Avg Daily Steps` | 5,904 |
| `Avg Daily Active Energy (kcal)` | 489 |
| `Avg Daily Exercise (min)` | 40.1 |
| `Total Exercise (min)` | 93,921 |
| `Avg Stand Hours` | 10.9 |
| `Avg Daily Flights Climbed` | 8.1 |
| `Avg Resting HR (bpm)` | 66.6 |
| `Avg Heart Rate (bpm)` | 88.0 |
| `Avg HRV SDNN (ms)` | 40.2 |
| `Latest VO2 Max` | 36.45 |
| `Min VO2 Max` / `Max VO2 Max` | 33.33 / 45.24 |
| `Avg Walking Speed (mph)` | 2.56 |
| `Avg Step Length (in)` | 26.4 |
| `Avg Physical Effort` | 3.59 |
| `Typical Environmental Sound (dBA)` | 80.4 |
| `Typical Headphone Level (dBA)` | 81.7 |
| `% Days Meeting Step Goal` | 11.8% |
| `Weekend vs Weekday Steps %` | −24.2% |
| `Days With Data` | 4,374 |

If the daily tables change, regenerate these from `data/model/fact_daily_metric.csv`.

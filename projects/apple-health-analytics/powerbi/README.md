# Power BI: original report and rebuild kit

## What exists, and what is (and isn't) in this repository

| Artifact | Status |
|---|---|
| Original report `AppleHealthReport.pbix` (March 2025) | **Not committed.** A `.pbix` embeds its imported data model, and this one holds personal health records. It is git-ignored. |
| Original report screenshots | **Not committed.** They show real personal values. |
| Original report structure | Documented below, read from the report's `Report/Layout` definition. |
| Rebuilt model inputs | `../data/sample/` star schema generated from **synthetic** data. |
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

The model has one table per Apple Health record type (29 tables), each with `sourceName`, `creationDate`,
`startDate`, `endDate`, `value` and `unit` columns, and dates taken from `creationDate`.

### Review findings

1. **Rate metrics use `Sum` on date axes** (bold above). Heart rate, VO2 max, HRV, step length, audio level and
   physical effort cannot be added. If a day has more than one row, the chart shows their sum. The extracted
   CSVs do have several rows per day for these types.
2. **"Average daily active kcal" uses `Average` over the record-level column.** That is the mean of individual
   readings, not of daily totals, unless Power Query had already grouped rows by day.
3. **Charts use `creationDate`**, the time a record was written, which can be days after the activity
   (for example, running-speed records written in a later sync). `startDate` is the time the activity happened.
4. **No device de-duplication.** Steps, distance and flights from a watch and a phone are both summed.
5. **Audio levels are averaged arithmetically.** Decibels need an energy average.

The compressed data model (`DataModel`, XPress9) could not be opened without Power BI Desktop, so whether
Power Query already reduced rows to one per day is **unconfirmed**. Findings 1 and 2 are risks in the visuals'
configuration; the rebuild removes them by fixing each metric's daily rule upstream.

## Rebuild steps (Power BI Desktop)

1. Run the pipeline: `PYTHONPATH=src python -m apple_health demo` from the project folder.
2. In Power BI Desktop, create a text parameter `SampleFolder` with the absolute path of `data/sample/`
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

## Expected values on the synthetic sample

Values from the Python pipeline for the full year. Small differences (≤ 0.1%) can come from rounding in the CSVs.

| Measure | Expected |
|---|---|
| `Avg Daily Steps` | 8,215 |
| `Avg Daily Active Energy (kcal)` | 583 |
| `Avg Daily Exercise (min)` | 28.1 |
| `Total Exercise (min)` | 10,053 |
| `Avg Stand Hours` | 12.0 |
| `Avg Resting HR (bpm)` | 62.4 |
| `Avg HRV SDNN (ms)` | 44.6 |
| `Latest VO2 Max` | 42.2 |
| `Min VO2 Max` / `Max VO2 Max` | 37.94 / 44.09 |
| `Avg Walking Speed (mph)` | 3.04 |
| `Avg Step Length (in)` | 27.9 |
| `Typical Environmental Sound (dBA)` | 69.4 |
| `Typical Headphone Level (dBA)` | 71.0 |
| `% Days Meeting Step Goal` | 17.3% |
| `Days With Data` | 365 |

If you change the generator or pipeline, regenerate these from `website/src/data/generated/apple-health/summary.json`.

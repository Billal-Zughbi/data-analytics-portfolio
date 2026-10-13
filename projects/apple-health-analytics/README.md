# Apple Health Analytics

My Apple Health data from September 2014 to October 2026, rebuilt from the raw `export.xml`: a Python
pipeline with written-down daily rules, a check of every number on my original March 2025 Power BI report,
a star schema for a rebuilt Power BI model, and the data behind the interactive case study on the site.

Case study: [`/projects/apple-health-analytics`](../../website/src/app/projects/apple-health-analytics/page.tsx).

> **Privacy.** The data here is real and is published with the owner's agreement, as **one value per day**.
> The export itself (`export.zip`, `export.xml`, `export_cda.xml`), workout GPS routes, the original `.pbix`,
> its screenshots, device names and times of day are never committed. The ingest steps that read them run
> only on a machine that has the files.

## Questions

1. Were the numbers on the original Power BI report right, and where they weren't, why?
2. What does a fresh export say once each metric is counted properly: one device per hour, rates averaged,
   decibels averaged as sound energy?
3. What changed over twelve years of steps, workouts and heart rate?

## How it fits together

```
export.xml (private) ─► ingest-xml ─► data/daily/          one row per day, workouts per month, source profile
original .pbix (private) ─► ingest-pbix ─► data/original/  the old model's daily tables, Power Query rules,
                                                           relationships and report layout
data/daily + data/original ─► build ─► website JSON, data/model/ star schema, outputs/data_quality.json
```

`build` runs from the committed files only, so anyone can reproduce the site's numbers. CI reruns it and fails
if any committed output changes.

| Module | Responsibility |
|---|---|
| [`metrics.py`](src/apple_health/metrics.py) | Record type → metric, canonical unit, daily rule, unit conversions |
| [`extract.py`](src/apple_health/extract.py) | Streaming `iterparse` over a 1.9 GB file; local time; device names replaced by a class and an anonymous rank |
| [`transform.py`](src/apple_health/transform.py) | Unit conversion, duplicate removal, one device per metric-hour, daily fact table |
| [`quality.py`](src/apple_health/quality.py) | Profile of a fresh export: duplicates, units, ranges, overlaps, coverage |
| [`xml_source.py`](src/apple_health/xml_source.py) | Private ingest of `export.xml` → `data/daily/` |
| [`pbix_source.py`](src/apple_health/pbix_source.py) | Private ingest of the original `.pbix` (needs `requirements-pbix.txt`) → `data/original/` |
| [`report_sim.py`](src/apple_health/report_sim.py) | Recomputes each original card by following Power BI's filter paths over the old relationships |
| [`catalog.py`](src/apple_health/catalog.py) | One entry per published metric: label, unit, page, plausible daily range |
| [`analysis.py`](src/apple_health/analysis.py) | Cleaning, yearly and weekly patterns, distance check, fitness trend, records, workouts |
| [`publish.py`](src/apple_health/publish.py) | Card notes, findings, quality checks, website JSON and the star schema |
| [`legacy/`](legacy/) | The original March 2025 scripts, unchanged, for comparison |

### Daily rules

| Rule | Metrics | Why |
|---|---|---|
| Daily total | steps, distance, active and resting energy, exercise, stand minutes, flights, time in daylight | Additive; one device per metric-hour (watch, then phone, then other; newest device within a class) |
| Daily mean | heart rate, resting and walking HR, HRV, walking speed, step length, running metrics, physical effort | Readings and rates are never summed |
| Energy average | environmental and headphone audio (dBA) | Decibels are logarithmic: `10·log10(Σw·10^(L/10)/Σw)` |
| Last estimate | VO2 max, six-minute walk distance | Sparse estimates the device revises |
| Distinct hours | stand hours | Hours marked `Stood`, as the watch counts them |

Exercise, stand and flights are zero-filled on days the watch was worn, from the first day each type appears,
and left blank on other days. Every daily value is then checked against a plausible range in
[`catalog.py`](src/apple_health/catalog.py); values outside it are excluded and listed in
[`outputs/data_quality.json`](outputs/data_quality.json), never edited.

## What the rebuild found

* **All 24 cards on the original report reproduce** from its own tables once Power BI's filter propagation is
  followed. Four date relationships were inactive, so the Mobility cards showed all-time averages; the stand
  card labelled minutes as hours; headphone exposure kept each day's quietest reading.
* **Walking distance was counted about twice** in the original (0.84 miles per 1,000 steps against 0.42
  expected from step length); the rebuild records 0.44.
* **De-duplication removes about 27% of the raw step count.** Phone-only hours still count, so days without the
  watch are no longer blank.
* **More exercise went with a lower resting heart rate** across 72 months (r = −0.71); a correlation, not a cause.

The full list, with the method and caveat for each, is in `summary.json` under `findings`.

## Run it

```bash
cd projects/apple-health-analytics
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

python -m pytest                                        # 30 rule, reproduction and privacy tests
PYTHONPATH=src python -m apple_health build             # committed daily tables → outputs below
```

| Output | Purpose |
|---|---|
| `../../website/src/data/generated/apple-health/summary.json` | Cards, findings, comparisons, yearly and weekly patterns, records, workouts, quality |
| `../../website/src/data/generated/apple-health/daily.json` | Daily series behind the interactive report |
| `data/model/fact_daily_metric.csv`, `dim_metric.csv`, `dim_date.csv` | Power BI star schema |
| `outputs/data_quality.json` | Quality checks and every excluded daily value |

### With your own export (stays on your machine)

```bash
# Unzip the Health app export into data/raw/ (git-ignored)
PYTHONPATH=src python -m apple_health ingest-xml --xml data/raw/apple_health_export/export.xml
PYTHONPATH=src python -m apple_health build
```

`ingest-xml` writes only daily values, monthly workout totals and counts. Review `data/daily/` before you
commit anything: daily health values can identify a person.

## Power BI

See [`powerbi/README.md`](powerbi/README.md): the original report's structure, the M queries and DAX for the
rebuilt star schema, the theme and the values each measure should return. A rebuilt `.pbip` has not been
created yet because Power BI Desktop was not available where this rebuild ran.

## Limitations

* Personal tracking, not clinical measurement. Nothing here supports a medical conclusion.
* De-duplication works per metric-hour; Health's own merge works on finer intervals.
* Days use local wall-clock time from each record's start; the original report grouped by the date each record
  was written. The March 2025 and October 2026 exports also differ day by day for a few metrics.
* Before April 2018 only the phone counted steps, and only while it was carried.
* The values the original report displayed were transcribed from its screenshots.

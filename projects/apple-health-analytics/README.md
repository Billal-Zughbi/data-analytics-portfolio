# Apple Health Analytics

A Python pipeline that turns an Apple Health `export.xml` (often 1 GB+, hundreds of
thousands of records from several devices) into a small, **privacy-safe star schema**
for Power BI, plus a JSON summary the portfolio website renders.

```
export.xml ──► parse (streaming ElementTree) ──► normalize units ──► daily aggregates ──► CSVs + summary
   raw/            40 allowlisted metrics            km, kg, %, °C       date × metric        sanitized/
 (ignored)        identifying fields dropped                                                   sample/
```

## Privacy model

Apple Health exports contain personal health information. This project is built so
that **nothing identifiable leaves your machine**:

* Raw exports live in `data/raw/`, which is git-ignored (along with `export.xml`,
  `export_cda.xml`, `export.zip`, workout routes, ECG and clinical-record files anywhere
  in the repo).
* The parser reads only `type`, `startDate`, `value` and `unit`. Source names, device
  strings, app versions and metadata are never loaded.
* Only 40 allowlisted metrics are kept (cardiovascular, activity, mobility,
  environment, body). Reproductive, sexual-activity, medication and clinical data are
  dropped.
* Output is daily grain only: no timestamps, time zones or intra-day patterns.
* `assert_public_safe` fails the run if any output gains a column outside the allowlist,
  and the test suite checks that identifying strings from a synthetic export never
  appear in outputs.
* The published website currently uses **synthetic data** (`data/sample/`).

## Usage

```bash
cd projects/apple-health-analytics
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

# Run the tests
python -m pytest

# Synthetic demo: writes data/sample/ and refreshes website/src/data/apple-health-summary.json
PYTHONPATH=src python -m apple_health demo

# Your own export: unzip it into data/raw/ first (ignored by git)
PYTHONPATH=src python -m apple_health run --export data/raw/apple_health_export/export.xml
# Outputs land in data/sanitized/. Review them, then optionally publish the summary:
PYTHONPATH=src python -m apple_health run --export data/raw/apple_health_export/export.xml --publish-summary
```

## Outputs

| File | Description |
|---|---|
| `fact_daily_metric.csv` | date, metric, value, record_count |
| `dim_metric.csv` | metric catalog: label, category, unit, aggregation |
| `dim_date.csv` | calendar table for time intelligence |
| `portfolio_summary.json` | KPIs and monthly trends for the website |

## Power BI

See [`powerbi/`](powerbi/) for the model diagram, report page plan and DAX measures.

## Layout

```
src/apple_health/
  metrics.py     allowlisted metric catalog + unit normalization
  parse.py       streaming XML reader
  sanitize.py    aggregation, star-schema tables, public-safety guard
  synthetic.py   fake export generator for demos and tests
  cli.py         `run` and `demo` commands
tests/           pytest suite (synthetic data only)
powerbi/         DAX measures and model notes
data/            raw/ (ignored), sanitized/, sample/
```

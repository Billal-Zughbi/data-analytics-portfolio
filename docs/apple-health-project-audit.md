# Apple Health project audit

> **Update, October 2026.** This audit was written before the `.pbix` data model could be read. The model has
> since been read with `pbixray`, every card on the report has been reproduced, and the open questions below
> are settled: see [`projects/apple-health-analytics/powerbi/README.md`](../projects/apple-health-analytics/powerbi/README.md)
> for the confirmed findings. The project now publishes real daily values, with the owner's agreement, instead
> of synthetic data.

Audit of the original project supplied as a ZIP of the `Health-Report` repository (snapshot dated
9 March 2025), carried out before rebuilding it for the portfolio in October 2026. The ZIP was inspected
locally and kept outside this repository. No script from it was executed.

## 1. What the project contains

| Item | Size | Notes |
|---|---|---|
| `README.md` | 4 KB | Describes the Python extraction and the four report pages |
| `scripts/xmlExtraction.py` | 90 lines | Streams `export.xml` with `ElementTree.iterparse`, keeps 40 record types, writes one CSV per type |
| `scripts/xmlTypes.py` | 34 lines | Lists every distinct record type in an export |
| `AppleHealthReport.pbix` | 0.9 MB | Power BI report (Desktop release 2024.11) with an imported data model |
| `data/*.csv` | 8 files, 16.8 MB | Per-type extracts (stand hours, audio events, high-HR events, physical effort, resting HR, running speed, walking HR) |
| `images/*.png` | 4 files | Screenshots of the four report pages |
| `LICENSE` | | MIT, © 2025 Billal Zughbi |

Only 8 of the 40 extracted types are present as CSVs in the ZIP; the other tables in the model were
loaded from files that are not included.

## 2. Technology and workflow

```
export.xml ─► xmlExtraction.py (ElementTree, pandas) ─► one CSV per record type ─► Power BI (import) ─► 4-page report
```

* **Python:** standard-library `xml.etree.ElementTree` with `iterparse` and `elem.clear()`, then pandas to
  write CSVs. Columns kept: `sourceName`, `creationDate`, `startDate`, `endDate`, `value`, `unit`.
* **Power BI:** 29 tables, one per record type, with the same six columns. Report pages: Energy and Activity,
  Cardiovascular, Mobility and Movement, Physical and Environmental. Each page has a page navigator, KPI cards,
  a date slicer and trend charts. Visuals use implicit aggregations (`Sum`, `Average`, `Min`, `Max`) chosen
  per visual rather than explicit DAX measures.
* **SQL:** none. The rebuild does not add SQL for its own sake.

## 3. What works (verified)

* The extraction script is memory-conscious (streaming parse, clearing elements) and correct in structure.
* The report layout definition parses cleanly; its pages, visuals, fields and aggregation functions are
  listed in [`projects/apple-health-analytics/powerbi/README.md`](../projects/apple-health-analytics/powerbi/README.md).
* The README accurately describes the workflow.

Not verifiable here: the report's data model is stored with XPress9 compression and needs Power BI
Desktop (Windows). Its Power Query steps and any measures inside it were not inspected.

## 4. Problems and gaps

| # | Finding | Evidence | Impact |
|---|---|---|---|
| 1 | Rate metrics plotted with `Sum` | Layout: heart rate, resting HR, VO2 max, HRV, step length, headphone audio and physical effort charts aggregate `Sum` of `value` on a date axis | Days with more than one reading show their sum (unless Power Query grouped by day first; unconfirmed) |
| 2 | "Average daily active kcal" averages readings | Layout: card uses `Average` over the record-level column | Mean of hourly-ish readings, not of daily totals |
| 3 | Dates from `creationDate` | Layout: every date axis and slicer uses `creation date` | Records synced later land on the wrong day; CSVs include records created months after they started |
| 4 | No device de-duplication | Several source devices appear in the same tables (four for stand hours, two for resting and walking HR); nothing in the extraction or the visuals resolves overlapping records between devices | Additive metrics can be double counted where devices overlap |
| 5 | Decibels averaged arithmetically | Layout: audio cards use `Average` | Understates exposure when levels vary |
| 6 | Broad `except Exception` | `xmlExtraction.py` | Failures print one line and produce partial output silently |
| 7 | No tests, no data-quality checks | Repository | No evidence that numbers are right |
| 8 | Hard-coded `export.xml` path, output to CWD | Scripts | Not reproducible from another folder |
| 9 | README says "over 40 health metrics" and promises insights from the data | README | The extraction list has exactly 40 types and the model 29 tables; the wording oversells a descriptive personal dashboard |

## 5. Privacy review

| Content | Sensitivity | Decision |
|---|---|---|
| `data/*.csv` | **High.** Record-level health data with timestamps to the second, over several years | Never published. Ignored by `.gitignore` (`HK*.csv`) and blocked by the pre-push scanner |
| `sourceName` column | **High.** Device names typically include a person's first name | Dropped in the rebuild; replaced by `watch` / `phone` / `other` |
| `AppleHealthReport.pbix` | **High.** Embeds the imported records | Never published (`*.pbix` ignored and blocked) |
| `images/*.png` | **Medium-high.** Show real heart rate, VO2 max and HRV values with dates | Not published. The website recreates the report with synthetic data |
| Static report images (watch logo, icons) | Third-party marks | Not published |
| Python scripts | None (code only) | Preserved in `legacy/` under the original MIT license |

**Important for the existing public `Health-Report` repository on GitHub:** the ZIP is a snapshot of it. On
11 October 2026 the public repository still served `data/HKQuantityTypeIdentifierRestingHeartRate.csv`,
`AppleHealthReport.pbix` and the report screenshots (HTTP 200 on raw.githubusercontent.com; contents not
downloaded). That repository is outside this portfolio and was not changed. Recommendation: remove the data files, `.pbix` and screenshots from
it (and from its history, or make it private), and link the portfolio's rebuilt project instead.

## 6. Strongest genuine aspects

* A real end-to-end build: raw XML → Python → model → multi-page report, done independently.
* Sensible extraction design for a large file (streaming, memory clearing).
* A coherent report structure across four health domains with consistent navigation.

## 7. What the rebuild changes

* Explicit metric registry with one daily aggregation rule per metric (sum, mean, energy mean, last, stood hours).
* Local-day assignment from `startDate`, unit normalization, duplicate removal, range flags and watch-over-phone
  de-duplication, each counted in a quality report.
* 21 pytest tests on a hand-written fixture and on synthetic runs, including privacy contracts.
* A small star schema with DAX measures that never sum a rate, plus expected values for verification.
* A synthetic export generator so the whole pipeline runs publicly without personal data.

## 8. Still open

* Open the original `.pbix` in Power BI Desktop to confirm whether findings 1 and 2 affect the real numbers.
* Build the rebuilt report as a `.pbip` from `powerbi/` and check it against the expected values.
* Decide what to do with the public `Health-Report` repository (section 5).

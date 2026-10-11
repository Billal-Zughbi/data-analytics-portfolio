# Billal Zughbi · Data Analytics Portfolio

Business Intelligence & Analytics Engineer (Baltimore, MD): Power BI, SQL, Snowflake, Microsoft Fabric and
Python. This repository holds my portfolio website and the analytical projects it showcases. Every project
can be rerun from this repository, and every number on the site comes from a file a pipeline generated.

## Projects

| Project | Question | Stack | Data |
|---|---|---|---|
| [Apple Health Analytics](projects/apple-health-analytics/) | How do you turn a large, multi-device XML export into daily numbers you can trust in a dashboard? | Python, pandas, pytest, Power BI (star schema, DAX) | Synthetic export (the real one stays private) |
| [Late Deliveries and Customer Reviews](projects/olist-delivery-experience/) | How much does late delivery cost in review scores, and which routes, months and categories produce the late orders? | SQL (DuckDB), Python, pandas, pytest, Power BI model kit (DAX, M) | Olist Brazilian e-commerce orders, CC BY-NC-SA 4.0 (download separately; only aggregates committed) |
| [How Fast Vulnerabilities Get Exploited](projects/known-exploited-vulnerabilities/) | Once a vulnerability is made public, how quickly is it confirmed as exploited, how has that changed, and does a severity score alone point patching at the right things? | SQL (DuckDB), Python, pandas, pytest, Power BI model kit (DAX, M) | CISA Known Exploited Vulnerabilities catalog (CC0) and CVE records (CVE Program Terms of Use), snapshot committed |

Each project has a case-study page on the site, a README, SQL and Python, an executed notebook, tests, a
methodology and data-quality write-up, and a Power BI folder. The two newer projects have a Power BI model kit
(star-schema CSVs, Power Query M, DAX measures, theme and expected values) but **no `.pbix` or `.pbip` file**:
Power BI Desktop was not available where they were built, so the M and DAX have not been run in Power BI yet.
How the datasets were chosen is in [`docs/second-wave-dataset-selection.md`](docs/second-wave-dataset-selection.md).

## Repository layout

| Path | What it is |
|---|---|
| [`website/`](website/) | Portfolio site: Next.js (App Router, TypeScript, Tailwind 4), static export, React Three Fiber hero, Recharts |
| [`projects/<slug>/`](projects/) | One reproducible analysis per folder: `src/`, `tests/`, `powerbi/`, `data/sample/`, `outputs/` |
| [`docs/`](docs/) | Master brief, build checklist, design research, project audits |
| [`scripts/check_sensitive_files.py`](scripts/check_sensitive_files.py) | Pre-push scan for health exports, device names, secrets and large files |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | CI: sensitive-file scan, each project's tests (with output drift checks where the data is committed), site lint, build, typecheck and tests |
| [`CLAUDE.md`](CLAUDE.md) | Working rules for AI-assisted sessions in this repository |

## Run the website

Requires Node.js 22 or later.

```bash
cd website
npm ci
npm run dev                      # http://localhost:3000
npm run lint && npm run typecheck
npm run build                    # static site in website/out/
npm test                         # content, privacy and link checks against the build
npm start                        # serve website/out/ locally
```

Optional settings live in [`website/.env.example`](website/.env.example): `NEXT_PUBLIC_SITE_URL` (enables
canonical URLs, sitemap and robots) and `NEXT_PUBLIC_BASE_PATH` (for hosting under a sub-path).

## Reproduce the Apple Health project

Requires Python 3.10 or later.

```bash
cd projects/apple-health-analytics
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
python -m pytest
PYTHONPATH=src python -m apple_health demo             # regenerates sample tables, quality report and site JSON
```

The demo builds a synthetic export, runs the full pipeline and rewrites the files the website reads. CI reruns
it and fails if any committed output changes. Power BI material (M queries, DAX, theme and the values each
measure should return) is in [`projects/apple-health-analytics/powerbi/`](projects/apple-health-analytics/powerbi/).

## Reproduce the delivery and reviews project

```bash
cd projects/olist-delivery-experience
pip install -r requirements-dev.txt
python -m pytest                                        # rule tests on a fixture; full-data tests skip without the data
# Download the Olist dataset from Kaggle (olistbr/brazilian-ecommerce) into data/raw/; see data/README.md
PYTHONPATH=src python -m olist_delivery all             # check, build, validate, reconcile SQL vs pandas, export
```

The raw CSVs are not committed (licence and size). `all` rewrites the analysis CSVs, figures, Power BI tables
and the website JSON.

## Reproduce the exploited-vulnerabilities project

```bash
cd projects/known-exploited-vulnerabilities
pip install -r requirements-dev.txt
python -m pytest
PYTHONPATH=src python -m kev_analytics all              # runs offline from the committed snapshot in data/sample/
PYTHONPATH=src python -m kev_analytics refresh          # optional: download a newer KEV catalog and CVE records
```

CI reruns `all` and fails if any committed output changes.

## Data and privacy rules

* Raw Apple Health exports (`export.zip`, `export.xml`, `export_cda.xml`, workout routes, ECGs, clinical
  records), per-type `HK*.csv` extracts, report screenshots with real values and device names are **never
  committed**. Real daily aggregates are not published either: public health figures are synthetic and
  labelled as such.
* `data/raw/` and `private-inputs/` folders stay local and are ignored by git.
* Power BI work is versioned as `.pbip` projects; `.pbix`/`.pbit` files embed data and are ignored.
* No credentials or `.env` files are committed. `.env.example` files hold placeholders only.
* Third-party datasets are committed only when their licence allows redistribution and the files are small;
  otherwise the project documents how to download them. The Olist CSVs are never committed (the scan blocks
  them); the KEV snapshot (CC0) and the extracted CVE fields are, with their licence texts.
* Before every push:

  ```bash
  git add -A && git status
  python3 scripts/check_sensitive_files.py   # scans staged files; add --all to scan everything tracked
  ```

## Deploy

The site is a static export, so any static host works.

* **Vercel (in use):** import the repository and set the project's root directory to `website`. Set
  `NEXT_PUBLIC_SITE_URL` to the production URL.
* **GitHub Pages:** build with `NEXT_PUBLIC_BASE_PATH=/data-analytics-portfolio` and
  `NEXT_PUBLIC_SITE_URL=https://billal-zughbi.github.io/data-analytics-portfolio`, then publish
  `website/out/` (for example with the `actions/deploy-pages` workflow).

Live at https://data-analytics-portfolio-six.vercel.app, deployed by Vercel from `main` (root directory `website`). Every push to `main` redeploys it.

## Attribution

* The original Apple Health scripts in [`projects/apple-health-analytics/legacy/`](projects/apple-health-analytics/legacy/)
  are © 2025 Billal Zughbi under the MIT licence.
* Olist data: "Brazilian E-Commerce Public Dataset by Olist", CC BY-NC-SA 4.0. Published aggregates derived
  from it are shared under the same licence.
* KEV data: CISA Known Exploited Vulnerabilities catalog, CC0 1.0. Use of the data does not imply endorsement
  by CISA or DHS.
* CVE records: © The MITRE Corporation, used under the CVE Program Terms of Use.
* Fonts: Geist and Geist Mono by Vercel (SIL Open Font License).
* Built with Next.js, React Three Fiber, three.js, Recharts, DuckDB, pandas and NumPy.

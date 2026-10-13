# Billal Zughbi · Data Analytics Portfolio

Business Intelligence & Analytics Engineer (Baltimore, MD): Power BI, SQL, Snowflake, Microsoft Fabric and
Python. This repository holds my portfolio website and the analytical projects it showcases. Every project
can be rerun from this repository, and every number on the site comes from a file a pipeline generated.

## Project

| Project | Question | Stack | Data |
|---|---|---|---|
| [Apple Health Analytics](projects/apple-health-analytics/) | Were the numbers in my first Power BI report right, and what do 4.4 million health records say once each one is counted properly? | Python, pandas, pytest, Power BI (Power Query, DAX, star schema), Recharts | My own Apple Health export, September 2014 to October 2026, published as daily values |

The case study rebuilds the original four-page Power BI report for the web, reproduces and audits every card
on it, and adds yearly, weekly, workout and heart-rate analysis. The Power BI folder has a model kit (star-schema
CSVs, Power Query M, DAX measures, theme and expected values) but **no `.pbix` or `.pbip` file**: Power BI
Desktop was not available where it was rebuilt, so the M and DAX have not been run in Power BI yet.

## Repository layout

| Path | What it is |
|---|---|
| [`website/`](website/) | Portfolio site: Next.js (App Router, TypeScript, Tailwind 4), static export, React Three Fiber hero, Recharts |
| [`projects/<slug>/`](projects/) | One reproducible analysis per folder: `src/`, `tests/`, `powerbi/`, `data/`, `outputs/` |
| [`docs/`](docs/) | Master brief, build checklist, design research, project audits |
| [`scripts/check_sensitive_files.py`](scripts/check_sensitive_files.py) | Pre-push scan for health exports, device names, secrets and large files |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | CI: sensitive-file scan, project tests with an output drift check, site lint, build, typecheck and tests |
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
PYTHONPATH=src python -m apple_health build            # daily tables → star schema, quality report and site JSON
```

`build` runs from the committed daily tables and rewrites the files the website reads. CI reruns it and fails if
any committed output changes. Reading a fresh `export.xml` (`ingest-xml`) or the original `.pbix`
(`ingest-pbix`) happens only on a machine that has those private files. Power BI material (M queries, DAX,
theme and the values each measure should return) is in
[`projects/apple-health-analytics/powerbi/`](projects/apple-health-analytics/powerbi/).

## Data and privacy rules

* Raw Apple Health exports (`export.zip`, `export.xml`, `export_cda.xml`, workout routes, ECGs, clinical
  records), per-type `HK*.csv` extracts, report screenshots, device names and times of day are **never
  committed**. The owner agreed to publish the health data as one value per day; that is the only form it
  takes in this repository.
* `data/raw/` and `private-inputs/` folders stay local and are ignored by git.
* Power BI work is versioned as `.pbip` projects; `.pbix`/`.pbit` files embed data and are ignored.
* No credentials or `.env` files are committed. `.env.example` files hold placeholders only.
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
* Fonts: Geist and Geist Mono by Vercel (SIL Open Font License).
* Built with Next.js, React Three Fiber, three.js, Recharts, pandas, NumPy and pbixray.

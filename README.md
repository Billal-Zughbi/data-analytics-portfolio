# Billal Zughbi · Data Analytics Portfolio

Business Intelligence & Analytics Engineer (Baltimore, MD): Power BI, SQL, Snowflake, Microsoft Fabric and
Python. This repository holds my portfolio website and the analytical projects it showcases. Every project
can be rerun from this repository, and every number on the site comes from a file a pipeline generated.

## Projects

| Project | Question | Stack | Data |
|---|---|---|---|
| [Apple Health Analytics](projects/apple-health-analytics/) | How do you turn a large, multi-device XML export into daily numbers you can trust in a dashboard? | Python, pandas, pytest, Power BI (star schema, DAX) | Synthetic export (the real one stays private) |

More projects are planned; see [`docs/PORTFOLIO_MASTER_BRIEF.md`](docs/PORTFOLIO_MASTER_BRIEF.md).

## Repository layout

| Path | What it is |
|---|---|
| [`website/`](website/) | Portfolio site: Next.js (App Router, TypeScript, Tailwind 4), static export, React Three Fiber hero, Recharts |
| [`projects/<slug>/`](projects/) | One reproducible analysis per folder: `src/`, `tests/`, `powerbi/`, `data/sample/`, `outputs/` |
| [`docs/`](docs/) | Master brief, build checklist, design research, project audits |
| [`scripts/check_sensitive_files.py`](scripts/check_sensitive_files.py) | Pre-push scan for health exports, device names, secrets and large files |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | CI: sensitive-file scan, Python tests with an output drift check, site lint, build, typecheck and tests |
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

## Data and privacy rules

* Raw Apple Health exports (`export.zip`, `export.xml`, `export_cda.xml`, workout routes, ECGs, clinical
  records), per-type `HK*.csv` extracts, report screenshots with real values and device names are **never
  committed**. Real daily aggregates are not published either: public health figures are synthetic and
  labelled as such.
* `data/raw/` and `private-inputs/` folders stay local and are ignored by git.
* Power BI work is versioned as `.pbip` projects; `.pbix`/`.pbit` files embed data and are ignored.
* No credentials or `.env` files are committed. `.env.example` files hold placeholders only.
* Third-party datasets are committed only when their licence allows redistribution; otherwise the project
  documents how to download them.
* Before every push:

  ```bash
  git add -A && git status
  python3 scripts/check_sensitive_files.py   # scans staged files; add --all to scan everything tracked
  ```

## Deploy

The site is a static export, so any static host works.

* **Vercel:** import the repository and set the project's root directory to `website`. Set
  `NEXT_PUBLIC_SITE_URL` to the production URL.
* **GitHub Pages:** build with `NEXT_PUBLIC_BASE_PATH=/data-analytics-portfolio` and
  `NEXT_PUBLIC_SITE_URL=https://billal-zughbi.github.io/data-analytics-portfolio`, then publish
  `website/out/` (for example with the `actions/deploy-pages` workflow).

The site is not deployed yet.

## Attribution

* The original Apple Health scripts in [`projects/apple-health-analytics/legacy/`](projects/apple-health-analytics/legacy/)
  are © 2025 Billal Zughbi under the MIT licence.
* Fonts: Geist and Geist Mono by Vercel (SIL Open Font License).
* Built with Next.js, React Three Fiber, three.js, Recharts, pandas and NumPy.

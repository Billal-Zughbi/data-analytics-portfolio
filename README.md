# Billal Zughbi · Data Analytics Portfolio

Business Intelligence & Analytics Engineer: Power BI, SQL, Snowflake, Microsoft Fabric and Python.
This repository holds my portfolio website and the analytical projects it showcases.

## Contents

| Path | What it is |
|---|---|
| [`website/`](website/) | Portfolio site (Next.js, static export) |
| [`projects/apple-health-analytics/`](projects/apple-health-analytics/) | Python pipeline + Power BI model for privacy-safe Apple Health analytics |
| [`scripts/check_sensitive_files.py`](scripts/check_sensitive_files.py) | Pre-push scan for health exports, secrets and large files |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | CI: sensitive-file scan, Python tests, site tests and build |

## Quick start

```bash
# Website
cd website && npm install && npm run dev        # http://localhost:3000
npm test && npm run typecheck && npm run build  # static site in website/out/

# Apple Health project
cd projects/apple-health-analytics
pip install -r requirements-dev.txt && python -m pytest
PYTHONPATH=src python -m apple_health demo      # synthetic data -> data/sample + website summary
```

## Data and privacy rules

* Raw Apple Health exports (`export.zip`, `export.xml`, `export_cda.xml`, workout routes, ECGs,
  clinical records) and any row-level personal data are **never committed**. The `.gitignore`
  blocks them and `data/raw/` folders stay local.
* Only sanitized daily aggregates (`data/sanitized/`) and synthetic samples (`data/sample/`) are tracked.
* Power BI work is versioned as `.pbip` projects; `.pbix`/`.pbit` files embed data and are ignored.
* No credentials or `.env` files are committed; copy `website/.env.example` to `.env.local` if needed.
* Before every push:

  ```bash
  git add -A && git status
  python3 scripts/check_sensitive_files.py   # scans staged files; use --all for everything tracked
  ```

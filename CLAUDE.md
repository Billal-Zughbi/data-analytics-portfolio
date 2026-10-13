# CLAUDE.md

Persistent instructions for Claude Code sessions in this repository.

Read first: `docs/PORTFOLIO_MASTER_BRIEF.md` (vision, architecture, rules), then `docs/build-checklist.md`
(what is done). For Apple Health work also read `docs/apple-health-project-audit.md`.

## Repository

* Remote: `https://github.com/Billal-Zughbi/data-analytics-portfolio`, default branch `main`. Verify the
  remote, branch and `git status` before modifying anything. Never force-push or rewrite pushed history.
* `website/` is the Next.js site (static export). `website/AGENTS.md` notes that this Next.js version has
  breaking changes: read `website/node_modules/next/dist/docs/` before using an unfamiliar API.
* `projects/<slug>/` holds each reproducible analysis.

## Commands

```bash
# Website
cd website && npm ci
npm run dev          # http://localhost:3000
npm run lint && npm run build && npm run typecheck && npm test

# Apple Health project (real data, published as daily values only)
cd projects/apple-health-analytics
pip install -r requirements-dev.txt
python -m pytest
PYTHONPATH=src python -m apple_health build    # committed daily tables → website JSON, star schema, quality report
# Private, only where the files exist (never commit them):
PYTHONPATH=src python -m apple_health ingest-xml --xml path/to/export.xml   # → data/daily/
PYTHONPATH=src python -m apple_health ingest-pbix --pbix path/to/report.pbix  # needs requirements-pbix.txt

# Before every push (from the repo root)
git status && python3 scripts/check_sensitive_files.py
```

## Rules

* **Privacy:** never commit or publish raw Apple Health exports, workout routes, `HK*.csv` extracts, `.pbix`
  files, original report screenshots, device names, times of day or record-level rows. Billal agreed (October
  2026) to publish the health data as daily values; that is the only form allowed.
* **Honesty:** never type metric values into components; read generated outputs. Never claim a Power BI file,
  test, build or deployment exists or passed unless it was produced or run.
* **Personal content:** only from the résumé; no phone number on the site or in the published résumé PDF.
* **Voice:** plain first-person sentences. No slogans, aphorisms or buzzwords; Billal does not want copy that
  sounds machine-written.
* **Design:** use the tokens in `website/src/app/globals.css` and the existing components; keep the validated
  chart palette (`--series-1..3`); content must never depend on animation or hover.
* After each milestone run the relevant tests and `git status`; review staged files before pushing.

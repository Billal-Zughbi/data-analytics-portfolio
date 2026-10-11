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

# Apple Health project
cd projects/apple-health-analytics
pip install -r requirements-dev.txt
python -m pytest
PYTHONPATH=src python -m apple_health demo     # regenerates synthetic outputs + website JSON

# Olist delivery and reviews (raw CSVs downloaded into data/raw/, never committed)
cd projects/olist-delivery-experience
pip install -r requirements-dev.txt && python -m pytest
PYTHONPATH=src python -m olist_delivery all     # rewrites outputs, Power BI tables and website JSON

# Known exploited vulnerabilities (snapshot committed in data/sample/, runs offline)
cd projects/known-exploited-vulnerabilities
pip install -r requirements-dev.txt && python -m pytest
PYTHONPATH=src python -m kev_analytics all      # CI fails if this changes a committed output

# Before every push (from the repo root)
git status && python3 scripts/check_sensitive_files.py
```

## Rules

* **Privacy:** never commit or publish raw Apple Health exports, `HK*.csv` extracts, `.pbix` files with personal
  data, original report screenshots, device names or real daily aggregates. Public health figures are synthetic
  and labelled as such.
* **Honesty:** never type metric values into components; read generated outputs. Never claim a Power BI file,
  test, build or deployment exists or passed unless it was produced or run. Mark synthetic data as synthetic.
* **Third-party data:** never commit the Olist CSVs or review text (CC BY-NC-SA 4.0; publish aggregates
  only, with attribution). The KEV snapshot is CC0 and committed; keep its licence files with it.
* **Personal content:** only from the résumé; no phone number on the site or in the published résumé PDF.
* **Voice:** plain first-person sentences. No slogans, aphorisms or buzzwords; Billal does not want copy that
  sounds machine-written.
* **Design:** use the tokens in `website/src/app/globals.css` and the existing components; keep the validated
  chart palette (`--series-1..3`); content must never depend on animation or hover.
* After each milestone run the relevant tests and `git status`; review staged files before pushing.

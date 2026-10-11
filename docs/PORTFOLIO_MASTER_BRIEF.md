# Portfolio master brief

The standing brief for every future session working in this repository. Read it with `CLAUDE.md`.

## Purpose and audience

A public portfolio for **Billal Zughbi**, Business Intelligence & Analytics Engineer (Baltimore, MD), aimed at
hiring managers and technical interviewers for Data Analyst, BI Analyst, Power BI / BI Developer and Analytics
Engineer roles across industries.

* A recruiter should get the point of each project **within a minute**.
* A technical interviewer should be able to inspect the **code, model, checks and limitations** behind every
  number.

## Source of truth for personal content

The résumé `Billal_Zughbi_Resume_BI_Analytics.pdf` (project files, not committed). Content lives in
`website/src/content/profile.ts`. Do not invent details, titles, dates, credentials or outcomes. Never publish
the phone number. Professional results (Arconic) are kept separate from independent projects.

## Site architecture

```
website/                       Next.js (App Router, TypeScript, Tailwind 4), static export
  src/app/page.tsx             Home: hero, projects, workflow, experience, skills, about, contact
  src/app/projects/<slug>/     One static route per case study
  src/content/profile.ts       Editable profile, experience, skills, navigation
  src/content/projects.ts      Typed project registry (drives gallery, footer, sitemap)
  src/data/generated/<slug>/   Small JSON written by each project's pipeline (never hand-edited)
  src/components/              Shared UI; hero/ (3D scene + fallback); case-study/ (charts)
projects/<slug>/               Reproducible analysis: src/, tests/, sql/ (if used), powerbi/, data/, outputs/
scripts/check_sensitive_files.py   Pre-push privacy and secrets scan
docs/                          Brief, design research, audits, checklist
```

**Adding a project:** add an entry to `projects.ts`; create `src/app/projects/<slug>/page.tsx` using the
case-study components (`CaseStudyShell.tsx`, `ChartFrame.tsx`, and a `summary.json` following
`src/data/case-study.ts`); add a card preview in `components/home/previews.tsx`; have the project's pipeline write JSON to `src/data/generated/<slug>/`; update the
root README and this brief.

## Design principles

See `docs/design-research.md`. In short: dark "analytics laboratory" identity, tokens in
`website/src/app/globals.css`, one motif (nodes and edges), restrained motion that is never required to read
content, validated chart palette, ink tokens for all chart text, a table view for every chart.

## Privacy and data rules (non-negotiable)

1. Raw Apple Health exports, extracted per-type CSVs, `.pbix` files with personal data, and report screenshots
   with real values are **never committed or published**.
2. Public Apple Health figures come only from the synthetic generator and are labelled synthetic wherever they
   appear.
3. No device names, record-level timestamps or real daily aggregates in public outputs.
4. No secrets or `.env` files. `.env.example` holds placeholders only.
5. Third-party datasets: check licence and redistribution terms before committing any file.
6. Before every push: `git status`, review the staged file list, run
   `python3 scripts/check_sensitive_files.py`.

## Analytical standards

* State the grain of every table. Define every measure. Reconcile totals across layers.
* Never type a metric into a component; read it from generated output.
* Tests check rules and data contracts, not desired conclusions.
* Describe correlation as correlation. No fabricated savings, outcomes or clinical claims.
* Never claim a Power BI file, test, build or deployment exists or passed unless it was actually produced or run.

## Acceptance criteria for any change

* `npm run lint`, `npm run build`, `npm run typecheck`, `npm test` pass in `website/`.
* Each project's tests pass and its published outputs regenerate without drift.
* Pages work at 390px, 768px and 1440px with no horizontal overflow; keyboard focus is visible; reduced
  motion and no-WebGL paths render complete content.
* The sensitive-file scan passes on the staged files.
* `docs/build-checklist.md` reflects what is actually done.

## Current state (October 2026)

* Stage 1 (site, hero, Apple Health case study, pipeline, docs) is published on `main`.
* Stage 2 added two projects on real public data, each with SQL (DuckDB), Python, an executed notebook,
  pytest, SQL vs pandas reconciliation, docs, a Power BI model kit and a case-study page:
  * `projects/olist-delivery-experience`: late deliveries and review scores (Olist, CC BY-NC-SA 4.0; raw
    files are downloaded, never committed).
  * `projects/known-exploited-vulnerabilities`: time from CVE publication to CISA KEV listing, and KEV
    against CVSS severity (KEV CC0, CVE Terms of Use; the snapshot is committed).
* The planned housing-affordability project was replaced because census and BLS hosts were unreachable from
  the build environment; the owner chose the change of topic. See `docs/second-wave-dataset-selection.md`.
* No `.pbix`/`.pbip` exists for either new project. Building them needs Power BI Desktop on Windows.
* The site is not deployed yet.

# Build checklist

Status as of 12 October 2026. ✓ done and verified · ◐ partly done · ○ not started.

## Stage 1: site and Apple Health case study

| Item | Status | Evidence / notes |
|---|---|---|
| Inspect workspace, repo remote, branch, status | ✓ | `origin` = Billal-Zughbi/data-analytics-portfolio, branch `main`; built on top of starter commit `0eec5bf` |
| Inspect the supplied ZIP without executing it | ✓ | `docs/apple-health-project-audit.md` |
| Privacy review and exclusions | ✓ | `.gitignore`, `scripts/check_sensitive_files.py`, audit section 5 |
| Reference research | ◐ | `docs/design-research.md`; Noah's source read in full; live sites could not be opened in a browser from the build environment |
| Design system and tokens | ✓ | `website/src/app/globals.css`; chart palette validated |
| Pipeline rebuild with tests | ✓ | `projects/apple-health-analytics`, 21 pytest tests passing |
| Synthetic public dataset | – | Replaced by real daily data in stage 3 |
| Homepage (hero, projects, workflow, experience, skills, about, contact) | ✓ | `website/src/app/page.tsx` |
| 3D hero with reduced-motion and no-WebGL fallbacks | ✓ | `website/src/components/hero/` |
| Case study route works when loaded directly | ✓ | `/projects/apple-health-analytics/` in the static export |
| Power BI rebuild kit (M, DAX, theme, spec, expected values) | ✓ | `projects/apple-health-analytics/powerbi/` |
| Native rebuilt `.pbip` | ○ | Needs Power BI Desktop (Windows) |
| Confirm original report findings in Power BI Desktop | ○ | Needs the original `.pbix` opened locally |
| Lint, typecheck, build, site tests | ✓ | All pass locally; CI workflow runs the same |
| Responsive checks (390 / 768 / 1440 px) | ✓ | No horizontal overflow; screenshots reviewed |
| Deployment | ✓ | Vercel, root directory `website`: https://data-analytics-portfolio-six.vercel.app (checked 11 October 2026) |
| Résumé download | ✓ | Copy without a phone number at `website/public/Billal-Zughbi-Resume.pdf` |

## Stage 2: two new analytics projects (removed in stage 3)

| Item | Status | Evidence / notes |
|---|---|---|
| Dataset search, access and licence checks | ✓ | `docs/second-wave-dataset-selection.md` |
| Project A: Olist delivery and reviews pipeline (SQL + Python) | ✓ | `projects/olist-delivery-experience`; 60 tests with data, 53 pass and 7 skip without it |
| Project A: SQL vs pandas reconciliation | ✓ | 52 of 52 match (`outputs/reconciliation.csv`) |
| Project A: notebook, methodology, data dictionary, findings, data-quality report | ✓ | `notebooks/`, `docs/` |
| Project B: topic change from housing to exploited vulnerabilities | ✓ | Census and BLS blocked; the owner chose the change |
| Project B: KEV + CVE pipeline (SQL + Python) | ✓ | `projects/known-exploited-vulnerabilities`; 79 tests; 49 of 50 SQL checks pass, 1 warning |
| Project B: SQL vs pandas reconciliation | ✓ | 62 of 62 match |
| Project B: output drift check in CI | ✓ | `known-exploited-vulnerabilities` job reruns `all` from the committed snapshot |
| Power BI model kits (CSVs, M, DAX, theme, expected values) | ✓ | Each project's `powerbi/` |
| Native `.pbix` / `.pbip` for either project | ○ | Needs Power BI Desktop (Windows) |
| Case-study pages and home cards | ✓ | `/projects/olist-delivery-experience/`, `/projects/known-exploited-vulnerabilities/` |
| Responsive checks (390 / 768 / 1440 px), no console errors | ✓ | Checked with Playwright before the push |
| README, brief, CLAUDE.md updated | ✓ | |

## Stage 3: one project on real data

| Item | Status | Evidence / notes |
|---|---|---|
| Remove the Olist and KEV projects | ✓ | Owner's request; folders, pages, data and CI jobs removed |
| Read the original `.pbix` model (Power Query, relationships, layout) | ✓ | `pbix_source.py`; `data/original/report_model.json` |
| Reproduce every original card | ✓ | 24 of 24 match (`report_sim.py`, `tests/test_report.py`) |
| Ingest a fresh export (Sep 2014 to Oct 2026) | ✓ | `xml_source.py`; 4,387,607 records, 1,342 workouts; daily values only in `data/daily/` |
| Rebuilt four-page report on the site | ✓ | `HealthReport.tsx`, with original dates, year presets and custom ranges |
| New analysis: yearly, weekly, workouts, fitness, records, activity rings | ✓ | `HealthCharts.tsx`, `DayExplorer.tsx` |
| Python tests | ✓ | 30 passing |
| Lint, typecheck, build, site tests | ✓ | Run before the push |
| Responsive checks (390 / 768 / 1440 px), no console errors | ✓ | Playwright |
| Native rebuilt `.pbip` | ○ | Needs Power BI Desktop (Windows) |

## Stage 4: personal and interactive touches (13 October 2026)

| Item | Status | Evidence / notes |
|---|---|---|
| Official tool logos, unedited | ✓ | `website/public/logos/`, sources and hashes in `docs/logo-sources.md` |
| Page filter: click one or more tools to light up every place they appear | ✓ | `website/src/content/tools.ts`, `components/tools/` |
| Reading rings that fill as the page is read | ✓ | `components/home/ReadingRings.tsx` |
| Double-counting puzzle (step 3 of How I work) | ✓ | `components/home/JoinPuzzle.tsx` |
| Life timeline on the monthly step chart | ✓ | `content/timeline.ts`, `components/home/LifeTimeline.tsx` |
| Mount Rainier contour lines (USGS elevation) | ✓ | `scripts/rainier_contours.py`, `public/images/rainier-contours.svg` |
| Hero made of real days, with year labels and date tooltip | ✓ | `components/hero/` |
| On-this-day line, SQL 404 page, console hello | ✓ | `components/hero/OnThisDay.tsx`, `components/surprises/` |
| Map-style caption naming the Mount Rainier contour lines, with a 1 km scale bar; the lines stay still (no pointer glow) | ✓ | `components/Topo.tsx` |
| Lint, typecheck, build, site tests, Python tests | ✓ | Run before the push |
| Responsive checks (390 / 768 / 1440 px), reduced motion, no console errors | ✓ | Playwright |

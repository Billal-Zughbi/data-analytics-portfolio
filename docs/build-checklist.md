# Build checklist

Status as of 11 October 2026. ✓ done and verified · ◐ partly done · ○ not started.

## Stage 1: site and Apple Health case study

| Item | Status | Evidence / notes |
|---|---|---|
| Inspect workspace, repo remote, branch, status | ✓ | `origin` = Billal-Zughbi/data-analytics-portfolio, branch `main`; built on top of starter commit `0eec5bf` |
| Inspect the supplied ZIP without executing it | ✓ | `docs/apple-health-project-audit.md` |
| Privacy review and exclusions | ✓ | `.gitignore`, `scripts/check_sensitive_files.py`, audit section 5 |
| Reference research | ◐ | `docs/design-research.md`; Noah's source read in full; live sites could not be opened in a browser from the build environment |
| Design system and tokens | ✓ | `website/src/app/globals.css`; chart palette validated |
| Pipeline rebuild with tests | ✓ | `projects/apple-health-analytics`, 21 pytest tests passing |
| Synthetic public dataset | ✓ | `synthetic.py`, labelled everywhere it is shown |
| Homepage (hero, projects, workflow, experience, skills, about, contact) | ✓ | `website/src/app/page.tsx` |
| 3D hero with reduced-motion and no-WebGL fallbacks | ✓ | `website/src/components/hero/` |
| Case study route works when loaded directly | ✓ | `/projects/apple-health-analytics/` in the static export |
| Power BI rebuild kit (M, DAX, theme, spec, expected values) | ✓ | `projects/apple-health-analytics/powerbi/` |
| Native rebuilt `.pbip` | ○ | Needs Power BI Desktop (Windows) |
| Confirm original report findings in Power BI Desktop | ○ | Needs the original `.pbix` opened locally |
| Lint, typecheck, build, site tests | ✓ | All pass locally; CI workflow runs the same |
| Responsive checks (390 / 768 / 1440 px) | ✓ | No horizontal overflow; screenshots reviewed |
| Deployment | ○ | Not deployed. See README "Deploy" |
| Résumé download | ✓ | Copy without a phone number at `website/public/Billal-Zughbi-Resume.pdf` |

## Stage 2: two new analytics projects

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

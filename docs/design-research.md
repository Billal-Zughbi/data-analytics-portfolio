# Design research

Research for the portfolio's visual direction, October 2026. Records only what was actually observed.

## Access and method

| Reference | What could be inspected | Limitation |
|---|---|---|
| Noah Pettinato, [noahpettinato.com](https://noahpettinato.com/) | Page text and structure via a text fetch | The build environment's network policy blocked a real browser session (HTTP 403 at the proxy), so motion, hover states and responsive behaviour on the live site were **not** observed |
| Noah's repository, [noahpettinato/portfolio-site](https://github.com/noahpettinato/portfolio-site) | Full source: `app/page.tsx`, `globals.css`, `components/TypedPrompt.tsx`, `TabNav.tsx`, `package.json` | None |
| Rahul Ramchandani, [rahulrrc.github.io/rahul-portfolio](https://rahulrrc.github.io/rahul-portfolio/) | Page text and structure via a text fetch | Live browser blocked as above; no CSS or scripts were visible in the fetched content, and no public source repository was found to inspect |

So this document is strongest on structure and implementation patterns, and weakest on motion, which had to
be designed from first principles rather than from observation.

## Noah Pettinato

**Observed structure.** Single page: hero ("Data Systems & Analytics"), About (Data Engineering · Analytics &
Visualization · Modeling & Research), Experience, Skills (four groups), Projects (carousel with screenshots
and source links), Contact, footer with "Quick Links". Six anchor links in a top bar.

**Observed implementation (source).** Next.js 16, React 19, Tailwind 4, TypeScript, no animation or chart
library. The whole site is framed as a Windows Terminal window: a tab bar navigation (`TabNav`), PowerShell
prompts (`PS C:\Users\noah\portfolio>`) before each section, a near-black palette (`#0c0c0c`) with terminal
greens, cyans and yellows defined as CSS variables. `TypedPrompt` types each command character by character
once the section is 35% in view (IntersectionObserver), with an `sr-only` copy of the full text and an instant
path for `prefers-reduced-motion`.

**Worth learning.**
* One strong, consistent metaphor carried through every section.
* Motion triggered by scroll position, done once, with an accessible fallback.
* Palette held in CSS variables; restrained use of colour.
* Recruiter-friendly order: who, what, where, proof, contact.

**Would hurt if copied.** The terminal metaphor is his identity, and mono-heavy text slows reading of long
project write-ups. A typing effect on every section delays content.

## Rahul Ramchandani

**Observed structure.** Seven numbered sections (01 About … 07 Contact "Let's build something meaningful."),
a "Menu" with anchor links, hero with role line ("Data Analyst · Jaipur, Rajasthan"), name, summary,
"View My Work" and "Download Resume". Projects: Customer Churn Analysis; Credit Card Financial Analytics
Dashboard. Separate Certifications and Education sections.

**Worth learning.** Numbered sections give a calm, editorial rhythm and make a long page easy to scan.

**Would hurt if copied.** In the fetched page, the résumé link pointed to `#` and the profile and badge images
had empty sources: a reminder never to ship placeholder actions.

## Translation to a data analytics portfolio

* **Numbered, labelled sections** (`01 · Selected projects`) borrowed in spirit from Rahul, rendered with a
  recurring *node-rule* motif: a hairline that starts at a glowing node, like an edge in a lineage graph.
* **One metaphor, used with restraint:** data moving from raw records to modelled structure. It appears once
  as the 3D hero and is echoed by the workflow connector, not repeated as decoration everywhere.
* **Scroll-triggered, once-only reveals** in the style of Noah's prompts, implemented with CSS and an
  IntersectionObserver so content is visible in the HTML and with JavaScript off.
* **Recruiter path within a minute:** hero → flagship project card with its question → case study "In one
  minute" block. Depth (pipeline, model, checks, code) sits further down for technical interviewers.

## Original design language

**Name:** *Analytics laboratory.* Dark, precise, quietly luminous.

* **Surfaces:** near-black navy `#05070d` layered up through `#0a0f1c`, `#0f1628`, `#16203a`; hairlines at
  12–24% of a periwinkle (`rgb(148 163 255)`).
* **Accents:** electric cyan `#4fd8ff` for interaction and focus, violet `#9d8cff` as a secondary signal. Never
  used as chart series colours.
* **Charts:** a separate series palette validated for the dark surface with the dataviz validator
  (lightness band, chroma floor, colour-vision-deficiency separation, contrast): `#2b9fd0`, `#e0703a`,
  `#9085e9`. All checks pass. Text always uses ink tokens, never series colours; two-series charts carry a
  legend and direct end labels; every chart has a hover tooltip and a table view.
* **Type:** Geist Sans for reading, Geist Mono for annotations, indices and units. Tight tracking on display
  sizes.
* **Motif:** nodes and edges (monogram, node-rule, workflow connector, timeline), a faint 64px measurement grid
  masked to fade out.
* **Motion:** 700ms ease-out reveals; a 3D hero computed entirely in shaders; hover lifts of 2–4px. All motion
  is removed under `prefers-reduced-motion`.

## Hero concept

*From noise to structure.* Particles drift in as a loose cloud of "raw records" on the left, funnel through a
violet transform ring, and settle into an ordered lattice of columns on the right while a slow scan line
sweeps the lattice. Pointer movement tilts the scene slightly. Positions are computed in the vertex shader from
one time uniform, so React never re-renders per frame. The canvas loads after first paint, pauses when
scrolled away, renders a single still frame for reduced motion, and falls back to a static SVG of the same
composition without WebGL. The columns are decorative and carry no data.

## Things deliberately avoided

Neon gradients, glassmorphism, animated skill bars, typing effects on every section, scroll-jacking, hover-only
actions, stock 3D, and any metric not traceable to a generated file.

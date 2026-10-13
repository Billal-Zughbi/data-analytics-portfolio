import type { Metadata } from "next";
import Link from "next/link";
import { getProject, repoFileUrl, repoUrl } from "@/content/projects";
import { summary } from "@/data/apple-health";
import { StarSchema } from "@/components/case-study/StarSchema";
import { DayExplorer } from "@/components/case-study/health/DayExplorer";
import { HealthReport } from "@/components/case-study/health/HealthReport";
import { CardAudit } from "@/components/case-study/health/CardAudit";
import {
  ComparisonTable,
  DistanceCheck,
  FitnessScatter,
  Records,
  RhythmCharts,
  StepsHistogram,
  WorkoutsChart,
  YearlyChart,
} from "@/components/case-study/health/HealthCharts";
import { Reveal } from "@/components/Reveal";
import { ArrowRight, CheckIcon, CodeIcon, ExternalIcon, FlagIcon } from "@/components/icons";

const project = getProject("apple-health-analytics");
const base = project.repoPath;

export const metadata: Metadata = {
  title: project.title,
  description: project.summary,
  openGraph: { title: `${project.title} · case study`, description: project.summary, type: "article" },
  twitter: { title: `${project.title} · case study`, description: project.summary },
  alternates: process.env.NEXT_PUBLIC_SITE_URL ? { canonical: `/projects/${project.slug}/` } : undefined,
};

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "report", label: "The report, rebuilt" },
  { id: "audit", label: "Checking every card" },
  { id: "changes", label: "What the rebuild changed" },
  { id: "walking", label: "Twelve years of steps" },
  { id: "training", label: "Training and heart rate" },
  { id: "records", label: "Personal records" },
  { id: "pipeline", label: "Pipeline" },
  { id: "model", label: "Model and rules" },
  { id: "quality", label: "Data quality" },
  { id: "limits", label: "Privacy and limits" },
  { id: "reproduce", label: "Code" },
];

const RULES: Record<string, { label: string; why: string }> = {
  total: { label: "Daily total", why: "Added up per day, keeping one device per hour so overlapping records count once." },
  average: { label: "Daily mean", why: "A rate or a reading. Adding readings together has no meaning." },
  estimate: { label: "Last estimate", why: "A sparse estimate the device revises; the day's latest value is used." },
  level_db: { label: "Energy average", why: "Decibels are logarithmic, so levels are averaged as sound energy." },
};

const ORIGINAL_RULE_KEY: Record<string, string> = { headphone_audio_dba: "headphone_min_dba", stand_hours: "" };
const ORIGINAL_RULE: Record<string, string> = { sum: "Sum", average: "Average", min: "Minimum" };

const n = (x: number) => x.toLocaleString("en-US");
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function Block({ id, index, title, children }: { id: string; index: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-line py-14 first:border-t-0 first:pt-0">
      <Reveal>
        <p className="font-mono text-xs text-accent">{index}</p>
        <h2 id={`${id}-h`} className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
      </Reveal>
      <div className="mt-6 space-y-5 text-base leading-relaxed text-ink-2 [&_strong]:text-ink-1">{children}</div>
    </section>
  );
}

function FindingCard({ id }: { id: string }) {
  const f = summary.findings.find((x) => x.id === id);
  if (!f) return null;
  return (
    <div className="rounded-[var(--radius-md)] border border-line bg-surface-1 p-5">
      <p className="font-semibold text-ink-1">{f.title}</p>
      <p className="mt-2 text-sm leading-relaxed">{f.summary}</p>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        <span className="text-ink-2">How it was measured:</span> {f.metric} {f.caveat}
      </p>
    </div>
  );
}

export default function AppleHealthCaseStudy() {
  const h = summary.headline;
  const src = summary.source;
  const q = summary.quality;
  const excludedMetrics = new Set(q.excluded.map((e) => e.metric)).size;
  const stats: [string, string][] = [
    [n(h.records), "records in the export"],
    [`${(h.steps_total / 1e6).toFixed(1)}M`, "steps counted"],
    [n(h.workouts), "workouts logged"],
    [n(h.watch_days), "days wearing the watch"],
  ];

  return (
    <article className="pt-16">
      <header className="relative overflow-hidden border-b border-line">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
          <nav aria-label="Breadcrumb" className="font-mono text-xs text-ink-3">
            <Link href="/#projects" className="hover:text-ink-1">
              Projects
            </Link>{" "}
            / <span className="text-ink-2">{project.title}</span>
          </nav>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-6xl">{project.title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-2 text-pretty sm:text-xl">{project.summary}</p>
          <dl className="mt-10 grid gap-6 border-t border-line pt-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3">Role</dt>
              <dd className="mt-2 text-ink-2">{project.role}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3">Timeline</dt>
              <dd className="mt-2 text-ink-2">{project.period}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3">Tools</dt>
              <dd className="mt-2 text-ink-2">{project.stack.join(" · ")}</dd>
            </div>
          </dl>
          <p className="mt-8 flex max-w-3xl items-start gap-3 rounded-[var(--radius-md)] border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-ink-2">
            <FlagIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              <strong className="text-ink-1">These are my real numbers</strong>, from {longDate(src.first_day)} to{" "}
              {longDate(src.last_day)}, published as one value per day. The raw export, device names, times of day and workout
              routes stay on my own machine.
            </span>
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-24 space-y-1 border-l border-line text-sm">
            {TOC.map((t, i) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-ink-3 hover:border-accent hover:text-ink-1">
                  <span className="mr-2 font-mono text-[0.6875rem]">{String(i + 1).padStart(2, "0")}</span>
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0">
          <Block id="overview" index="01" title="Overview">
            <p>
              In March 2025 I exported everything my iPhone and Apple Watch had recorded, pulled it apart with a Python script and
              built a four-page Power BI report on top of it. For this portfolio I exported the data again, now running through{" "}
              {longDate(src.last_day)}, and rebuilt the whole thing: a new pipeline, a check of every number the old report
              showed, and the report itself recreated on this page so you can use it without Power BI.
            </p>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line lg:grid-cols-4">
              {stats.map(([v, l]) => (
                <div key={l} className="bg-surface-1 p-5">
                  <dt className="text-xs text-ink-3">{l}</dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink-1 tabular-nums sm:text-3xl">{v}</dd>
                </div>
              ))}
            </dl>
            <p>
              Start with any day. The Move, Exercise and Stand numbers below use the same goals as the watch, the icon spins on
              days all three rings closed, and the calendar shows every day&apos;s steps for the year. Pick a square to load that day.
            </p>
            <DayExplorer />
          </Block>

          <Block id="report" index="02" title="The original report, rebuilt">
            <p>
              The original report had four pages: <strong>Energy and Activity</strong>, <strong>Cardiovascular</strong>,{" "}
              <strong>Mobility and Movement</strong>, and <strong>Physical and Environmental</strong>. Each one has the same cards
              and charts here, driven by the rebuilt daily data. The report opens on the dates each page was set to in the original
              file, and you can switch to any year or pick your own range.
            </p>
            <p className="text-sm text-ink-3">
              When the original dates are selected, each card also shows the number the old report displayed. Where they differ,
              the note under the card says why.
            </p>
            <HealthReport />
          </Block>

          <Block id="audit" index="03" title="Checking every card on the old report">
            <p>
              Before trusting my own rebuild, I wanted to know whether I could explain the old numbers. I read the report&apos;s
              layout, Power Query steps and relationships straight out of the .pbix file, then recomputed every card in pandas
              following the same filters. Below, each card shows the number the old report displayed and the number it should
              have shown: my rebuilt numbers, from the {longDate(src.last_day)} export with the corrected rules, for the same dates
              the old page was filtered to. Card names are copied from the old report as they were.
            </p>
            <FindingCard id="cards" />
            <CardAudit />
          </Block>

          <Block id="changes" index="04" title="What the rebuild changed">
            <p>
              The old report kept some decisions implicit: which device counts when two of them log the same walk, and how a day
              of readings becomes one number. The rebuild writes each of those down. On the days both versions cover, most metrics
              agree to the decimal; the ones that moved did so for a reason I can point to.
            </p>
            <ComparisonTable />
            <div className="grid gap-4 md:grid-cols-2">
              <FindingCard id="dedup" />
              <FindingCard id="rates" />
            </div>
            <FindingCard id="distance" />
            <DistanceCheck />
          </Block>

          <Block id="walking" index="05" title="Twelve years of steps">
            <p>
              Steps go back to {longDate(src.first_day)}, when the phone was the only thing counting, and the watch joins in{" "}
              {longDate(src.watch_start)}. Over {n(h.step_days)} days I averaged <strong>{n(h.steps_mean)} steps</strong>, and{" "}
              {Math.round(h.goal_share * 100)}% of days reached 10,000.
            </p>
            <YearlyChart />
            <div className="grid gap-4 xl:grid-cols-2">
              <RhythmCharts />
              <StepsHistogram />
            </div>
          </Block>

          <Block id="training" index="06" title="Training and heart rate">
            <p>
              The biggest change in the data comes in 2023, when strength training starts showing up several times a week.
              Logged workouts go from a handful a year to a few hundred, and resting heart rate comes down over the same months.
            </p>
            <WorkoutsChart />
            <FindingCard id="fitness" />
            <FitnessScatter />
          </Block>

          <Block id="records" index="07" title="Personal records">
            <p>Pulled from the cleaned daily table, so a glitchy day can&apos;t take a record.</p>
            <Records />
          </Block>

          <Block id="pipeline" index="08" title="Pipeline">
            <ol className="relative space-y-4 border-l border-line pl-6">
              {[
                ["Extract", "extract.py", `Streams the ${(src.records / 1e6).toFixed(1)} million records in export.xml with ElementTree.iterparse, clearing each element as it goes so memory stays flat on a 1.9 GB file. Device names are replaced by a device class and an anonymous rank before anything is written.`],
                ["Normalize", "metrics.py · transform.py", "Maps each record type to a metric and converts units (km/h to mph, percentages, seconds to minutes). A unit with no known conversion is rejected rather than guessed."],
                ["De-duplicate devices", "transform.py", "For additive metrics, keeps one device per metric-hour: the watch when it was worn, then the phone, then anything else. Within a class the newest device wins, which handles the switch from one watch to the next."],
                ["Aggregate daily", "transform.py", "Applies each metric's rule: total, mean, last estimate, decibel energy average or distinct stood hours. Exercise and stand are zero-filled only on days the watch was worn."],
                ["Clean", "analysis.py", "Checks every daily value against a plausible range. Values outside it are excluded and listed, never edited."],
                ["Reproduce the original", "pbix_source.py · report_sim.py", "Reads the old model's Power Query, relationships and report layout, then recomputes each card by following Power BI's filter paths."],
                ["Publish", "publish.py", "Writes the JSON for this site, a star schema for Power BI and a quality report. CI rebuilds them and fails if any committed output changes."],
              ].map(([title, file, body], i) => (
                <li key={title} className="relative">
                  <span aria-hidden className="absolute -left-[1.9375rem] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-line-strong bg-bg font-mono text-[0.5625rem] text-accent">
                    {i + 1}
                  </span>
                  <p className="font-semibold text-ink-1">
                    {title} <span className="ml-2 font-mono text-xs font-normal text-ink-3">{file}</span>
                  </p>
                  <p className="mt-1 text-sm">{body}</p>
                </li>
              ))}
            </ol>
            <p className="text-sm">
              My original March 2025 scripts are kept unchanged in{" "}
              <a className="text-accent underline-offset-4 hover:underline" href={repoUrl(`${base}/legacy`)}>
                legacy/
              </a>{" "}
              for comparison.
            </p>
          </Block>

          <Block id="model" index="09" title="Data model and daily rules">
            <p>
              The old model had {summary.model.tables} tables joined by {summary.model.relationships} relationships, most of them
              two-way and one-to-one on the date, with {summary.model.inactive.length} inactive and{" "}
              {summary.model.value_joins.length} joined on a value column by mistake. The rebuild uses a small star schema instead.
              Each metric&apos;s daily rule lives in <code className="font-mono text-sm text-ink-1">dim_metric</code>, so the DAX
              measures only ever average daily values that were already computed the right way.
            </p>
            <StarSchema />
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <caption className="sr-only">Daily rule for each metric, in the original report and in the rebuild</caption>
                <thead className="bg-surface-2 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-3">
                  <tr>
                    <th scope="col" className="px-4 py-3">Metric</th>
                    <th scope="col" className="px-4 py-3">Unit</th>
                    <th scope="col" className="px-4 py-3">Original</th>
                    <th scope="col" className="px-4 py-3">Rebuilt</th>
                    <th scope="col" className="px-4 py-3">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.metrics.map((m) => {
                    const key = ORIGINAL_RULE_KEY[m.key] ?? m.key;
                    const orig = key ? summary.model.rules[key] : null;
                    const rule = m.key === "stand_hours" ? { label: "Distinct hours", why: "Only hours marked as stood count, as on the watch." } : RULES[m.kind];
                    return (
                      <tr key={m.key} className="border-t border-line align-top">
                        <td className="px-4 py-2.5 text-ink-1">{m.label}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-ink-3">{m.unit}</td>
                        <td className="px-4 py-2.5 text-ink-3">{orig ? ORIGINAL_RULE[orig] ?? orig : "Not in report"}</td>
                        <td className="px-4 py-2.5">{rule?.label}</td>
                        <td className="px-4 py-2.5 text-ink-3">{rule?.why}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Block>

          <Block id="quality" index="10" title="Data quality">
            <p>Every check runs on each build, and anything it removes is counted.</p>
            <ul className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line sm:grid-cols-2">
              {q.checks.map((c) => (
                <li key={c.name} className="flex gap-3 bg-surface-1 p-4">
                  {c.result === "pass" ? (
                    <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-good" />
                  ) : (
                    <FlagIcon className={`mt-1 h-4 w-4 shrink-0 ${c.result === "warn" ? "text-warn" : "text-ink-3"}`} />
                  )}
                  <p className="text-sm">
                    <span className="sr-only">{c.result}: </span>
                    {c.detail}
                  </p>
                </li>
              ))}
            </ul>
            <details className="group rounded-[var(--radius-md)] border border-line bg-surface-1">
              <summary className="cursor-pointer px-4 py-3 text-sm text-ink-1">
                The {q.excluded.length} excluded daily values, across {excludedMetrics} metrics
              </summary>
              <div className="overflow-x-auto border-t border-line">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <caption className="sr-only">Daily values excluded by the plausible-range check</caption>
                  <thead className="bg-surface-2 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-3">
                    <tr>
                      <th scope="col" className="px-4 py-2.5">Date</th>
                      <th scope="col" className="px-4 py-2.5">Metric</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Value</th>
                      <th scope="col" className="px-4 py-2.5">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.excluded.map((e) => (
                      <tr key={`${e.metric}-${e.date}`} className="border-t border-line">
                        <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-ink-2">{shortDate(e.date)}</td>
                        <td className="px-4 py-2 text-ink-1">{summary.metrics.find((m) => m.key === e.metric)?.label ?? e.metric}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">{n(e.value)}</td>
                        <td className="px-4 py-2 text-xs text-ink-3">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <p>
              A <strong>pytest</strong> suite covers the rules on a small hand-written export (device priority, means for rates, the
              decibel average, unit conversion, local-day assignment) and checks the published files: every original card
              reproduces, the Power BI tables join without fan-out, and no device names or times of day appear anywhere.
            </p>
          </Block>

          <Block id="limits" index="11" title="Privacy and limits">
            <ul className="space-y-3">
              {[
                "Only daily values are public. The export itself, the .pbix file, device names, times of day and GPS routes from workouts are never committed.",
                "This is personal tracking, not clinical measurement. Heart rate, HRV and VO2 max are watch estimates, and nothing here supports a medical conclusion.",
                "De-duplication works per hour. Health's own merge works on finer intervals, so a daily total here can differ slightly from the Health app.",
                "Days are assigned by local wall-clock time from each record's start; the old report used the date each record was written. The March 2025 and October 2026 exports also don't match day by day for a few metrics, so a total over a short date range can differ even where the long-run averages agree.",
                "Before April 2018 only the phone counted steps, and only while it was in a pocket, so those years read lower than they were.",
                "The values the old report displayed were copied from its March 2025 screenshots; each match is checked to the precision the card showed.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden className="mt-2.5 h-1 w-3 shrink-0 rounded-full bg-ink-3" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Block>

          <Block id="reproduce" index="12" title="Code and how to run it">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Project folder", repoUrl(base)],
                ["Pipeline source", repoUrl(`${base}/src/apple_health`)],
                ["Tests", repoUrl(`${base}/tests`)],
                ["Power BI model, DAX and theme", repoUrl(`${base}/powerbi`)],
                ["Daily tables", repoUrl(`${base}/data`)],
                ["Project audit", repoFileUrl("docs/apple-health-project-audit.md")],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className="group flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line bg-surface-1 px-4 py-3 text-sm text-ink-1 transition-colors hover:border-accent/60"
                >
                  <span className="flex items-center gap-3">
                    <CodeIcon className="h-4 w-4 text-ink-3" />
                    {label}
                  </span>
                  <ExternalIcon className="h-3.5 w-3.5 text-ink-3 group-hover:text-accent" />
                </a>
              ))}
            </div>
            <pre className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface-2 p-4 font-mono text-[0.8125rem] leading-relaxed text-ink-2">
{`cd ${base}
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest                              # rules, card reproduction, privacy checks
PYTHONPATH=src python -m apple_health build   # committed daily tables → site JSON + Power BI tables

# With your own export (kept out of git):
PYTHONPATH=src python -m apple_health ingest-xml --xml path/to/export.xml`}
            </pre>
            <Link href="/#projects" className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
              Back to the home page <ArrowRight className="h-4 w-4" />
            </Link>
          </Block>
        </div>
      </div>
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getProject, repoFileUrl, repoUrl } from "@/content/projects";
import { summary, weekly } from "@/data/apple-health";
import { MetricExplorer } from "@/components/case-study/MetricExplorer";
import { AggregationAudit } from "@/components/case-study/AggregationAudit";
import { StarSchema } from "@/components/case-study/StarSchema";
import { Reveal } from "@/components/Reveal";
import { ArrowRight, CheckIcon, CodeIcon, ExternalIcon, FlagIcon } from "@/components/icons";

const project = getProject("apple-health-analytics");
const base = project.repoPath;

export const metadata: Metadata = {
  title: project.title,
  description: project.summary,
  openGraph: { title: `${project.title} · case study`, description: project.summary, type: "article" },
  alternates: process.env.NEXT_PUBLIC_SITE_URL ? { canonical: `/projects/${project.slug}/` } : undefined,
};

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "problem", label: "Problem" },
  { id: "data", label: "Data & privacy" },
  { id: "pipeline", label: "Pipeline" },
  { id: "model", label: "Model & measures" },
  { id: "dashboard", label: "Dashboard" },
  { id: "review", label: "What the review found" },
  { id: "quality", label: "Validation" },
  { id: "limits", label: "Limitations" },
  { id: "reproduce", label: "Code & reproduce" },
];

const RULES: Record<string, { label: string; why: string }> = {
  sum: { label: "Daily total", why: "Additive. Overlapping watch and phone records are de-duplicated first." },
  mean: { label: "Daily mean", why: "A rate or reading. Summing it has no meaning." },
  energy_mean: { label: "Energy average", why: "Decibels are logarithmic, so levels are averaged as sound energy." },
  last: { label: "Last reading", why: "A sparse estimate that the device revises over time." },
  stood_hours: { label: "Distinct hours", why: "Category records; count the hours marked Stood." },
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n = (x: number) => x.toLocaleString("en-US");

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

export default function AppleHealthCaseStudy() {
  const q = summary.quality;
  const audit = summary.aggregation_audit;
  const checks = q.checks;

  return (
    <article className="pt-16">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-line">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
          <nav aria-label="Breadcrumb" className="font-mono text-xs text-ink-3">
            <Link href="/#projects" className="hover:text-ink-1">
              Projects
            </Link>{" "}
            / <span className="text-ink-2">{project.title}</span>
          </nav>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-6xl">
            {project.title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-2 text-pretty sm:text-xl">{project.summary}</p>
          <dl className="mt-10 grid gap-6 border-t border-line pt-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Role</dt>
              <dd className="mt-2 text-ink-2">{project.role}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Timeline</dt>
              <dd className="mt-2 text-ink-2">{project.period}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Tools</dt>
              <dd className="mt-2 text-ink-2">{project.stack.join(" · ")}</dd>
            </div>
          </dl>
          <p className="mt-8 inline-flex max-w-3xl items-start gap-3 rounded-[var(--radius-md)] border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-ink-2">
            <FlagIcon className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <span>
              <strong className="text-ink-1">Every chart and number on this page comes from synthetic data.</strong> The
              original export holds personal health records, so it stays private. The pipeline here generates a fictional
              export and runs on it end to end.
            </span>
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14">
        {/* Table of contents */}
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-24 space-y-1 border-l border-line text-sm">
            {TOC.map((t, i) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-ink-3 hover:border-accent hover:text-ink-1">
                  <span className="mr-2 font-mono text-[11px]">{String(i + 1).padStart(2, "0")}</span>
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0">
          <Block id="overview" index="01" title="Summary">
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                ["The problem", "Apple Health exports everything as one large XML file, with dozens of record types from several devices and plenty of overlapping and duplicate records."],
                ["What I built", "A Python pipeline that reads the XML, cleans it, and rolls each metric up to one value per day using a rule chosen for that metric. It feeds a star-schema Power BI model with DAX measures that follow the same rules."],
                ["What changed in the rebuild", "Rates like heart rate are averaged instead of added up, steps logged by both the watch and the phone are counted once, and sound levels use a proper decibel average. The original report relied on Power BI's default aggregations for these."],
                ["Privacy", "The real export, the CSVs, the .pbix file and its screenshots aren't published. Everything on this page comes from a synthetic export I generated."],
              ].map(([h, b]) => (
                <li key={h} className="rounded-[var(--radius-md)] border border-line bg-surface-1 p-5">
                  <p className="font-semibold text-ink-1">{h}</p>
                  <p className="mt-2 text-sm leading-relaxed">{b}</p>
                </li>
              ))}
            </ul>
          </Block>

          <Block id="problem" index="02" title="The problem">
            <p>
              The Health app shows simple trends, but the full record lives in <code className="font-mono text-sm text-ink-1">export.xml</code>,
              a single file that can run to hundreds of megabytes. Each <code className="font-mono text-sm text-ink-1">&lt;Record&gt;</code> carries a type,
              a source device, start and end timestamps with a UTC offset, a value and a unit.
            </p>
            <p>
              To analyze it you have to answer questions the file does not: <strong>what does one day mean</strong> when a record
              spans midnight, <strong>which device counts</strong> when a watch and a phone both log the same walk, and{" "}
              <strong>how should each metric be rolled up</strong> when steps add up but heart rate does not.
            </p>
            <p>
              I first built this in March 2025 as a Python extraction script and a Power BI report. For this portfolio I went back
              through it and rebuilt the pipeline so each of those decisions is written down and tested.
            </p>
          </Block>

          <Block id="data" index="03" title="Data source and privacy">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[var(--radius-md)] border border-line bg-surface-1 p-5 text-sm">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Fields used</p>
                <ul className="mt-3 space-y-1.5 font-mono text-[13px] text-ink-2">
                  <li>type <span className="text-ink-3">· 16 metrics in the daily model</span></li>
                  <li>sourceName <span className="text-ink-3">· reduced to watch / phone / other</span></li>
                  <li>startDate, endDate <span className="text-ink-3">· local wall-clock time</span></li>
                  <li>value, unit <span className="text-ink-3">· converted to one unit per metric</span></li>
                </ul>
              </div>
              <div className="rounded-[var(--radius-md)] border border-line bg-surface-1 p-5 text-sm">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Kept private</p>
                <ul className="mt-3 space-y-1.5 text-ink-2">
                  <li>The original export and its per-type CSV extracts</li>
                  <li>The .pbix, which embeds the imported personal data</li>
                  <li>The original report screenshots, which show real values</li>
                  <li>Device names, which can contain people&apos;s names</li>
                </ul>
              </div>
            </div>
            <p>
              The public demonstration uses a <strong>synthetic export</strong> written by the project&apos;s own generator: a fictional,
              moderately active adult over {summary.period.days} days in {summary.period.start.slice(0, 4)}, with{" "}
              {n(summary.generator.records)} records. Its parameters are round, hand-picked values, not fitted to anyone&apos;s data.
              I also built in the kinds of problems a real export has: overlapping watch and phone records, a stretch of
              walking speed logged in km/h, a duplicated day from a merged backup, and a few sensor glitches.
            </p>
            <p className="text-sm text-ink-3">
              Removing names isn&apos;t enough to make health data anonymous. Even daily totals from a real person can identify them,
              so none are published here.
            </p>
          </Block>

          <Block id="pipeline" index="04" title="Pipeline">
            <ol className="relative space-y-4 border-l border-line pl-6">
              {[
                ["Extract", "extract.py", "Streams the XML with ElementTree.iterparse and clears each element, so memory stays flat on large exports. Keeps local time from each record's own offset. Replaces device names with a device class."],
                ["Normalize", "transform.py", "Maps each record type to a metric, converts units (km/h to mph, cm to in, kJ to kcal) and rejects units it cannot convert rather than guessing."],
                ["Clean", "transform.py", "Removes exact duplicates. Flags readings outside a plausible range and excludes them from daily values while counting them in the quality report."],
                ["De-duplicate devices", "transform.py", "For additive metrics, keeps the highest-priority device in each metric-hour (watch, then phone), so one walk is not counted twice."],
                ["Aggregate daily", "transform.py", "Applies each metric's declared rule: total, mean, energy average, last reading or distinct stood hours. Zero-fills exercise on days the watch was worn."],
                ["Validate & export", "quality.py · export_web.py", "Profiles every check, writes the Power BI star schema and small JSON files for this site, and refuses to export anything not marked synthetic."],
              ].map(([title, file, body], i) => (
                <li key={title} className="relative">
                  <span aria-hidden className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-line-strong bg-bg font-mono text-[9px] text-accent">
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
              The original scripts are preserved unchanged in{" "}
              <a className="text-accent underline-offset-4 hover:underline" href={repoUrl(`${base}/legacy`)}>
                legacy/
              </a>{" "}
              for comparison.
            </p>
          </Block>

          <Block id="model" index="05" title="Data model and measure rules">
            <p>
              The report runs on a small star schema. Each metric&apos;s daily rule lives in{" "}
              <code className="font-mono text-sm text-ink-1">dim_metric</code>, so DAX measures only ever average daily values
              that were already computed correctly.
            </p>
            <StarSchema />
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line">
              <table className="w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">Daily aggregation rule for each metric</caption>
                <thead className="bg-surface-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  <tr>
                    <th scope="col" className="px-4 py-3">Metric</th>
                    <th scope="col" className="px-4 py-3">Unit</th>
                    <th scope="col" className="px-4 py-3">Daily rule</th>
                    <th scope="col" className="px-4 py-3">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.metrics.map((m) => (
                    <tr key={m.key} className="border-t border-line align-top">
                      <td className="px-4 py-2.5 text-ink-1">{m.label}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-3">{m.unit}</td>
                      <td className="px-4 py-2.5">{RULES[m.aggregation].label}</td>
                      <td className="px-4 py-2.5 text-ink-3">{RULES[m.aggregation].why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>

          <Block id="dashboard" index="06" title="Dashboard (web version)">
            <p>
              The original Power BI report has four pages: Energy and Activity, Cardiovascular, Mobility and Movement, and Physical and
              Environmental. Below is a web version of the same layout, built from the pipeline&apos;s output. It
              isn&apos;t <strong>the Power BI report itself</strong>, and every value is synthetic.
            </p>
            <MetricExplorer metrics={summary.metrics} kpis={summary.kpis} rows={weekly} />
          </Block>

          <Block id="review" index="07" title="What the review found">
            <p>
              The original report&apos;s layout definition shows several visuals using Power BI&apos;s default{" "}
              <code className="font-mono text-sm text-ink-1">Sum</code> on metrics that should never be added: resting heart rate,
              heart rate, VO2 max and HRV plotted on date axes. The card labelled average daily active energy uses{" "}
              <code className="font-mono text-sm text-ink-1">Average</code> over the energy column, which averages readings
              rather than daily totals unless the rows were already one per day.
            </p>
            <p>
              The extracted CSVs do hold several readings per day for these metrics, some from two devices. My review covered
              the report&apos;s layout but not its compressed data model, so I haven&apos;t confirmed yet whether Power Query reduced
              readings to one per day before those visuals. The rebuild avoids the issue by setting each metric&apos;s daily rule
              in the pipeline. The synthetic data reproduces the risky conditions, so the size of each effect can be shown
              without real data:
            </p>
            <AggregationAudit audit={audit} />
            <dl className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line sm:grid-cols-2">
              <div className="bg-surface-1 p-5">
                <dt className="text-sm text-ink-3">Steps with watch and phone simply added</dt>
                <dd className="mt-1">
                  <span className="text-3xl font-semibold tracking-tight text-ink-1">+{audit.steps.inflation_pct}%</span>
                  <p className="mt-2 text-xs leading-relaxed text-ink-3">
                    {n(audit.steps.avg_naive_sum)} vs {n(audit.steps.avg_deduplicated)} average daily steps after de-duplication
                    (synthetic).
                  </p>
                </dd>
              </div>
              <div className="bg-surface-1 p-5">
                <dt className="text-sm text-ink-3">Sound level, arithmetic vs energy average</dt>
                <dd className="mt-1">
                  <span className="text-3xl font-semibold tracking-tight text-ink-1">{audit.environmental_audio.avg_daily_gap_db} dB</span>
                  <p className="mt-2 text-xs leading-relaxed text-ink-3">
                    Average daily understatement from averaging decibels arithmetically; up to {audit.environmental_audio.max_daily_gap_db} dB on
                    the noisiest days (synthetic).
                  </p>
                </dd>
              </div>
            </dl>
            <p className="text-sm text-ink-3">
              These figures measure the synthetic data. Whether the original report shows the same effects on the real data
              still has to be confirmed in Power BI Desktop.
            </p>
          </Block>

          <Block id="quality" index="08" title="Validation and data quality">
            <p>
              The quality step counts every problem it finds, so nothing gets fixed without a record of it. Results for the synthetic export (
              {n(q.records_total)} records):
            </p>
            <ul className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line sm:grid-cols-2">
              {[
                [checks.exact_duplicates, "exact duplicate records removed", "A day duplicated by a merged backup"],
                [checks.overlap_records_removed, "overlapping device records set aside", "Same metric-hour from watch and phone"],
                [checks.unit_converted, "records converted to a canonical unit", "Walking speed logged in km/h"],
                [checks.out_of_range, "out-of-range readings excluded", "Heart-rate glitches above 230 bpm"],
                [checks.unit_rejected, "records with an unknown unit", "Rejected rather than guessed"],
                [checks.days_without_watch_data ?? 0, "days without watch data", "Left blank instead of zero"],
              ].map(([value, label, note]) => (
                <li key={label as string} className="flex gap-3 bg-surface-1 p-4">
                  <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-good" />
                  <div>
                    <p className="text-ink-1">
                      <span className="font-semibold tabular-nums">{n(value as number)}</span> {label}
                    </p>
                    <p className="text-xs text-ink-3">{note}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p>
              A <strong>pytest</strong> suite tests these rules against a small hand-written export: watch-over-phone
              de-duplication, means instead of sums for rates, the decibel energy average, unit conversion and rejection, local-day
              assignment across time zones, determinism of the generator, that public outputs carry no device names or record-level
              timestamps, and that the Power BI tables join without fan-out and reconcile with the daily table.
            </p>
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line">
              <table className="w-full min-w-[520px] text-left text-sm">
                <caption className="sr-only">Records and day coverage per metric, synthetic export</caption>
                <thead className="bg-surface-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  <tr>
                    <th scope="col" className="px-4 py-3">Metric</th>
                    <th scope="col" className="px-4 py-3 text-right">Records</th>
                    <th scope="col" className="px-4 py-3 text-right">Days covered</th>
                    <th scope="col" className="px-4 py-3">Devices</th>
                  </tr>
                </thead>
                <tbody>
                  {q.by_metric.map((m) => (
                    <tr key={m.metric} className="border-t border-line">
                      <td className="px-4 py-2 text-ink-1">{m.label}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{n(m.records)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{pct(m.day_coverage)}</td>
                      <td className="px-4 py-2 font-mono text-xs text-ink-3">{Object.keys(m.devices).join(" + ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>

          <Block id="limits" index="09" title="Limitations">
            <ul className="space-y-3">
              {[
                "Personal tracking, not clinical measurement. Wearable heart rate, HRV and VO2 max are device estimates, and nothing here supports a medical conclusion.",
                "Device de-duplication works per metric-hour. Health's own merge works on finer intervals, so totals can differ slightly from the Health app.",
                "Days are assigned by local wall-clock time. Travel across time zones can shift a record by a day at the edges.",
                "The synthetic profile is invented. Its trends (more steps, a lower resting heart rate over the year) were designed to exercise the charts and say nothing about any real person.",
                "The original Power BI report was reviewed from its layout metadata only. Its data model and Power Query steps were not re-inspected, so the review describes risks in the original visuals, demonstrated on synthetic data, not confirmed errors in the real numbers.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden className="mt-2.5 h-1 w-3 shrink-0 rounded-full bg-ink-3" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Block>

          <Block id="reproduce" index="10" title="Code and reproduction">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Project folder", repoUrl(base)],
                ["Pipeline source", repoUrl(`${base}/src/apple_health`)],
                ["Tests and fixture", repoUrl(`${base}/tests`)],
                ["Power BI model, DAX and report spec", repoUrl(`${base}/powerbi`)],
                ["Synthetic sample tables", repoUrl(`${base}/data/sample`)],
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
            <pre className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface-2 p-4 font-mono text-[13px] leading-relaxed text-ink-2">
{`cd ${base}
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest                       # rule and contract tests
PYTHONPATH=src python -m apple_health demo   # synthetic export → site data + Power BI tables`}
            </pre>
            <Link href="/#projects" className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
              Back to projects <ArrowRight className="h-4 w-4" />
            </Link>
          </Block>
        </div>
      </div>
    </article>
  );
}

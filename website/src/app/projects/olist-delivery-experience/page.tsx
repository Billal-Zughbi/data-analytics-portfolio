import type { Metadata } from "next";
import Link from "next/link";
import { getProject } from "@/content/projects";
import { categories, estimate, monthly, reviewByDelay, routes, summary } from "@/data/olist";
import {
  Block,
  CaseBody,
  CaseHeader,
  FindingList,
  KpiGrid,
  NextSteps,
  QualitySummary,
  ReconciliationTable,
  RepoLinks,
  SourceList,
} from "@/components/case-study/CaseStudyShell";
import {
  EstimateChart,
  HandlingTransitChart,
  MonthlyLateChart,
  ReviewByDelayChart,
  RoutesChart,
} from "@/components/case-study/olist/OlistCharts";
import { ArrowRight } from "@/components/icons";

const project = getProject("olist-delivery-experience");
const base = project.repoPath;

export const metadata: Metadata = {
  title: project.title,
  description: project.summary,
  openGraph: { title: `${project.title} · case study`, description: project.summary, type: "article" },
  alternates: process.env.NEXT_PUBLIC_SITE_URL ? { canonical: `/projects/${project.slug}/` } : undefined,
};

const TOC = [
  { id: "summary", label: "Summary" },
  { id: "why", label: "Why it matters" },
  { id: "findings", label: "Findings" },
  { id: "explore", label: "Explore the data" },
  { id: "data", label: "Data & coverage" },
  { id: "method", label: "How I built it" },
  { id: "validation", label: "Validation" },
  { id: "powerbi", label: "Power BI" },
  { id: "next", label: "Next steps" },
  { id: "caveats", label: "Caveats" },
  { id: "code", label: "Code & reproduce" },
];

const n = (x: number) => x.toLocaleString("en-US");
const brl = (x: number) => `R$${(x / 1e6).toFixed(1)}M`;

export default function OlistCaseStudy() {
  const st = summary.statistics;
  const recon = summary.reconciliation;
  const matched = recon.filter((r) => r.match).length;
  const metricRecon = recon.filter((r) => !r.metric.startsWith("table:"));
  const src = summary.source;
  const topRevenue = categories.revenue_by_category.slice(0, 5);

  return (
    <article className="pt-16">
      <CaseHeader
        project={project}
        notice={
          <>
            <strong className="text-ink-1">Real, public data.</strong> {src.attribution}
          </>
        }
      />

      <CaseBody toc={TOC}>
        <Block id="summary" index="01" title="Summary">
          <p className="border-l-2 border-accent/60 pl-4 text-lg text-ink-1">{summary.question}</p>
          <KpiGrid kpis={summary.kpis} />
          <p className="text-sm text-ink-3">
            All values are calculated from {n(src.rows?.orders ?? 0)} orders placed between {src.coverage?.start} and{" "}
            {src.coverage?.end}. Timing figures use the delivered orders.
          </p>
        </Block>

        <Block id="why" index="02" title="Why it matters">
          <p>
            For a marketplace, the review score is one of the few signals a new customer sees before buying, and sellers
            are judged by it. If delivery problems drag scores down, an operations team needs to know how much, and
            where to look first. That means separating lateness from everything else that affects a rating, and finding
            the routes and periods that produce more than their share of late orders.
          </p>
          <p>
            I wrote this for a hypothetical marketplace operations lead. The recommendations are proposals for that
            person. None of them has been tried.
          </p>
        </Block>

        <Block id="findings" index="03" title="Findings">
          <FindingList findings={summary.findings} />
          <p className="text-sm text-ink-3">
            The review gap between late and on-time orders is {st.mean_score_diff.toFixed(2)} stars (95% interval{" "}
            {st.mean_score_diff_ci95[0].toFixed(2)} to {st.mean_score_diff_ci95[1].toFixed(2)}; Welch test on{" "}
            {n(st.late_reviews)} late and {n(st.on_time_reviews)} on-time orders). This is a description of the data,
            not a measured effect.
          </p>
        </Block>

        <Block id="explore" index="04" title="Explore the data">
          <p>
            Each chart reads the files the pipeline exports. Use the buttons to switch views, hover for exact values, or
            open the table under any chart.
          </p>
          <ReviewByDelayChart rows={reviewByDelay} />
          <EstimateChart rows={estimate.rows} median={estimate.summary.days_vs_estimate_median} clampNote={estimate.clamp.note} />
          <MonthlyLateChart rows={monthly.rows} byDest={monthly.by_destination} overall={routes.overall_late_rate} />
          <HandlingTransitChart rows={monthly.rows} />
          <RoutesChart
            top={routes.top_by_late_orders}
            highest={routes.highest_rate_min_orders}
            overall={routes.overall_late_rate}
            minOrders={routes.min_orders_for_rate_ranking}
          />
          <div className="rounded-[var(--radius-md)] border border-line bg-surface-1 p-5 text-sm">
            <p className="font-semibold text-ink-1">Context: where the revenue is</p>
            <p className="mt-2">
              Item price plus freight came to {brl(categories.revenue_total)} on delivered orders. The five largest
              categories:
            </p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {topRevenue.map((c) => (
                <li key={c.category} className="flex justify-between gap-3 border-b border-line py-1">
                  <span className="text-ink-1">{c.category.replaceAll("_", " ")}</span>
                  <span className="font-mono text-xs tabular-nums">{(c.revenue_share * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-ink-3">
              The data has no costs, so there is no profit or margin anywhere in this project.
            </p>
          </div>
        </Block>

        <Block id="data" index="05" title="Data and coverage">
          <SourceList sources={[src]} />
          <p className="text-sm">
            <strong>About this copy.</strong> {src.version_note} Kaggle was not reachable from the environment I built
            this in, so the files came from a public GitHub copy, with checksums recorded.
          </p>
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line">
            <table className="w-full min-w-[520px] text-left text-sm">
              <caption className="sr-only">Grain of the main tables</caption>
              <thead className="bg-surface-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
                <tr>
                  <th scope="col" className="px-4 py-3">Table</th>
                  <th scope="col" className="px-4 py-3">One row is</th>
                  <th scope="col" className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["core.fct_orders", "an order", "Every order in the source, with delivery outcome, days vs estimate, chosen review and route"],
                  ["core.fct_order_items", "an order item", "Price, freight, product, seller"],
                  ["core.order_payments", "an order", "Payment rows rolled up before any join, so items are never repeated"],
                  ["core.order_review", "an order with a review", "Latest answered review; a review shared by several orders counts for each"],
                  ["mart.*", "varies", "Analysis tables; each one's grain is in its SQL comment"],
                ].map(([t, g, note]) => (
                  <tr key={t} className="border-t border-line align-top">
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-1">{t}</td>
                    <td className="px-4 py-2.5">{g}</td>
                    <td className="px-4 py-2.5 text-ink-3">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <strong>Late</strong> means delivered on a later calendar day than the estimate. Every estimate in the file is
            stored at midnight, so comparing full timestamps would count same-day deliveries as late. Orders that were
            never delivered are counted in their own groups and never dropped.
          </p>
        </Block>

        <Block id="method" index="06" title="How I built it">
          <ol className="relative space-y-4 border-l border-line pl-6">
            {[
              ["Load and check the source", "ingest.py", "Counts rows with a CSV parser, records checksums, compares against the published counts and stops with download instructions if files are missing."],
              ["Stage and type", "sql/00–01", "Raw text tables, then typed staging with TRY_CAST. Review text is reduced to yes/no flags and never leaves the database."],
              ["Model", "sql/02_transformations.sql", "An order fact and an item fact with a documented grain. Payments are rolled up to the order first, because joining raw payment rows to items repeats each item once per payment."],
              ["Analyse", "sql/03_analytics.sql", "CTEs, window functions (ranking, running and rolling sums, LAG), conditional aggregation, a monthly series, route and category comparisons with Wilson intervals, and a customer cohort query."],
              ["Validate", "sql/04_validation.sql", "Primary keys, referential integrity for every relationship, a join fan-out test and a payments vs items reconciliation. A failed blocking check stops the build."],
              ["Rebuild in pandas and compare", "clean.py · analyze.py · reconcile.py", "The same metrics computed again without touching the database. Any mismatch stops the export."],
              ["Export", "export.py", "Analysis CSVs, Power BI tables, figures and the small JSON files this page reads, with a privacy and size guard."],
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
        </Block>

        <Block id="validation" index="07" title="Validation">
          <QualitySummary checks={summary.quality.checks} />
          <p>
            <strong>
              SQL and pandas agree on {matched} of {recon.length} comparisons
            </strong>{" "}
            ({metricRecon.length} headline metrics plus {recon.length - metricRecon.length} whole tables). The headline
            metrics:
          </p>
          <ReconciliationTable rows={metricRecon.slice(0, 12)} />
          <p className="text-sm text-ink-3">
            The full comparison is in the repository&apos;s outputs/reconciliation.csv. Tests run with pytest on a hand-written
            fixture, and a data-contract test runs on the full data when it is present.
          </p>
        </Block>

        <Block id="powerbi" index="08" title="Power BI">
          <p>
            The repository has a Power BI model kit: nine aggregate star-schema tables, Power Query (M) for each, explicit
            DAX measures that always divide sums (no averaged rates), a theme matching this site and a four-page report
            spec. The expected value of every headline measure is listed so the finished report can be checked.
          </p>
          <p>
            <strong>There is no .pbix or .pbip file.</strong> Power BI Desktop only runs on Windows and wasn&apos;t available
            where I built this, so the M, relationships and DAX haven&apos;t been run in Power BI yet. The charts on this
            page are a web version built from the same outputs.
          </p>
        </Block>

        <Block id="next" index="09" title="Next steps">
          <NextSteps steps={summary.next_steps} />
        </Block>

        <Block id="caveats" index="10" title="Caveats">
          <ul className="space-y-3">
            {[
              "This is observational data. Every link between lateness and reviews is an association. There is no carrier, shipping-method or promotion field to control for.",
              "Many reviews on late orders were written before the parcel arrived (finding 5), so those scores mix waiting with the product itself.",
              "Routes use the order's main seller. A small share of orders have more than one seller.",
              "The last purchase months are cut off by the end of the data, which can make them look faster than they were.",
              "The reviews file is the dataset's earlier release (see Data and coverage). Review figures could shift slightly on the current Kaggle version.",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden className="mt-2.5 h-1 w-3 shrink-0 rounded-full bg-ink-3" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block id="code" index="11" title="Code and reproduction">
          <RepoLinks base={base} extra={[["Data-quality report", `https://github.com/Billal-Zughbi/data-analytics-portfolio/blob/main/${base}/docs/data-quality-report.md`]]} />
          <pre className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface-2 p-4 font-mono text-[13px] leading-relaxed text-ink-2">
{`cd ${base}
pip install -r requirements-dev.txt
# download the dataset from Kaggle into data/raw/ (see data/README.md)
PYTHONPATH=src python -m olist_delivery all   # check, build, validate, reconcile, export
python -m pytest`}
          </pre>
          <Link href="/#projects" className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
            Back to projects <ArrowRight className="h-4 w-4" />
          </Link>
        </Block>
      </CaseBody>
    </article>
  );
}

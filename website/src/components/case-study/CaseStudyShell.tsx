import Link from "next/link";
import type { Project } from "@/content/projects";
import { repoFileUrl, repoUrl } from "@/content/projects";
import type { CaseKpi, CaseSummary, Finding, QualityCheck, Reconciliation, Source } from "@/data/case-study";
import { Reveal } from "@/components/Reveal";
import { CheckIcon, CodeIcon, ExternalIcon, FlagIcon } from "@/components/icons";

/* Layout pieces shared by the public-data case studies. */

export function CaseHeader({ project, notice }: { project: Project; notice: React.ReactNode }) {
  return (
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
          <span>{notice}</span>
        </p>
      </div>
    </header>
  );
}

export function CaseBody({ toc, children }: { toc: { id: string; label: string }[]; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14">
      <nav aria-label="On this page" className="hidden lg:block">
        <ol className="sticky top-24 space-y-1 border-l border-line text-sm">
          {toc.map((t, i) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-ink-3 hover:border-accent hover:text-ink-1">
                <span className="mr-2 font-mono text-[0.6875rem]">{String(i + 1).padStart(2, "0")}</span>
                {t.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Block({ id, index, title, children }: { id: string; index: string; title: string; children: React.ReactNode }) {
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

export function KpiGrid({ kpis }: { kpis: CaseKpi[] }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
      {kpis.map((k) => (
        <div key={k.key} className="bg-surface-1 p-5">
          <dt className="text-sm text-ink-3">{k.label}</dt>
          <dd className="mt-1">
            <span className="text-3xl font-semibold tracking-tight text-ink-1 tabular-nums">{k.display}</span>
            <p className="mt-2 text-xs leading-relaxed text-ink-3">{k.definition}</p>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function FindingList({ findings }: { findings: Finding[] }) {
  return (
    <ol className="space-y-4">
      {findings.map((f, i) => (
        <li key={f.id} className="rounded-[var(--radius-md)] border border-line bg-surface-1 p-5 sm:p-6">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-accent">Finding {i + 1}</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-ink-1">{f.title}</h3>
          <p className="mt-2 text-[0.9375rem] leading-relaxed">{f.summary}</p>
          <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-3">How it is measured</dt>
              <dd className="mt-1 text-ink-2">{f.metric}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-3">Caveat</dt>
              <dd className="mt-1 text-ink-2">{f.caveat}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}

function ResultIcon({ result }: { result: string }) {
  if (result === "pass") return <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-good" />;
  if (result === "warn" || result === "fail") return <FlagIcon className="mt-1 h-4 w-4 shrink-0 text-warn" />;
  return <span aria-hidden className="mt-2 ml-1 mr-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" />;
}

export function QualityTable({ checks }: { checks: QualityCheck[] }) {
  return (
    <ul
      className={`grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line ${checks.length > 1 ? "sm:grid-cols-2" : ""}`}
    >
      {checks.map((c) => (
        <li key={c.name} className="flex gap-3 bg-surface-1 p-4">
          <ResultIcon result={c.result} />
          <div>
            <p className="font-mono text-[0.8125rem] text-ink-1 [overflow-wrap:anywhere]">
              {c.name} <span className="text-xs text-ink-3">· {c.result}</span>
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{c.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const fmt = (v: number | string | null) =>
  v === null ? "–" : typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 4 }) : v;

/** Pass count up front, then the issues worth reading, then every check on request. */
export function QualitySummary({ checks }: { checks: QualityCheck[] }) {
  const passed = checks.filter((c) => c.result === "pass").length;
  const failed = checks.filter((c) => c.result === "fail").length;
  const rest = checks.length - passed;
  const notable = checks.filter((c) => c.result === "warn" || c.result === "fail" || c.result === "info");
  return (
    <div className="space-y-4">
      <p>
        <strong>
          {passed} of {checks.length} checks passed
        </strong>
        {failed ? ` and ${failed} failed` : " and none failed"}.{" "}
        {rest === 1
          ? "The other one records a known issue in the source and how it is handled:"
          : `The other ${rest} record known issues in the source and how each is handled:`}
      </p>
      <QualityTable checks={notable} />
      <details className="rounded-[var(--radius-md)] border border-line bg-surface-1 p-4 text-sm">
        <summary className="cursor-pointer font-medium text-ink-1">All {checks.length} checks</summary>
        <div className="mt-4">
          <QualityTable checks={checks} />
        </div>
      </details>
    </div>
  );
}

export function ReconciliationTable({ rows }: { rows: Reconciliation[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line">
      <table className="w-full min-w-[32.5rem] text-left text-sm">
        <caption className="sr-only">Headline metrics computed independently in SQL and in Python</caption>
        <thead className="bg-surface-2 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-3">
          <tr>
            <th scope="col" className="px-4 py-3">Metric</th>
            <th scope="col" className="px-4 py-3 text-right">SQL (DuckDB)</th>
            <th scope="col" className="px-4 py-3 text-right">Python (pandas)</th>
            <th scope="col" className="px-4 py-3">Match</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.metric} className="border-t border-line">
              <td className="px-4 py-2 text-ink-1">{r.metric}</td>
              <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">{fmt(r.sql)}</td>
              <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">{fmt(r.python)}</td>
              <td className="px-4 py-2">
                {r.match ? (
                  <span className="inline-flex items-center gap-1.5 text-good">
                    <CheckIcon className="h-3.5 w-3.5" /> Yes
                  </span>
                ) : (
                  <span className="text-warn">No</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ACRONYMS: Record<string, string> = { kev: "KEV", cve: "CVE", cwe: "CWE", id: "ID", ids: "IDs" };
const rowLabel = (key: string) =>
  key
    .split("_")
    .map((w) => ACRONYMS[w] ?? w)
    .join(" ")
    .replace("post launch", "post-launch");

export function SourceList({ sources }: { sources: Source[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sources.map((s) => (
        <div key={s.name} className="min-w-0 rounded-[var(--radius-md)] border border-line bg-surface-1 p-5 text-sm">
          <p className="font-semibold text-ink-1">{s.name}</p>
          <p className="text-ink-3">{s.publisher}</p>
          <dl className="mt-4 space-y-2 [overflow-wrap:anywhere]">
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-3">License</dt>
              <dd>{s.license}</dd>
            </div>
            {s.coverage && (
              <div className="flex gap-3">
                <dt className="w-24 shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-3">Coverage</dt>
                <dd>
                  {s.coverage.start} to {s.coverage.end}
                </dd>
              </div>
            )}
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-3">Retrieved</dt>
              <dd>{s.retrieved.slice(0, 10)}</dd>
            </div>
            {s.rows && (
              <div className="flex gap-3">
                <dt className="w-24 shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-3">Rows</dt>
                <dd className="font-mono text-xs leading-relaxed">
                  {Object.entries(s.rows)
                    .map(([k, v]) => `${rowLabel(k)} ${v.toLocaleString("en-US")}`)
                    .join(" · ")}
                </dd>
              </div>
            )}
          </dl>
          <a href={s.url} className="mt-4 inline-flex items-center gap-1.5 text-accent underline-offset-4 hover:underline">
            Source <ExternalIcon className="h-3.5 w-3.5" />
          </a>
        </div>
      ))}
    </div>
  );
}

export function RepoLinks({ base, extra = [] }: { base: string; extra?: [string, string][] }) {
  const links: [string, string][] = [
    ["Project folder and README", repoUrl(base)],
    ["SQL (DuckDB)", repoUrl(`${base}/sql`)],
    ["Python package", repoUrl(`${base}/src`)],
    ["Exploratory notebook", repoFileUrl(`${base}/notebooks/exploratory_analysis.ipynb`)],
    ["Tests", repoUrl(`${base}/tests`)],
    ["Power BI model, DAX and report spec", repoUrl(`${base}/powerbi`)],
    ["Findings write-up", repoFileUrl(`${base}/docs/findings.md`)],
    ["Methodology", repoFileUrl(`${base}/docs/methodology.md`)],
    ...extra,
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {links.map(([label, href]) => (
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
  );
}

export function NextSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={s} className="flex gap-4">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[0.6875rem] text-accent">
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export type { CaseSummary };

"use client";

import { useId, useState } from "react";

export type LegendItem = { label: string; color: string; dashed?: boolean; shape?: "line" | "box" };
export type TableSpec = { caption: string; columns: string[]; rows: (string | number)[][]; align?: ("left" | "right")[] };

/**
 * Frame shared by every case-study chart: title, optional controls, legend,
 * chart, a "View as table" toggle and a source note. The table carries the
 * same numbers as the chart so nothing depends on colour or hover.
 */
export function ChartFrame({
  title,
  subtitle,
  controls,
  legend,
  table,
  note,
  height = 300,
  children,
}: {
  title: string;
  subtitle?: string;
  controls?: React.ReactNode;
  legend?: LegendItem[];
  table: TableSpec;
  note?: React.ReactNode;
  height?: number;
  children: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  return (
    <figure className="rounded-[var(--radius-lg)] border border-line bg-surface-1 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <figcaption>
          <p className="text-lg font-semibold tracking-tight text-ink-1">{title}</p>
          {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
        </figcaption>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          aria-controls={`${id}-table`}
          className="rounded-full border border-line-strong px-3 py-1 font-mono text-[0.6875rem] text-ink-2 transition-colors hover:border-accent hover:text-ink-1"
        >
          {showTable ? "View as chart" : "View as table"}
        </button>
      </div>
      {controls && <div className="mt-4">{controls}</div>}
      {legend && legend.length > 0 && !showTable && (
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2" aria-label="Legend">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-2">
              <svg width="22" height="10" aria-hidden>
                {l.shape === "box" ? (
                  <rect x="4" y="0" width="14" height="10" rx="2" fill={l.color} />
                ) : (
                  <line x1="0" x2="22" y1="5" y2="5" stroke={l.color} strokeWidth="2" strokeDasharray={l.dashed ? "4 3" : undefined} />
                )}
              </svg>
              {l.label}
            </li>
          ))}
        </ul>
      )}
      {showTable ? (
        <DataTable id={`${id}-table`} table={table} />
      ) : (
        <>
          <div className="mt-4 hidden [.js_&]:block" style={{ height: `${height / 16}rem` }}>
            {children}
          </div>
          {/* Charts draw in the browser; without JavaScript the same numbers show as a table. */}
          <noscript>
            <DataTable table={table} />
          </noscript>
        </>
      )}
      {note && <p className="mt-3 text-xs leading-relaxed text-ink-3">{note}</p>}
    </figure>
  );
}

function DataTable({ id, table }: { id?: string; table: TableSpec }) {
  return (
    <div id={id} className="mt-4 max-h-[26.25rem] overflow-auto rounded-[var(--radius-md)] border border-line">
      <table className="w-full min-w-[26.25rem] text-left text-sm">
        <caption className="sr-only">{table.caption}</caption>
        <thead className="sticky top-0 bg-surface-2 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-3">
          <tr>
            {table.columns.map((c, i) => (
              <th key={c} scope="col" className={`px-3 py-2.5 ${table.align?.[i] === "right" ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, ri) => (
            <tr key={ri} className="border-t border-line">
              {r.map((v, i) => (
                <td key={i} className={`px-3 py-2 tabular-nums ${table.align?.[i] === "right" ? "text-right" : "text-ink-1"}`}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tooltip box used by every chart. */
export function TipBox({ title, lines }: { title: string; lines: (string | null)[] }) {
  return (
    <div className="rounded-md border border-line-strong bg-surface-3 px-3 py-2 text-sm shadow-xl">
      <p className="font-mono text-[0.6875rem] text-ink-3">{title}</p>
      {lines.filter(Boolean).map((l) => (
        <p key={l} className="mt-0.5 text-ink-1">
          {l}
        </p>
      ))}
    </div>
  );
}

/** Pill buttons for switching a chart's view. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            o.value === value ? "bg-surface-3 text-ink-1 shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-ink-3 hover:text-ink-1"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const pct = (x: number | null | undefined, d = 1) => (x === null || x === undefined ? "–" : `${(x * 100).toFixed(d)}%`);
export const num = (x: number | null | undefined, d = 0) =>
  x === null || x === undefined ? "–" : x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
/** Axis tick: plain 0, full numbers below 10,000 (1,050 rather than 1.1k), "12k" above. */
export const axisNum = (v: number) =>
  v === 0 ? "0" : Math.abs(v) >= 10_000 ? `${+(v / 1000).toFixed(1)}k` : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
/** "2024-05" → "May 2024". */
export const monthLabel = (ym: string) =>
  new Date(`${ym.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
/** Negative numbers with a typographic minus sign. */
export const signed = (x: number) => String(x).replace("-", "\u2212");
export const axisProps = {
  tickLine: false,
  tick: { fill: "var(--ink-3)", fontSize: 11 },
} as const;

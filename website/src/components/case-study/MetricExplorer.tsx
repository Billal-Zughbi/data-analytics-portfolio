"use client";

import { useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Kpi, MetricGroup, MetricMeta, SeriesRow } from "@/data/apple-health";

const GROUPS: { key: MetricGroup; label: string; page: string }[] = [
  { key: "activity", label: "Energy & activity", page: "Energy and Activity" },
  { key: "cardio", label: "Cardiovascular", page: "Cardiovascular" },
  { key: "mobility", label: "Mobility", page: "Mobility and Movement" },
  { key: "environment", label: "Environment", page: "Physical and Environmental" },
];

const UNIT_LABEL: Record<string, string> = {
  "count/min": "bpm",
  count: "",
  dBASPL: "dBA",
  "mi/hr": "mph",
};

const RULE_LABEL: Record<MetricMeta["aggregation"], string> = {
  sum: "daily total, then averaged per week",
  mean: "daily mean, then averaged per week",
  energy_mean: "energy (logarithmic) average",
  last: "latest estimate in the week",
  stood_hours: "distinct stood hours per day",
};

const fmt = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "–" : v.toLocaleString("en-US", { maximumFractionDigits: digits });

const monthTick = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleString("en-US", { month: "short" });

type Props = {
  metrics: MetricMeta[];
  kpis: Kpi[];
  rows: SeriesRow[];
};

export function MetricExplorer({ metrics, kpis, rows }: Props) {
  const [group, setGroup] = useState<MetricGroup>("activity");
  const groupMetrics = useMemo(() => metrics.filter((m) => m.group === group), [metrics, group]);
  const [selected, setSelected] = useState<Record<MetricGroup, string>>({
    activity: "active_energy_kcal",
    cardio: "resting_hr_bpm",
    mobility: "steps",
    environment: "env_audio_dba",
  });
  const [showTable, setShowTable] = useState(false);
  const tabsId = useId();

  const metricKey = selected[group];
  const metric = metrics.find((m) => m.key === metricKey) ?? groupMetrics[0];
  const unit = UNIT_LABEL[metric.unit] ?? metric.unit;
  // Partial weeks at the edges of the year (fewer than 4 days) are left out.
  const data = rows
    .filter((r) => typeof r.days === "number" && r.days >= 4)
    .map((r) => ({ week: r.week as string, value: (r[metric.key] as number | null) ?? null }))
    .filter((r) => r.value !== null);
  const values = data.map((d) => d.value as number);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.15 || 1;
  const domain: [number, number] = [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)];
  const groupKpis = kpis.filter((k) => k.group === group);
  const groupLabel = GROUPS.find((g) => g.key === group)!;

  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface-1">
      {/* Filters: one row above the chart */}
      <div className="flex flex-col gap-4 border-b border-line p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="Report page" className="flex flex-wrap gap-1 rounded-full bg-surface-2 p-1">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              role="tab"
              id={`${tabsId}-${g.key}`}
              aria-selected={group === g.key}
              aria-controls={`${tabsId}-panel`}
              onClick={() => setGroup(g.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                group === g.key ? "bg-surface-3 text-ink-1 shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-ink-3 hover:text-ink-1"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <span className="rounded-full border border-warn/40 px-3 py-1 font-mono text-[11px] text-warn">
          Synthetic demonstration data
        </span>
      </div>

      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${group}`} className="p-4 sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
          Mirrors the original report page “{groupLabel.page}”
        </p>

        {/* KPI tiles */}
        <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line">
          {groupKpis.map((k) => (
            <div key={k.key} className="bg-surface-1 p-4">
              <dt className="text-sm text-ink-3">{k.label}</dt>
              <dd className="mt-1">
                <span className="text-2xl font-semibold tracking-tight">{fmt(k.value, k.value !== null && Math.abs(k.value) >= 100 ? 0 : 1)}</span>
                <span className="ml-1 text-sm text-ink-3">{UNIT_LABEL[k.unit] ?? k.unit}</span>
                <p className="mt-2 text-xs leading-relaxed text-ink-3">{k.definition}</p>
              </dd>
            </div>
          ))}
        </dl>

        {/* Metric picker */}
        <div className="mt-8 flex flex-wrap items-center gap-2" role="group" aria-label="Metric">
          {groupMetrics.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={m.key === metric.key}
              onClick={() => setSelected((s) => ({ ...s, [group]: m.key }))}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                m.key === metric.key ? "border-accent/60 bg-accent-soft text-ink-1" : "border-line text-ink-2 hover:border-line-strong"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-lg font-semibold tracking-tight">
            {metric.label}
            {unit && <span className="font-normal text-ink-3"> ({unit})</span>}
          </h4>
          <p className="text-sm text-ink-3">Weekly · {RULE_LABEL[metric.aggregation]}</p>
        </div>

        <div className="mt-4 h-[280px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="explorer-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey="week"
                tickFormatter={monthTick}
                interval={Math.max(0, Math.floor(data.length / 12) - 1)}
                minTickGap={16}
                tickLine={false}
                axisLine={{ stroke: "var(--line-strong)" }}
              />
              <YAxis
                domain={domain}
                width={48}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString("en-US", { notation: v >= 10000 ? "compact" : "standard" })}
              />
              <Tooltip
                cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as { week: string; value: number };
                  return (
                    <div className="rounded-md border border-line-strong bg-surface-3 px-3 py-2 text-sm shadow-xl">
                      <p className="font-mono text-[11px] text-ink-3">Week of {p.week}</p>
                      <p className="mt-0.5 font-semibold text-ink-1">
                        {fmt(p.value, p.value >= 100 ? 0 : 2)} {unit}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--series-1)"
                strokeWidth={2}
                fill="url(#explorer-fill)"
                activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2, fill: "var(--series-1)" }}
                isAnimationActive={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-3">
            Source: generated weekly.json from the synthetic export. Companion web view, not the native Power BI report.
          </p>
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-expanded={showTable}
            className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-2 hover:border-line-strong"
          >
            {showTable ? "Hide" : "Show"} data table
          </button>
        </div>
        {showTable && (
          <div className="mt-4 max-h-72 overflow-auto rounded-md border border-line">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Weekly {metric.label} ({unit}), synthetic data
              </caption>
              <thead className="sticky top-0 bg-surface-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
                <tr>
                  <th scope="col" className="px-3 py-2">Week of</th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {metric.label} {unit && `(${unit})`}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.week} className="border-t border-line">
                    <td className="px-3 py-1.5 font-mono text-xs text-ink-2">{d.week}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(d.value, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

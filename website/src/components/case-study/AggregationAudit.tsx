"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Summary } from "@/data/apple-health";

type Audit = Summary["aggregation_audit"];

const dayTick = (iso: string) => String(Number(iso.slice(8, 10)));

type LabelProps = { x?: number | string; y?: number | string; index?: number };

/** Direct label at the end of a line only (selective labelling, not every point). */
const endLabel = (text: string, lastIndex: number) =>
  function EndLabel(props: LabelProps) {
    if (props.index !== lastIndex) return <g />;
    return (
      <text x={Number(props.x ?? 0) + 8} y={Number(props.y ?? 0) + 4} fill="var(--ink-2)" fontSize={11}>
        {text}
      </text>
    );
  };

export function AggregationAudit({ audit }: { audit: Audit }) {
  const data = audit.resting_hr.march_comparison;
  const last = data[data.length - 1];

  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface-1 p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-lg font-semibold tracking-tight">Resting heart rate, March: implicit Sum vs daily mean (bpm)</h4>
        <span className="rounded-full border border-warn/40 px-3 py-1 font-mono text-[0.6875rem] text-warn">Synthetic data</span>
      </div>

      {/* Legend: always present for two series, plus direct labels on the lines */}
      <ul className="mt-4 flex flex-wrap gap-5 text-sm text-ink-2" aria-label="Legend">
        <li className="flex items-center gap-2">
          <svg width="22" height="8" aria-hidden>
            <line x1="0" x2="22" y1="4" y2="4" stroke="var(--series-2)" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          Implicit <code className="font-mono text-[0.75rem]">Sum</code> on a date axis (original visual)
        </li>
        <li className="flex items-center gap-2">
          <svg width="22" height="8" aria-hidden>
            <line x1="0" x2="22" y1="4" y2="4" stroke="var(--series-1)" strokeWidth="2" />
          </svg>
          Daily mean (rebuilt rule)
        </li>
      </ul>

      <div className="mt-4 h-[16.25rem]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 72, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={dayTick} tickLine={false} axisLine={{ stroke: "var(--line-strong)" }} minTickGap={8} />
            <YAxis width={40} tickLine={false} axisLine={false} domain={[40, "auto"]} />
            <Tooltip
              cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Audit["resting_hr"]["march_comparison"][number];
                return (
                  <div className="rounded-md border border-line-strong bg-surface-3 px-3 py-2 text-sm shadow-xl">
                    <p className="font-mono text-[0.6875rem] text-ink-3">{p.date}</p>
                    <p className="mt-1 text-ink-1">Implicit Sum: {p.implicit_sum} bpm</p>
                    <p className="text-ink-1">Daily mean: {p.daily_mean} bpm</p>
                  </div>
                );
              }}
            />
            <Line
              type="linear"
              dataKey="implicit_sum"
              stroke="var(--series-2)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }}
              isAnimationActive={false}
              label={endLabel("Sum", data.length - 1)}
            />
            <Line
              type="linear"
              dataKey="daily_mean"
              stroke="var(--series-1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }}
              isAnimationActive={false}
              label={endLabel(`Mean ${last?.daily_mean ?? ""}`, data.length - 1)}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        On days where the watch wrote two resting estimates, a summed visual doubles the value
        ({audit.resting_hr.days_with_multiple_estimates} of {audit.resting_hr.days} synthetic days; peak{" "}
        {audit.resting_hr.max_implicit_sum} bpm “resting”). The daily mean never exceeds {audit.resting_hr.max_daily_mean} bpm.
      </p>
    </div>
  );
}

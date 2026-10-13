"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { summary } from "@/data/apple-health";
import { usePrefersReducedMotion } from "./motion";
import { ChartFrame, Segmented, TipBox, axisProps, num, pct } from "../ChartFrame";

const S1 = "var(--series-1)";
const S2 = "var(--series-2)";
const S3 = "var(--series-3)";

/* ---------------- Seven years, year by year ---------------- */

type YearMetric = "steps_mean" | "exercise_mean" | "resting_hr" | "goal_share";
const YEAR_METRICS: Record<YearMetric, { label: string; unit: string; digits: number; fmt?: (v: number) => string }> = {
  steps_mean: { label: "Average daily steps", unit: "steps", digits: 0 },
  exercise_mean: { label: "Average daily exercise", unit: "min", digits: 0 },
  resting_hr: { label: "Average resting heart rate", unit: "bpm", digits: 1 },
  goal_share: { label: "Days at 10,000 steps or more", unit: "", digits: 0, fmt: (v) => pct(v, 0) },
};

export function YearlyChart() {
  const [metric, setMetric] = useState<YearMetric>("steps_mean");
  const m = YEAR_METRICS[metric];
  const rows = summary.yearly.filter((y) => y.step_days > 0);
  const watchMetric = metric === "exercise_mean" || metric === "resting_hr";
  const show = (v: number | null) => (v === null ? "–" : m.fmt ? m.fmt(v) : num(v, m.digits));
  const thin = (y: (typeof rows)[number]) => (watchMetric ? y.watch_days < 180 : y.step_days < 180);
  return (
    <ChartFrame
      title={`${rows.length} years, one bar each`}
      subtitle={`${m.label} per year. Under each year is how many days the watch was worn, or "phone" for the years before it.`}
      controls={
        <Segmented
          label="Metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "steps_mean", label: "Steps" },
            { value: "exercise_mean", label: "Exercise" },
            { value: "resting_hr", label: "Resting heart rate" },
            { value: "goal_share", label: "10k-step days" },
          ]}
        />
      }
      table={{
        caption: "Yearly summary",
        columns: ["Year", "Step days", "Watch days", "Avg steps", "Avg exercise (min)", "Resting HR (bpm)", "10k-step days"],
        rows: rows.map((y) => [y.year, y.step_days, y.watch_days, num(y.steps_mean), num(y.exercise_mean), num(y.resting_hr, 1), pct(y.goal_share, 0)]),
        align: ["left", "right", "right", "right", "right", "right", "right"],
      }}
      note={
        watchMetric
          ? "Exercise and heart rate need the watch, so the phone-only years are empty. 2021 and 2022 have few watch days and are drawn lighter."
          : "Steps before April 2018 come from the phone alone, which only counts steps while it is in a pocket. Years with under 180 days of data are drawn lighter."
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 24, right: 8, bottom: 8, left: -4 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="year"
            {...axisProps}
            interval={0}
            height={36}
            tick={(raw: unknown) => {
              const props = raw as { x: number; y: number; payload: { value: number } };
              const y = rows.find((r) => r.year === props.payload.value)!;
              return (
                <g transform={`translate(${props.x},${props.y + 10})`}>
                  <text textAnchor="middle" className="fill-[var(--ink-2)] font-mono text-[0.625rem]">
                    {`'${String(props.payload.value).slice(2)}`}
                  </text>
                  <text y={14} textAnchor="middle" className="fill-[var(--ink-3)] font-mono text-[0.5rem]">
                    {y.watch_days ? `${y.watch_days}d` : "phone"}
                  </text>
                </g>
              );
            }}
          />
          <YAxis {...axisProps} width={44} tickFormatter={(v: number) => (metric === "goal_share" ? pct(v, 0) : v >= 1000 ? `${v / 1000}k` : String(v))} domain={metric === "resting_hr" ? [50, "auto"] : [0, "auto"]} />
          <Tooltip
            cursor={{ fill: "var(--line)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox
                  title={String(payload[0].payload.year)}
                  lines={[
                    `${m.label}: ${show(payload[0].value === null ? null : Number(payload[0].value))} ${m.unit}`,
                    payload[0].payload.watch_days ? `${payload[0].payload.watch_days} days with watch data` : `${payload[0].payload.step_days} days of phone steps`,
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey={metric} radius={[4, 4, 0, 0]} maxBarSize={48} animationDuration={800}>
            {rows.map((y) => (
              <Cell key={y.year} fill={S1} fillOpacity={thin(y) ? 0.35 : 0.95} />
            ))}
            <LabelList dataKey={metric} position="top" formatter={(v: unknown) => (typeof v === "number" ? (metric === "steps_mean" ? `${(v / 1000).toFixed(1)}k` : show(v)) : "")} className="fill-[var(--ink-2)] font-mono text-[0.5625rem]" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ---------------- Weekly and yearly rhythm ---------------- */

export function RhythmCharts() {
  const [view, setView] = useState<"weekday" | "month">("weekday");
  const rows: { name: string; steps_mean: number; steps_days: number; exercise_mean: number }[] =
    view === "weekday" ? summary.weekday.map((r) => ({ ...r, name: r.day })) : summary.months.map((r) => ({ ...r, name: r.month }));
  const max = Math.max(...rows.map((r) => r.steps_mean));
  const min = Math.min(...rows.map((r) => r.steps_mean));
  return (
    <ChartFrame
      title={view === "weekday" ? "Which days are the busiest" : "Which months are the busiest"}
      subtitle={`Average steps per day since the watch arrived in ${summary.source.watch_start.slice(0, 4)}. The highest and lowest bars are highlighted.`}
      controls={
        <Segmented
          label="Group by"
          value={view}
          onChange={setView}
          options={[
            { value: "weekday", label: "Day of week" },
            { value: "month", label: "Month" },
          ]}
        />
      }
      table={{
        caption: "Average steps and exercise",
        columns: [view === "weekday" ? "Day" : "Month", "Avg steps", "Avg exercise (min)", "Days"],
        rows: rows.map((r) => [r.name, num(r.steps_mean), num(r.exercise_mean, 1), r.steps_days]),
        align: ["left", "right", "right", "right"],
      }}
      height={260}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 24, right: 8, bottom: 0, left: -4 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="name" {...axisProps} interval={0} />
          <YAxis {...axisProps} width={44} tickFormatter={(v: number) => `${v / 1000}k`} />
          <Tooltip
            cursor={{ fill: "var(--line)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox title={String(payload[0].payload.name)} lines={[`${num(Number(payload[0].value))} steps on average`, `${num(payload[0].payload.exercise_mean, 1)} exercise minutes`]} />
              ) : null
            }
          />
          <Bar dataKey="steps_mean" radius={[4, 4, 0, 0]} maxBarSize={44} animationDuration={700}>
            {rows.map((r) => (
              <Cell key={r.name} fill={r.steps_mean === max ? S2 : r.steps_mean === min ? S3 : S1} fillOpacity={r.steps_mean === max || r.steps_mean === min ? 1 : 0.55} />
            ))}
            <LabelList dataKey="steps_mean" position="top" formatter={(v: unknown) => num(Number(v))} className="fill-[var(--ink-3)] font-mono text-[0.5625rem]" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ---------------- Distribution of daily steps ---------------- */

export function StepsHistogram() {
  const rows = summary.histogram.map((h) => ({ ...h, name: h.to ? `${h.from / 1000}k` : `${h.from / 1000}k+`, goal: h.from >= 10000 }));
  const total = rows.reduce((a, r) => a + r.days, 0);
  return (
    <ChartFrame
      title="How many steps a typical day has"
      subtitle={`${num(total)} days, in bins of 1,000 steps. Bars at 10,000 and above are highlighted.`}
      table={{
        caption: "Days per step bin",
        columns: ["Steps", "Days", "Share"],
        rows: rows.map((r) => [r.to ? `${num(r.from)} to ${num(r.to - 1)}` : `${num(r.from)} or more`, r.days, pct(r.days / total)]),
        align: ["left", "right", "right"],
      }}
      note={`Median day: ${num(summary.headline.steps_median)} steps. ${pct(summary.headline.goal_share, 0)} of days reached 10,000.`}
      height={260}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={2}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="name" {...axisProps} interval={1} />
          <YAxis {...axisProps} width={40} />
          <Tooltip
            cursor={{ fill: "var(--line)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox
                  title={payload[0].payload.to ? `${num(payload[0].payload.from)} to ${num(payload[0].payload.to - 1)} steps` : `${num(payload[0].payload.from)}+ steps`}
                  lines={[`${payload[0].value} days (${pct(Number(payload[0].value) / total)})`]}
                />
              ) : null
            }
          />
          <Bar dataKey="days" radius={[3, 3, 0, 0]} animationDuration={700}>
            {rows.map((r) => (
              <Cell key={r.name} fill={r.goal ? S2 : S1} fillOpacity={r.goal ? 1 : 0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ---------------- Distance double-count check ---------------- */

export function DistanceCheck() {
  const { original: o, rebuilt: r } = summary.distance_check;
  const byMonth = new Map<string, { month: string; date: string; original?: number; rebuilt?: number }>();
  for (const [key, d] of [["original", o], ["rebuilt", r]] as const)
    for (const m of d.monthly) {
      const row = byMonth.get(m.month) ?? { month: m.month, date: `${m.month}-01` };
      row[key] = m.mi_per_1000;
      byMonth.set(m.month, row);
    }
  const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  return (
    <ChartFrame
      title="Miles recorded per 1,000 steps"
      subtitle={`Monthly median. The dashed line is what ${r.median_step_length_in}-inch steps cover: ${r.expected_mi_per_1000} miles per 1,000 steps.`}
      legend={[
        { label: "Original report", color: S2 },
        { label: "Rebuilt from the export", color: S1 },
        { label: "Expected from step length", color: "var(--ink-2)", dashed: true },
      ]}
      table={{
        caption: "Miles per 1,000 steps by month",
        columns: ["Month", "Original report", "Rebuilt"],
        rows: rows.map((m) => [m.month, num(m.original ?? null, 3), num(m.rebuilt ?? null, 3)]),
        align: ["left", "right", "right"],
      }}
      note={`The original report filtered steps to the watch but kept every device's distance, so walks the phone and watch both recorded counted twice: ${o.recorded_mi_per_1000} miles per 1,000 steps, ${o.ratio_to_expected}× what the stride allows. Keeping one device per hour brings it to ${r.recorded_mi_per_1000} (${r.ratio_to_expected}×).`}
      height={280}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={(v: string) => v.slice(0, 4)} minTickGap={40} />
          <YAxis {...axisProps} width={44} domain={[0, 1.2]} tickFormatter={(v: number) => v.toFixed(1)} />
          <ReferenceLine y={r.expected_mi_per_1000} stroke="var(--ink-2)" strokeDasharray="5 4" />
          <ReferenceLine y={r.expected_mi_per_1000 * 2} stroke="var(--line-strong)" strokeDasharray="2 4" label={{ value: "2×", position: "insideRight", fill: "var(--ink-3)", fontSize: 10 }} />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox
                  title={String(payload[0].payload.month)}
                  lines={[
                    `Original: ${payload[0].payload.original === undefined ? "–" : num(payload[0].payload.original, 3)} mi per 1,000`,
                    `Rebuilt: ${payload[0].payload.rebuilt === undefined ? "–" : num(payload[0].payload.rebuilt, 3)} mi per 1,000`,
                  ]}
                />
              ) : null
            }
          />
          <Line dataKey="rebuilt" stroke={S1} strokeWidth={2} dot={false} connectNulls={false} animationDuration={900} />
          <Line dataKey="original" stroke={S2} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: S2 }} connectNulls={false} animationDuration={900} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ---------------- Exercise against resting heart rate ---------------- */

export function FitnessScatter() {
  const f = summary.fitness;
  const early = f.monthly.filter((m) => m.month < "2023");
  const later = f.monthly.filter((m) => m.month >= "2023");
  const span = (rows: typeof early) => `${rows[0]?.month.slice(0, 4)} to ${rows.at(-1)?.month.slice(0, 4)}`;
  return (
    <ChartFrame
      title="Months with more exercise had a lower resting heart rate"
      subtitle={`Each dot is one month with at least 15 days of data (${f.months} months). r = ${f.r_exercise_resting_hr}.`}
      legend={[
        { label: span(early), color: S1, shape: "box" },
        { label: span(later), color: S2, shape: "box" },
      ]}
      table={{
        caption: "Monthly exercise and resting heart rate",
        columns: ["Month", "Exercise (min/day)", "Resting HR (bpm)", "HRV (ms)"],
        rows: f.monthly.map((m) => [m.month, num(m.exercise_min, 1), num(m.resting_hr, 1), num(m.hrv, 1)]),
        align: ["left", "right", "right", "right"],
      }}
      note={`Same watch before and after the change in routine: ${f.same_watch.before.resting_hr} bpm in ${f.same_watch.before.label}, ${f.same_watch.after.resting_hr} bpm in ${f.same_watch.after.label}. A correlation, not proof of cause.`}
      height={300}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 28, bottom: 12, left: -4 }}>
          <CartesianGrid stroke="var(--grid)" />
          <XAxis type="number" dataKey="exercise_min" name="Exercise" unit=" min" {...axisProps} domain={[0, "auto"]} label={{ value: "Exercise minutes per day", position: "insideBottom", offset: -6, fill: "var(--ink-3)", fontSize: 11 }} />
          <YAxis type="number" dataKey="resting_hr" name="Resting HR" {...axisProps} width={44} domain={["auto", "auto"]} />
          <ZAxis range={[46, 46]} />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox title={String(payload[0].payload.month)} lines={[`${num(payload[0].payload.exercise_min, 1)} exercise min/day`, `${num(payload[0].payload.resting_hr, 1)} bpm resting`]} />
              ) : null
            }
          />
          <Scatter data={early} fill={S1} fillOpacity={0.85} stroke="var(--surface-1)" strokeWidth={2} animationDuration={900} />
          <Scatter data={later} fill={S2} fillOpacity={0.9} stroke="var(--surface-1)" strokeWidth={2} animationDuration={900} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ---------------- Personal records ---------------- */

function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

function Ticker({ value, run }: { value: number; run: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run || reduced) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 1200);
      setV(value * (1 - Math.pow(1 - k, 4)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, value, reduced]);
  return (
    <>
      <span aria-hidden>{Math.round(!run || reduced ? value : v).toLocaleString("en-US")}</span>
      <span className="sr-only">{value.toLocaleString("en-US")}</span>
    </>
  );
}

export function Records() {
  const [ref, seen] = useSeen<HTMLUListElement>();
  const when = (d: string | null, key: string) => {
    if (!d) return "";
    const t = new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    return key.endsWith("streak") ? `ended ${t}` : key === "steps_week" ? `week of ${t}` : t;
  };
  return (
    <ul ref={ref} className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      {summary.records.map((r) => (
        <li key={r.key} className="bg-surface-1 p-5">
          <p className="text-xs text-ink-3">{r.label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-1 tabular-nums">
            <Ticker value={r.value} run={seen} />
            <span className="ml-1 text-xs font-normal text-ink-3">{r.unit}</span>
          </p>
          <p className="mt-1 font-mono text-[0.6875rem] text-ink-3">{when(r.date, r.key)}</p>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Workouts ---------------- */

export function WorkoutsChart() {
  const w = summary.workouts;
  const [view, setView] = useState<"year" | "activity">("year");
  const others = w.groups.filter((g) => g !== "Strength training");
  const years = w.by_year.map((y) => {
    const strength = y["Strength training"] ?? 0;
    const rest = others.reduce((a, g) => a + (y[g] ?? 0), 0);
    return { year: String(y.year), strength, rest, total: strength + rest, hours: y.hours };
  });
  const acts = w.by_activity.slice(0, 8);
  const early = summary.yearly.filter((y) => y.year < 2023 && y.exercise_mean !== null).sort((a, b) => (b.exercise_mean ?? 0) - (a.exercise_mean ?? 0))[0];
  return (
    <ChartFrame
      title={view === "year" ? "Workouts logged per year" : "Hours by workout type"}
      subtitle={
        view === "year"
          ? `${num(w.total)} workouts and ${num(w.hours)} hours since ${w.first_month.slice(0, 4)}. Strength training is split out from everything else.`
          : `The eight workout types with the most sessions, by total hours.`
      }
      controls={
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "year", label: "By year" },
            { value: "activity", label: "By type" },
          ]}
        />
      }
      legend={view === "year" ? [
        { label: "Strength training", color: S1, shape: "box" },
        { label: "Everything else", color: S3, shape: "box" },
      ] : undefined}
      table={
        view === "year"
          ? {
              caption: "Workouts per year",
              columns: ["Year", "Strength training", "Other workouts", "Total", "Hours"],
              rows: years.map((y) => [y.year, y.strength, y.rest, y.total, num(y.hours)]),
              align: ["left", "right", "right", "right", "right"],
            }
          : {
              caption: "Workouts by type",
              columns: ["Type", "Sessions", "Hours", "Avg minutes", "Active kcal", "Miles"],
              rows: w.by_activity.map((a) => [a.activity, a.workouts, num(a.hours, 1), num(a.avg_minutes), num(a.active_kcal), a.distance_mi ? num(a.distance_mi, 1) : "–"]),
              align: ["left", "right", "right", "right", "right", "right"],
            }
      }
      note={
        view === "year"
          ? `Before 2023 almost no workouts were logged, even in ${early.year} when the watch counted ${num(early.exercise_mean)} exercise minutes a day, so part of the jump is simply starting to log them.`
          : undefined
      }
      height={280}
    >
      <ResponsiveContainer width="100%" height="100%">
        {view === "year" ? (
          <BarChart data={years} margin={{ top: 20, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="year" {...axisProps} interval={0} />
            <YAxis {...axisProps} width={40} />
            <Tooltip
              cursor={{ fill: "var(--line)" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TipBox
                    title={String(payload[0].payload.year)}
                    lines={[`${payload[0].payload.strength} strength sessions`, `${payload[0].payload.rest} other workouts`, `${num(payload[0].payload.hours)} hours in total`]}
                  />
                ) : null
              }
            />
            <Bar dataKey="strength" stackId="w" fill={S1} stroke="var(--surface-1)" strokeWidth={2} maxBarSize={48} animationDuration={800} />
            <Bar dataKey="rest" stackId="w" fill={S3} stroke="var(--surface-1)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={48} animationDuration={800}>
              <LabelList dataKey="total" position="top" className="fill-[var(--ink-2)] font-mono text-[0.625rem]" />
            </Bar>
          </BarChart>
        ) : (
          <BarChart data={acts} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--grid)" horizontal={false} />
            <XAxis type="number" {...axisProps} />
            <YAxis type="category" dataKey="activity" {...axisProps} width={112} interval={0} />
            <Tooltip
              cursor={{ fill: "var(--line)" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TipBox
                    title={String(payload[0].payload.activity)}
                    lines={[`${num(payload[0].payload.hours, 1)} hours over ${payload[0].payload.workouts} sessions`, `${num(payload[0].payload.avg_minutes)} minutes on average`]}
                  />
                ) : null
              }
            />
            <Bar dataKey="hours" fill={S1} radius={[0, 4, 4, 0]} maxBarSize={22} animationDuration={800}>
              <LabelList dataKey="hours" position="right" formatter={(v: unknown) => `${num(Number(v))} h`} className="fill-[var(--ink-2)] font-mono text-[0.625rem]" />
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ---------------- Original report against the rebuild ---------------- */

export function ComparisonTable() {
  const rows = summary.comparison;
  const max = Math.max(...rows.map((r) => Math.abs(r.change_pct)), 1);
  const fmt = (v: number, unit: string) => num(v, Math.abs(v) >= 100 ? 0 : 2) + (unit === "steps" ? "" : ` ${unit}`);
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface-1">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">Daily averages in the original report and in the rebuild, over the same days</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            <th scope="col" className="px-4 py-3 font-medium">Metric</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">Days</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">Original</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">Rebuilt</th>
            <th scope="col" className="px-4 py-3 font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const big = Math.abs(r.change_pct) >= 1;
            const w = (Math.abs(r.change_pct) / max) * 50;
            return (
              <tr key={r.metric} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-normal text-ink-1">{r.label}</th>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-ink-3 tabular-nums">{num(r.days)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-ink-2 tabular-nums">{fmt(r.original, r.unit)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-ink-1 tabular-nums">{fmt(r.rebuilt, r.unit)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 100 8" className="h-2 w-24 shrink-0" aria-hidden>
                      <line x1="50" x2="50" y1="0" y2="8" stroke="var(--line-strong)" strokeWidth="1" />
                      {big && <rect x={r.change_pct < 0 ? 50 - w : 50} y="1" width={w} height="6" rx="2" fill={r.change_pct < 0 ? S3 : S2} />}
                    </svg>
                    <span className={`font-mono text-xs tabular-nums ${big ? "text-ink-1" : "text-ink-3"}`}>
                      {big ? `${r.change_pct > 0 ? "+" : ""}${r.change_pct.toFixed(1)}%` : "same"}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

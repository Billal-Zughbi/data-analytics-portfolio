"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./motion";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  aggregate,
  bucketed,
  bucketFor,
  dayCount,
  firstDay,
  indexOf,
  isoOf,
  lastDay,
  series,
  summary,
  type Agg,
  type Card,
} from "@/data/apple-health";
import { TipBox, axisProps } from "../ChartFrame";

/* ---------------------------------------------------------------------------
   The four pages of the original Power BI report, rebuilt on the cleaned daily
   data. Same cards and charts, with the labels and units corrected, and a date
   filter that reaches every card.
   --------------------------------------------------------------------------- */

type CardSpec = { label: string; metric: string; agg: Agg; unit: string; digits?: number; scale?: number; original?: string };
type ChartSpec =
  | { kind: "line"; title: string; keys: { key: string; label: string; color: string }[]; unit: string; area?: boolean; trend?: boolean }
  | { kind: "bars"; title: string; key: string; label: string; unit: string; threshold?: number; thresholdLabel?: string }
  | { kind: "history"; title: string; key: string; label: string; unit: string }
  | { kind: "gauge"; title: string; key: string; label: string; unit: string; target: number };

type PageSpec = { id: string; name: string; short: string; window: { start: string; end: string }; cards: CardSpec[]; charts: ChartSpec[] };

const S1 = "var(--series-1)";
const S2 = "var(--series-2)";
const S3 = "var(--series-3)";

const original = (page: string, label: string) => summary.cards.find((c) => c.page === page && c.label === label);

const PAGES: PageSpec[] = [
  {
    id: "energy",
    name: "Energy and Activity",
    short: "Energy",
    window: { start: "2023-05-01", end: "2023-08-01" },
    cards: [
      { label: "Active energy", metric: "active_energy_kcal", agg: "sum", unit: "kcal", original: "Active Energy Burned (kCal)" },
      { label: "Average daily active energy", metric: "active_energy_kcal", agg: "average", unit: "kcal", original: "Average Daily Active kCals Burned" },
      { label: "Average stand hours", metric: "stand_hours", agg: "average", unit: "hours", digits: 1, original: "Average Stand Hours" },
      { label: "Total exercise", metric: "exercise_min", agg: "sum", unit: "min", original: "Total Exercise Minutes" },
      { label: "Flights climbed", metric: "flights_climbed", agg: "sum", unit: "flights", original: "Flights Climbed" },
    ],
    charts: [
      { kind: "line", title: "Active energy burned", keys: [{ key: "active_energy_kcal", label: "Active energy", color: S1 }], unit: "kcal" },
      { kind: "bars", title: "Exercise", key: "exercise_min", label: "Exercise", unit: "min", threshold: 30, thresholdLabel: "30 min" },
    ],
  },
  {
    id: "cardio",
    name: "Cardiovascular",
    short: "Cardio",
    window: { start: "2023-05-01", end: "2023-08-01" },
    cards: [
      { label: "Average heart rate (all day)", metric: "heart_rate_bpm", agg: "average", unit: "bpm", digits: 1, original: "Average Active Heart Rate (bpm)" },
      { label: "Average resting heart rate", metric: "resting_hr_bpm", agg: "average", unit: "bpm", digits: 1, original: "Average Resting Heart Rate (bpm)" },
      { label: "Lowest VO2 max", metric: "vo2max", agg: "min", unit: "mL/kg·min", digits: 1, original: "Minimum VO2 Max" },
      { label: "Highest VO2 max", metric: "vo2max", agg: "max", unit: "mL/kg·min", digits: 1, original: "Maximum VO2 Max" },
      { label: "Average HRV (SDNN)", metric: "hrv_sdnn_ms", agg: "average", unit: "ms", digits: 1, original: "Average HR Variability SDNN (ms)" },
    ],
    charts: [
      {
        kind: "line",
        title: "Heart rate: daily average and resting",
        keys: [
          { key: "heart_rate_bpm", label: "Daily average", color: S1 },
          { key: "resting_hr_bpm", label: "Resting", color: S2 },
        ],
        unit: "bpm",
      },
      { kind: "history", title: "VO2 max, every estimate", key: "vo2max", label: "VO2 max", unit: "mL/kg·min" },
      { kind: "line", title: "Heart rate variability (SDNN)", keys: [{ key: "hrv_sdnn_ms", label: "HRV", color: S3 }], unit: "ms", area: true, trend: true },
    ],
  },
  {
    id: "mobility",
    name: "Mobility and Movement",
    short: "Mobility",
    window: { start: "2024-05-01", end: "2024-08-01" },
    cards: [
      { label: "Total steps", metric: "steps", agg: "sum", unit: "steps", original: "Total Steps Taken" },
      { label: "Average walking speed", metric: "walking_speed_mph", agg: "average", unit: "mph", digits: 2, original: "Average Walking Speed (mph)" },
      { label: "Average step length", metric: "step_length_in", agg: "average", unit: "in", digits: 1, original: "Avg Walking Speed Length (in)" },
      { label: "Average running speed", metric: "running_speed_mph", agg: "average", unit: "mph", digits: 2, original: "Average Running Speed (mph)" },
      { label: "Distance cycled", metric: "distance_cycling_mi", agg: "sum", unit: "mi", digits: 1, original: "Total Distance Cycled (mi)" },
    ],
    charts: [
      { kind: "line", title: "Step length", keys: [{ key: "step_length_in", label: "Step length", color: S3 }], unit: "in" },
      { kind: "gauge", title: "Six-minute walk distance", key: "six_minute_walk_m", label: "Average estimate", unit: "m", target: 700 },
      { kind: "bars", title: "Steps", key: "steps", label: "Steps", unit: "steps", threshold: 10000, thresholdLabel: "10,000" },
    ],
  },
  {
    id: "environment",
    name: "Physical and Environmental",
    short: "Environment",
    window: { start: "2024-05-01", end: "2024-08-01" },
    cards: [
      { label: "Average physical effort", metric: "physical_effort", agg: "average", unit: "kcal/hr·kg", digits: 2, original: "Avg of Physical Effort (kcal/hr•kg)" },
      { label: "Average environmental sound", metric: "env_audio_dba", agg: "average", unit: "dBA", digits: 1, original: "Avg of Env Audio Exposure (dBASPL)" },
      { label: "Loudest environmental day", metric: "env_audio_dba", agg: "max", unit: "dBA", digits: 1, original: "Max of Env Audio Exposure" },
      { label: "Average headphone level", metric: "headphone_audio_dba", agg: "average", unit: "dBA", digits: 1, original: "Avg of Headphone Audio Exposure (dBASPL)" },
      { label: "Loudest headphone day", metric: "headphone_audio_dba", agg: "max", unit: "dBA", digits: 1, original: "Max of HP Audio Exposure" },
    ],
    charts: [
      { kind: "bars", title: "Headphone listening level", key: "headphone_audio_dba", label: "Headphone level", unit: "dBA", threshold: 80, thresholdLabel: "80 dB" },
      { kind: "line", title: "Physical effort", keys: [{ key: "physical_effort", label: "Physical effort", color: S1 }], unit: "kcal/hr·kg", area: true },
    ],
  },
];

const YEARS = (() => {
  const ys: number[] = [];
  for (let y = Number(lastDay.slice(0, 4)); y >= Number(firstDay.slice(0, 4)); y--) ys.push(y);
  return ys;
})();

const fmt = (v: number | null, digits = 0) =>
  v === null || Number.isNaN(v) ? "–" : v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Number that counts from its previous value to the new one. Text is final immediately for assistive tech. */
function CountUp({ value, digits = 0 }: { value: number | null; digits?: number }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (value === null || reduced) {
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current ?? 0;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 650);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return (
    <>
      <span aria-hidden>{fmt(value === null || reduced ? value : shown, digits)}</span>
      <span className="sr-only">{fmt(value, digits)}</span>
    </>
  );
}

function KpiCard({ spec, page, from, to, isOriginalWindow }: { spec: CardSpec; page: PageSpec; from: number; to: number; isOriginalWindow: boolean }) {
  const raw = aggregate(spec.metric, from, to, spec.agg);
  const value = raw === null ? null : raw * (spec.scale ?? 1);
  const orig: Card | undefined = spec.original ? original(page.name, spec.original) : undefined;
  const differs = orig && isOriginalWindow && (orig.notes.length > 0 || !orig.matches);
  return (
    <div className="flex min-w-0 flex-col bg-surface-1 p-4">
      <dt className="text-xs leading-snug text-ink-3">{spec.label}</dt>
      <dd className="mt-1.5">
        <span className="text-2xl font-semibold tracking-tight text-ink-1 tabular-nums">
          <CountUp value={value} digits={spec.digits ?? 0} />
        </span>
        <span className="ml-1 text-xs text-ink-3">{spec.unit}</span>
      </dd>
      {differs && (
        <p className="mt-2 text-[0.6875rem] leading-snug text-warn">
          Original card: {orig.shown} · {orig.hint}
        </p>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children, wide }: { title: string; subtitle: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <figure className={`min-w-0 rounded-[var(--radius-md)] border border-line bg-surface-1 p-4 ${wide ? "lg:col-span-2" : ""}`}>
      <figcaption>
        <p className="font-semibold tracking-tight text-ink-1">{title}</p>
        <p className="text-xs text-ink-3">{subtitle}</p>
      </figcaption>
      <div className="mt-3 h-56">{children}</div>
    </figure>
  );
}

const tick = (bucket: string) => (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", bucket === "month" ? { month: "short", year: "2-digit", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" });

function linearTrend(rows: Record<string, number | string | null>[], key: string) {
  const pts = rows.map((r, i) => [i, r[key]] as const).filter((p): p is readonly [number, number] => typeof p[1] === "number");
  if (pts.length < 3) return rows;
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p[0], 0);
  const sy = pts.reduce((a, p) => a + p[1], 0);
  const sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
  const sxx = pts.reduce((a, p) => a + p[0] * p[0], 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const icpt = (sy - slope * sx) / n;
  return rows.map((r, i) => ({ ...r, trend: icpt + slope * i }));
}

function Chart({ spec, from, to }: { spec: ChartSpec; from: number; to: number }) {
  const days = to - from + 1;
  const bucket = bucketFor(days);
  const per = bucket === "day" ? "Daily values" : bucket === "week" ? "Weekly averages of daily values" : "Monthly averages of daily values";

  if (spec.kind === "gauge") {
    const avg = aggregate(spec.key, from, to, "average");
    const count = aggregate(spec.key, from, to, "count") ?? 0;
    const max = spec.target * 1.4;
    const frac = avg === null ? 0 : Math.min(1, avg / max);
    const tFrac = spec.target / max;
    const r = 80;
    const arc = (f: number) => {
      const a = Math.PI * (1 - f);
      return [100 + r * Math.cos(a), 100 - r * Math.sin(a)];
    };
    const [ex, ey] = arc(frac);
    const [tx1, ty1] = arc(tFrac);
    return (
      <ChartCard title={spec.title} subtitle={`${count} estimate${count === 1 ? "" : "s"} in this window · target line at ${spec.target} m`}>
        <svg viewBox="0 0 200 120" className="mx-auto h-full w-auto" role="img" aria-label={`${spec.label}: ${fmt(avg)} ${spec.unit}`}>
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--surface-3)" strokeWidth="18" strokeLinecap="round" />
          {avg !== null && (
            <path d={`M20 100 A80 80 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`} fill="none" stroke={S2} strokeWidth="18" strokeLinecap="round" className="gauge-arc" />
          )}
          <line x1={tx1} y1={ty1} x2={100 + (tx1 - 100) * 1.22} y2={100 + (ty1 - 100) * 1.22} stroke="var(--ink-1)" strokeWidth="2" />
          <text x="100" y="92" textAnchor="middle" className="fill-[var(--ink-1)] text-[1.6rem] font-semibold">
            {fmt(avg)}
          </text>
          <text x="100" y="112" textAnchor="middle" className="fill-[var(--ink-3)] font-mono text-[0.5rem]">
            metres in six minutes
          </text>
        </svg>
      </ChartCard>
    );
  }

  if (spec.kind === "history") {
    const s = series(spec.key);
    const rows = s.flatMap((v, i) => (v === null ? [] : [{ date: isoOf(i), [spec.key]: v }]));
    const inWindow = rows.filter((r) => r.date >= isoOf(from) && r.date <= isoOf(to)).length;
    return (
      <ChartCard title={spec.title} subtitle={`${rows.length} estimates since ${rows[0]?.date.slice(0, 4)} · shaded band is the selected window (${inWindow} inside)`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 18, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <ReferenceArea x1={isoOf(from)} x2={isoOf(to)} fill="var(--accent)" fillOpacity={0.08} ifOverflow="extendDomain" />
            <XAxis dataKey="date" type="category" {...axisProps} tickFormatter={(d: string) => d.slice(0, 4)} minTickGap={40} />
            <YAxis {...axisProps} domain={["dataMin - 2", "dataMax + 2"]} width={44} tickFormatter={(v: number) => fmt(v)} />
            <Tooltip
              cursor={{ stroke: "var(--line-strong)" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TipBox title={shortDate(String(payload[0].payload.date))} lines={[`${spec.label}: ${fmt(Number(payload[0].value), 1)} ${spec.unit}`]} />
                ) : null
              }
            />
            <Area dataKey={spec.key} type="monotone" stroke={S1} strokeWidth={2} fill={S1} fillOpacity={0.12} dot={{ r: 2.5, fill: S1, strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  if (spec.kind === "bars") {
    const rows = bucketed([spec.key], from, to, bucket);
    const vals = rows.map((r) => r[spec.key]).filter((v): v is number => typeof v === "number");
    const hi = Math.max(...vals, spec.threshold ?? 0);
    const lo = Math.min(...vals, 0);
    return (
      <ChartCard title={spec.title} subtitle={`${per}${spec.threshold ? ` · line at ${spec.thresholdLabel}` : ""}`} wide={spec.key === "steps"}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 18, bottom: 0, left: -6 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="date" {...axisProps} tickFormatter={tick(bucket)} minTickGap={28} />
            <YAxis {...axisProps} width={44} domain={[0, "auto"]} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : fmt(v))} />
            <Tooltip
              cursor={{ fill: "var(--line)" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TipBox
                    title={bucket === "day" ? shortDate(String(payload[0].payload.date)) : `${bucket === "week" ? "Week of" : "Month of"} ${shortDate(String(payload[0].payload.date))}`}
                    lines={[`${spec.label}: ${fmt(Number(payload[0].value), spec.unit === "dBA" ? 1 : 0)} ${spec.unit}`]}
                  />
                ) : null
              }
            />
            {spec.threshold && (
              <ReferenceLine y={spec.threshold} stroke="var(--ink-2)" strokeDasharray="4 3" label={{ value: spec.thresholdLabel, position: "insideTopRight", fill: "var(--ink-2)", fontSize: 10 }} />
            )}
            <Bar dataKey={spec.key} radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={700}>
              {rows.map((r) => {
                const v = typeof r[spec.key] === "number" ? (r[spec.key] as number) : 0;
                const over = spec.unit === "dBA" && spec.threshold !== undefined && v >= spec.threshold;
                const t = hi > lo ? (v - lo) / (hi - lo) : 1;
                return <Cell key={String(r.date)} fill={over ? S2 : S1} fillOpacity={over ? 1 : 0.35 + 0.65 * t} />;
              })}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  const keys = spec.keys.map((k) => k.key);
  let rows = bucketed(keys, from, to, bucket);
  if (spec.trend) rows = linearTrend(rows, keys[0]);
  return (
    <ChartCard title={spec.title} subtitle={`${per}${spec.trend ? " · dashed line is the linear trend" : ""}`} wide={spec.keys.length > 1}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 18, bottom: 0, left: -6 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={tick(bucket)} minTickGap={28} />
          <YAxis {...axisProps} width={44} domain={["auto", "auto"]} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : fmt(v, v < 10 ? 1 : 0))} />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox
                  title={bucket === "day" ? shortDate(String(payload[0].payload.date)) : `${bucket === "week" ? "Week of" : "Month of"} ${shortDate(String(payload[0].payload.date))}`}
                  lines={spec.keys.map((k) => {
                    const v = payload[0].payload[k.key];
                    return `${k.label}: ${typeof v === "number" ? fmt(v, v < 10 ? 2 : 1) : "–"} ${spec.unit}`;
                  })}
                />
              ) : null
            }
          />
          {spec.keys.map((k) =>
            spec.area ? (
              <Area key={k.key} dataKey={k.key} type="monotone" stroke={k.color} strokeWidth={2} fill={k.color} fillOpacity={0.14} connectNulls dot={false} animationDuration={900} />
            ) : (
              <Line key={k.key} dataKey={k.key} type="monotone" stroke={k.color} strokeWidth={2} connectNulls dot={days <= 100 ? { r: 2, strokeWidth: 0, fill: k.color } : false} animationDuration={900} />
            ),
          )}
          {spec.trend && <Line dataKey="trend" stroke="var(--ink-2)" strokeDasharray="5 4" strokeWidth={1.5} dot={false} activeDot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

type Preset = "original" | "90" | "all" | `y${number}`;

export function HealthReport() {
  const [pageId, setPageId] = useState(PAGES[0].id);
  const page = PAGES.find((p) => p.id === pageId)!;
  const [preset, setPreset] = useState<Preset>("original");
  const [custom, setCustom] = useState<{ start: string; end: string } | null>(null);

  const range = useMemo(() => {
    if (custom) return custom;
    if (preset === "original") return page.window;
    if (preset === "90") return { start: isoOf(dayCount - 90), end: lastDay };
    if (preset === "all") return { start: firstDay, end: lastDay };
    const y = preset.slice(1);
    return { start: `${y}-01-01` < firstDay ? firstDay : `${y}-01-01`, end: `${y}-12-31` > lastDay ? lastDay : `${y}-12-31` };
  }, [custom, preset, page]);
  const from = indexOf(range.start);
  const to = indexOf(range.end);
  const isOriginalWindow = !custom && preset === "original";

  const presets: { id: Preset; label: string }[] = [
    { id: "original", label: "Original report dates" },
    { id: "90", label: "Last 90 days" },
    ...YEARS.map((y) => ({ id: `y${y}` as Preset, label: String(y) })),
    { id: "all", label: "All" },
  ];

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface-2/40">
      <div className="grid lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Page navigator, like the report's side panel */}
        <nav aria-label="Report pages" className="border-b border-line bg-surface-1 p-3 lg:border-b-0 lg:border-r lg:p-4">
          <p className="hidden px-2 pb-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3 lg:block">Health analysis</p>
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {PAGES.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-current={p.id === pageId ? "page" : undefined}
                  onClick={() => setPageId(p.id)}
                  className={`relative w-full whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm transition-colors ${
                    p.id === pageId ? "bg-surface-3 text-ink-1" : "text-ink-3 hover:bg-surface-2 hover:text-ink-1"
                  }`}
                >
                  {p.id === pageId && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
                  <span className="lg:hidden">{p.short}</span>
                  <span className="hidden lg:inline">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 p-4 sm:p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-ink-1 sm:text-2xl">{page.name}</h3>
              <p className="mt-1 text-sm text-ink-3">
                {shortDate(range.start)} to {shortDate(range.end)}
                {isOriginalWindow && " · the dates the original page was set to"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <label className="flex items-center gap-1.5">
                From
                <input
                  type="date"
                  min={firstDay}
                  max={lastDay}
                  value={range.start}
                  onChange={(e) => e.target.value && setCustom({ start: e.target.value, end: e.target.value > range.end ? e.target.value : range.end })}
                  className="rounded-md border border-line-strong bg-surface-2 px-2 py-1 font-mono text-ink-1 [color-scheme:dark]"
                />
              </label>
              <label className="flex items-center gap-1.5">
                to
                <input
                  type="date"
                  min={firstDay}
                  max={lastDay}
                  value={range.end}
                  onChange={(e) => e.target.value && setCustom({ start: e.target.value < range.start ? e.target.value : range.start, end: e.target.value })}
                  className="rounded-md border border-line-strong bg-surface-2 px-2 py-1 font-mono text-ink-1 [color-scheme:dark]"
                />
              </label>
            </div>
          </div>
          <div role="group" aria-label="Date range" className="mt-4 flex flex-wrap gap-1">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={!custom && preset === p.id}
                onClick={() => {
                  setCustom(null);
                  setPreset(p.id);
                }}
                className={`rounded-full border px-2.5 py-1 font-mono text-[0.6875rem] transition-colors ${
                  !custom && preset === p.id ? "border-accent/60 bg-accent-soft text-ink-1" : "border-line text-ink-3 hover:border-line-strong hover:text-ink-1"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div key={page.id} className="page-in">
            <dl className="mt-5 grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line [grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))]">
              {page.cards.map((c) => (
                <KpiCard key={c.label} spec={c} page={page} from={from} to={to} isOriginalWindow={isOriginalWindow} />
              ))}
            </dl>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {page.charts.map((c) => (
                <Chart key={c.title} spec={c} from={from} to={to} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

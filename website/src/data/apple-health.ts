/**
 * Typed access to the Apple Health outputs written by
 * `PYTHONPATH=src python -m apple_health build` (see projects/apple-health-analytics).
 * Components read numbers from here; no metric value is typed by hand.
 */

import summaryJson from "./generated/apple-health/summary.json";
import dailyJson from "./generated/apple-health/daily.json";

export type MetricGroup = "activity" | "cardio" | "mobility" | "environment";
export type MetricKind = "total" | "average" | "estimate" | "level_db" | "minimum_db";

export type MetricMeta = { key: string; label: string; unit: string; group: MetricGroup; kind: MetricKind; decimals: number };

export type Card = {
  page: string;
  label: string;
  metric: string;
  aggregation: "sum" | "average" | "min" | "max";
  shown: string;
  rebuilt: number;
  days: number;
  matches: boolean;
  slicer_reached: boolean;
  own_filter: boolean;
  corrected: number | null;
  corrected_unit: string;
  window: { start: string; end_exclusive: string };
  notes: string[];
  hint: string | null;
};

export type Finding = { id: string; title: string; summary: string; metric: string; caveat: string };
export type QualityCheck = { name: string; result: string; detail: string };

export type DistanceCheck = {
  median_step_length_in: number;
  expected_mi_per_1000: number;
  recorded_mi_per_1000: number;
  ratio_to_expected: number;
  days_compared: number;
  monthly: { month: string; mi_per_1000: number; days: number }[];
};

export type Summary = {
  source: {
    name: string;
    first_day: string;
    watch_start: string;
    last_day: string;
    records: number;
    report_first_day: string;
    report_last_day: string;
  };
  headline: {
    watch_days: number;
    step_days: number;
    steps_total: number;
    steps_mean: number;
    steps_median: number;
    goal_share: number;
    years: number;
    metrics: number;
    workouts: number;
    records: number;
  };
  comparison: {
    metric: string;
    label: string;
    unit: string;
    days: number;
    original: number;
    rebuilt: number;
    change_pct: number;
    same_day_share: number;
  }[];
  dedup_effect: Record<string, { days: number; avg_without_dedup: number; avg_with_dedup: number }>;
  workouts: {
    total: number;
    hours: number;
    first_month: string;
    groups: string[];
    by_activity: { activity: string; workouts: number; hours: number; avg_minutes: number; active_kcal: number; distance_mi: number }[];
    by_year: ({ year: number; hours: number } & Record<string, number>)[];
  };
  coverage: { metric: string; label: string; unit: string; group: MetricGroup; kind: string; days: number; first: string; last: string }[];
  cards: Card[];
  findings: Finding[];
  quality: {
    checks: QualityCheck[];
    excluded: { metric: string; date: string; value: number; reason: string }[];
  };
  yearly: {
    year: number;
    watch_days: number;
    step_days: number;
    steps_mean: number | null;
    steps_median: number | null;
    steps_total: number;
    goal_share: number | null;
    exercise_mean: number | null;
    active_kcal_mean: number | null;
    resting_hr: number | null;
    hrv: number | null;
    distance_mean: number | null;
  }[];
  weekday: { day: string; steps_mean: number; steps_days: number; exercise_mean: number }[];
  months: { month: string; steps_mean: number; steps_days: number; exercise_mean: number }[];
  histogram: { from: number; to: number | null; days: number }[];
  distance_check: { original: DistanceCheck; rebuilt: DistanceCheck };
  fitness: {
    months: number;
    r_exercise_resting_hr: number;
    r_exercise_hrv: number;
    r_steps_resting_hr: number;
    monthly: { month: string; exercise_min: number; resting_hr: number; hrv: number | null }[];
    periods: Record<"through_2020" | "from_2023", { exercise_min: number; resting_hr: number; hrv: number }>;
    same_watch: Record<"before" | "after", { label: string; exercise_min: number; resting_hr: number }>;
  };
  records: { key: string; label: string; value: number; unit: string; date: string | null }[];
  model: {
    tables: number;
    relationships: number;
    date_relationships: number;
    inactive: string[];
    two_way_one_to_one: number;
    value_joins: string[];
    hubs: string[];
    device_filtered: string[];
    rules: Record<string, string | null>;
    measures: { table: string; name: string; expression: string }[];
  };
  metrics: MetricMeta[];
};

type DailyPayload = {
  start: string;
  end: string;
  days: number;
  dense: Record<string, { offset: number; values: (number | null)[] }>;
  sparse: Record<string, [number, number][]>;
};

export const summary = summaryJson as unknown as Summary;
const daily = dailyJson as unknown as DailyPayload;

export const metricByKey = Object.fromEntries(summary.metrics.map((m) => [m.key, m])) as Record<string, MetricMeta>;

const DAY_MS = 86_400_000;
const startMs = Date.parse(`${daily.start}T00:00:00Z`);

export const dayCount = daily.days;
export const firstDay = daily.start;
export const lastDay = daily.end;

/** ISO date of a day index. */
export const isoOf = (i: number) => new Date(startMs + i * DAY_MS).toISOString().slice(0, 10);
/** Day index of an ISO date, clamped to the data range. */
export const indexOf = (iso: string) =>
  Math.min(daily.days - 1, Math.max(0, Math.round((Date.parse(`${iso}T00:00:00Z`) - startMs) / DAY_MS)));

const sparseCache: Record<string, (number | null)[]> = {};
/** Full-length array for a metric (sparse metrics are expanded once). */
export function series(key: string): (number | null)[] {
  if (!sparseCache[key]) {
    const arr: (number | null)[] = new Array(daily.days).fill(null);
    const dense = daily.dense[key];
    if (dense) dense.values.forEach((v, i) => (arr[dense.offset + i] = v));
    for (const [i, v] of daily.sparse[key] ?? []) arr[i] = v;
    sparseCache[key] = arr;
  }
  return sparseCache[key];
}

export type Agg = "sum" | "average" | "min" | "max" | "count" | "last";

/** Aggregate a metric over day indexes [from, to] inclusive, skipping blank days. */
export function aggregate(key: string, from: number, to: number, agg: Agg): number | null {
  const s = series(key);
  let n = 0;
  let total = 0;
  let lo = Infinity;
  let hi = -Infinity;
  let last: number | null = null;
  for (let i = Math.max(0, from); i <= Math.min(to, s.length - 1); i++) {
    const v = s[i];
    if (v === null) continue;
    n++;
    total += v;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
    last = v;
  }
  if (agg === "count") return n;
  if (!n) return null;
  return { sum: total, average: total / n, min: lo, max: hi, last }[agg] as number;
}

export type Bucket = "day" | "week" | "month";

/** Rows for a chart over [from, to]. Longer windows are averaged per week or month so bars stay readable. */
export function bucketed(keys: string[], from: number, to: number, bucket: Bucket) {
  const rows: Record<string, number | string | null>[] = [];
  const keyOf = (i: number) => {
    const iso = isoOf(i);
    if (bucket === "day") return iso;
    if (bucket === "month") return `${iso.slice(0, 7)}-01`;
    const d = new Date(`${iso}T00:00:00Z`);
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS);
    return monday.toISOString().slice(0, 10);
  };
  let current: string | null = null;
  let acc: Record<string, { t: number; n: number }> = {};
  const flush = () => {
    if (current === null) return;
    const row: Record<string, number | string | null> = { date: current };
    for (const k of keys) row[k] = acc[k]?.n ? acc[k].t / acc[k].n : null;
    rows.push(row);
  };
  for (let i = from; i <= to; i++) {
    const k = keyOf(i);
    if (k !== current) {
      flush();
      current = k;
      acc = {};
    }
    for (const key of keys) {
      const v = series(key)[i];
      if (v === null) continue;
      (acc[key] ??= { t: 0, n: 0 }).t += v;
      acc[key].n++;
    }
  }
  flush();
  return rows;
}

export const bucketFor = (days: number): Bucket => (days <= 140 ? "day" : days <= 800 ? "week" : "month");

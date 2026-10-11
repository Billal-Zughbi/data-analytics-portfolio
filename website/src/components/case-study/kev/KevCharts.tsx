"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, Segmented, TipBox, axisProps, num, pct } from "@/components/case-study/ChartFrame";
import type { AddedYearRow, BaselineRow, FamilyRow, LagBucket, MonthRow, VendorRow } from "@/data/kev";

const FRESH = "var(--series-1)";
/* Middle band is neutral: fast vs slow is a polarity, so it reads blue → grey → orange. */
const MID = "var(--neutral-mid)";
const OLD = "var(--series-2)";
const GAP = { stroke: "var(--surface-1)", strokeWidth: 1 } as const;
const pctTick = (v: number) => `${Math.round(v * 100)}%`;
const days = (d: number | null) => (d === null ? "–" : `${num(d, d % 1 ? 1 : 0)} days`);
const monthLabel = (m: string) => {
  const [y, mm] = m.split("-");
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(mm) - 1]} ’${y.slice(2)}`;
};

/* 1. Age of the CVE when CISA listed it, by year added */
export function AgeAtListingChart({ rows }: { rows: AddedYearRow[] }) {
  const data = rows.map((r) => ({
    ...r,
    fresh: r.share_within_30d,
    mid: Math.max(0, 1 - r.share_within_30d - r.share_over_1y),
    old: r.share_over_1y,
  }));
  const last = rows[rows.length - 1];
  return (
    <ChartFrame
      title="How old a CVE was when CISA listed it"
      subtitle="Each bar is one year of KEV additions, split by days since the CVE record was published."
      legend={[
        { label: "30 days or less", color: FRESH, shape: "box" },
        { label: "31 days to a year", color: MID, shape: "box" },
        { label: "More than a year", color: OLD, shape: "box" },
      ]}
      table={{
        caption: "Age at listing by year added",
        columns: ["Year added", "Entries", "≤ 30 days", "31–365 days", "> 1 year", "Median age"],
        align: ["left", "right", "right", "right", "right", "right"],
        rows: data.map((r) => [String(r.added_year), num(r.entries), pct(r.fresh), pct(r.mid), pct(r.old), days(r.median_age_days)]),
      }}
      note={`2021 is mostly the launch batch of ${num(rows[0].launch_backlog_entries)} older CVEs. ${last.added_year} covers part of the year only.`}
      height={280}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="added_year" {...axisProps} axisLine={{ stroke: "var(--line-strong)" }} />
          <YAxis {...axisProps} axisLine={false} width={44} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={pctTick} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof data)[number];
              return (
                <TipBox
                  title={`Added in ${r.added_year} · ${num(r.entries)} entries`}
                  lines={[`30 days or less: ${pct(r.fresh)}`, `31 days to a year: ${pct(r.mid)}`, `More than a year: ${pct(r.old)}`, `Median age ${days(r.median_age_days)}`]}
                />
              );
            }}
          />
          <Bar dataKey="fresh" stackId="a" fill={FRESH} {...GAP} isAnimationActive={false} />
          <Bar dataKey="mid" stackId="a" fill={MID} {...GAP} isAnimationActive={false} />
          <Bar dataKey="old" stackId="a" fill={OLD} {...GAP} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* 2. Distribution of days from publication to listing */
type Cohort = LagBucket["cohort"];
const bucketColor = (order: number) => (order <= 4 ? FRESH : order <= 6 ? MID : OLD);

export function LagDistributionChart({ buckets }: { buckets: LagBucket[] }) {
  const [cohort, setCohort] = useState<Cohort>("Added after launch");
  const data = buckets.filter((b) => b.cohort === cohort);
  const total = data.reduce((s, b) => s + b.entries, 0);
  return (
    <ChartFrame
      title="Days from CVE publication to KEV listing"
      subtitle={`Share of ${num(total)} entries in each gap. "Before publication" means CISA listed it before the CVE record went public.`}
      controls={
        <Segmented
          label="Entries"
          value={cohort}
          onChange={setCohort}
          options={[
            { value: "Added after launch", label: "Added after launch" },
            { value: "Launch backlog", label: "November 2021 launch batch" },
          ]}
        />
      }
      legend={[
        { label: "30 days or less", color: FRESH, shape: "box" },
        { label: "31 days to a year", color: MID, shape: "box" },
        { label: "More than a year", color: OLD, shape: "box" },
      ]}
      table={{
        caption: `Days from publication to listing, ${cohort.toLowerCase()}`,
        columns: ["Gap", "Entries", "Share", "Cumulative"],
        align: ["left", "right", "right", "right"],
        rows: data.map((b) => [b.lag_bucket, num(b.entries), pct(b.share), pct(b.cumulative_share)]),
      }}
      note="Two humps: one group is listed within days, another years later. A single median sits between them and describes neither."
      height={280}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="lag_bucket"
            {...axisProps}
            axisLine={{ stroke: "var(--line-strong)" }}
            interval={0}
            tickFormatter={(l: string) => l.replace("Before publication", "Before").replace(" days", "d").replace(" years", "y").replace("Over 3y", "3y+")}
          />
          <YAxis {...axisProps} axisLine={false} width={44} tickFormatter={pctTick} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const b = payload[0].payload as LagBucket;
              return <TipBox title={b.lag_bucket} lines={[`${num(b.entries)} entries (${pct(b.share)})`, `${pct(b.cumulative_share)} listed by the end of this gap`]} />;
            }}
          />
          <Bar
            dataKey="share"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            label={{ position: "top", fill: "var(--ink-2)", fontSize: 11, formatter: (v: unknown) => pct(Number(v), 0) }}
          >
            {data.map((b) => (
              <Cell key={b.lag_bucket} fill={bucketColor(b.bucket_order)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* 3. Monthly additions */
export function AdditionsChart({ rows }: { rows: MonthRow[] }) {
  const [split, setSplit] = useState<"age" | "ransomware">("age");
  const launch = rows[0];
  const data = useMemo(
    () =>
      rows.slice(1).map((r) => ({
        ...r,
        a: split === "age" ? r.fresh_additions_30d : r.ransomware_known_additions,
        b: split === "age" ? r.additions - r.fresh_additions_30d : r.additions - r.ransomware_known_additions,
      })),
    [rows, split],
  );
  const labels = split === "age" ? ["Published 30 days or less before", "Older CVEs"] : ["Known ransomware use", "Not known"];
  return (
    <ChartFrame
      title="KEV additions per month"
      subtitle={`From ${monthLabel(data[0].year_month)} to ${monthLabel(data[data.length - 1].year_month)}.`}
      controls={
        <Segmented
          label="Split additions by"
          value={split}
          onChange={setSplit}
          options={[
            { value: "age", label: "Age of the CVE" },
            { value: "ransomware", label: "Ransomware use" },
          ]}
        />
      }
      legend={[
        { label: labels[0], color: split === "age" ? FRESH : OLD, shape: "box" },
        { label: labels[1], color: MID, shape: "box" },
      ]}
      table={{
        caption: "KEV additions per month",
        columns: ["Month", "Added", labels[0], labels[1], "Rolling 12 months"],
        align: ["left", "right", "right", "right", "right"],
        rows: data.map((r) => [monthLabel(r.year_month), num(r.additions), num(r.a), num(r.b), r.rolling_window_complete ? num(r.rolling_12m_additions) : "–"]),
      }}
      note={`Not shown: the launch month (${monthLabel(launch.year_month)}, ${num(launch.additions)} entries, ${num(launch.launch_backlog_additions)} of them in the launch batch), which would flatten every other bar. ${monthLabel(rows[rows.length - 1].year_month)} is a partial month.`}
      height={260}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 18, bottom: 0, left: 0 }} barCategoryGap={1}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="year_month" {...axisProps} axisLine={{ stroke: "var(--line-strong)" }} tickFormatter={monthLabel} minTickGap={24} />
          <YAxis {...axisProps} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof data)[number];
              return <TipBox title={monthLabel(r.year_month)} lines={[`${num(r.additions)} added`, `${labels[0]}: ${num(r.a)}`, `${labels[1]}: ${num(r.b)}`]} />;
            }}
          />
          <Bar dataKey="a" stackId="m" fill={split === "age" ? FRESH : OLD} isAnimationActive={false} />
          <Bar dataKey="b" stackId="m" fill={MID} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* 4. Severity: share of KEV vs share of all CVEs, and KEV rate per band */
export function SeverityChart({ rows, scope }: { rows: BaselineRow[]; scope: string }) {
  const [view, setView] = useState<"mix" | "rate">("mix");
  const data = rows.map((r) => ({ ...r, label: r.band === "No CVSS in record" ? "No CNA score" : r.band }));
  return (
    <ChartFrame
      title={view === "mix" ? "Severity of KEV entries compared with all CVEs" : "Estimated share of each band that ends up in KEV"}
      subtitle={`${scope}. The all-CVE mix is estimated from a random sample of CVE IDs.`}
      controls={
        <Segmented
          label="Severity view"
          value={view}
          onChange={setView}
          options={[
            { value: "mix", label: "Severity mix" },
            { value: "rate", label: "KEV rate per band" },
          ]}
        />
      }
      legend={
        view === "mix"
          ? [
              { label: "Share of all published CVEs", color: MID, shape: "box" },
              { label: "Share of KEV entries", color: OLD, shape: "box" },
            ]
          : undefined
      }
      table={{
        caption: "KEV entries and estimated CVE population by CNA severity band",
        columns: ["CNA severity", "KEV entries", "Share of KEV", "Share of all CVEs", "Est. CVEs", "KEV rate (95% interval)"],
        align: ["left", "right", "right", "right", "right", "right"],
        rows: data.map((r) => [
          r.label,
          num(r.kev_entries),
          pct(r.kev_share),
          pct(r.baseline_share),
          num(r.est_population),
          `${pct(r.kev_rate, 2)} (${pct(r.kev_rate_lo, 2)}–${pct(r.kev_rate_hi, 2)})`,
        ]),
      }}
      note={
        view === "mix"
          ? "Critical CVEs are over-represented in KEV, but most KEV entries are not Critical, and a large share had no CNA score at all."
          : "KEV rate = KEV entries in the band divided by the estimated number of published CVEs in that band. KEV only holds confirmed exploitation, so these are lower bounds."
      }
      height={260}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="label" {...axisProps} axisLine={{ stroke: "var(--line-strong)" }} interval={0} />
          <YAxis {...axisProps} axisLine={false} width={44} tickFormatter={(v: number) => (view === "mix" ? pctTick(v) : `${(v * 100).toFixed(1)}%`)} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof data)[number];
              return (
                <TipBox
                  title={r.label}
                  lines={[
                    `${num(r.kev_entries)} KEV entries (${pct(r.kev_share)} of KEV)`,
                    `${pct(r.baseline_share)} of all CVEs (≈${num(r.est_population)})`,
                    `KEV rate ${pct(r.kev_rate, 2)} (95% ${pct(r.kev_rate_lo, 2)}–${pct(r.kev_rate_hi, 2)})`,
                  ]}
                />
              );
            }}
          />
          {view === "mix" ? (
            <>
              <Bar dataKey="baseline_share" fill={MID} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="kev_share" fill={OLD} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </>
          ) : (
            <Bar
              dataKey="kev_rate"
              fill={OLD}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
              label={{ position: "top", fill: "var(--ink-2)", fontSize: 11, formatter: (v: unknown) => pct(Number(v), 2) }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* 5. Vendors */
export function VendorsChart({ rows, window }: { rows: VendorRow[]; window: { start: string; end: string } }) {
  const [view, setView] = useState<"entries" | "recent" | "ransomware">("entries");
  const key = view === "entries" ? "entries" : view === "recent" ? "recent_24m_entries" : "ransomware_share";
  const data = useMemo(() => rows.slice().sort((a, b) => b[key] - a[key]), [rows, key]);
  const fmt = (v: number) => (view === "ransomware" ? pct(v, 0) : num(v));
  return (
    <ChartFrame
      title={
        view === "entries"
          ? "Vendors with the most KEV entries"
          : view === "recent"
            ? "Entries added in the last 24 months"
            : "Share with known ransomware use"
      }
      subtitle={`The ${rows.length} vendors with the most entries overall, after normalizing vendor names.${view === "recent" ? ` Window: ${window.start} to ${window.end}.` : ""}`}
      controls={
        <Segmented
          label="Vendor measure"
          value={view}
          onChange={setView}
          options={[
            { value: "entries", label: "All entries" },
            { value: "recent", label: "Last 24 months" },
            { value: "ransomware", label: "Ransomware share" },
          ]}
        />
      }
      table={{
        caption: "KEV entries by vendor",
        columns: ["Vendor", "Entries", "Share", "Last 24 months", "Ransomware known", "Median days to listing"],
        align: ["left", "right", "right", "right", "right", "right"],
        rows: data.map((r) => [r.vendor, num(r.entries), pct(r.share_of_entries), num(r.recent_24m_entries), pct(r.ransomware_share, 0), days(r.median_lag_post_launch)]),
      }}
      note="Counts follow how widely a product is deployed and how closely it is watched. They are not a measure of how secure each vendor is."
      height={data.length * 26 + 30}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 8 }} barCategoryGap="22%">
          <CartesianGrid stroke="var(--grid)" horizontal={false} />
          <XAxis type="number" {...axisProps} axisLine={false} tickFormatter={(v: number) => (view === "ransomware" ? pctTick(v) : String(v))} domain={view === "ransomware" ? [0, 1] : [0, "auto"]} />
          <YAxis type="category" dataKey="vendor" {...axisProps} axisLine={{ stroke: "var(--line-strong)" }} width={78} tick={{ fill: "var(--ink-2)", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as VendorRow;
              return (
                <TipBox
                  title={r.vendor}
                  lines={[
                    `${num(r.entries)} entries (${pct(r.share_of_entries)} of KEV), ${num(r.products)} products`,
                    `${num(r.recent_24m_entries)} added in the last 24 months`,
                    `Known ransomware use ${pct(r.ransomware_share, 0)}`,
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey={key}
            fill={view === "ransomware" ? OLD : FRESH}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{ position: "right", fill: "var(--ink-2)", fontSize: 11, formatter: (v: unknown) => fmt(Number(v)) }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* 6. Weakness families */
export function CweFamilyChart({ rows, overallRansomware }: { rows: FamilyRow[]; overallRansomware: number }) {
  const [view, setView] = useState<"entries" | "ransomware">("entries");
  const key = view === "entries" ? "entries" : "ransomware_share";
  const data = useMemo(() => rows.slice().sort((a, b) => b[key] - a[key]), [rows, key]);
  return (
    <ChartFrame
      title={view === "entries" ? "Weakness types behind KEV entries" : "Known ransomware use by weakness type"}
      subtitle="CWE IDs from the CVE records grouped into families. An entry with several CWEs counts once in each family it touches."
      controls={
        <Segmented
          label="Weakness measure"
          value={view}
          onChange={setView}
          options={[
            { value: "entries", label: "Entries" },
            { value: "ransomware", label: "Ransomware share" },
          ]}
        />
      }
      table={{
        caption: "KEV entries by weakness family",
        columns: ["Family", "Entries", "Ransomware known", "Ransomware share"],
        align: ["left", "right", "right", "right"],
        rows: data.map((r) => [r.cwe_family, num(r.entries), num(r.ransomware_known), pct(r.ransomware_share)]),
      }}
      note={view === "ransomware" ? `Dashed line: share across all entries (${pct(overallRansomware)}).` : undefined}
      height={data.length * 30 + 30}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 8 }} barCategoryGap="22%">
          <CartesianGrid stroke="var(--grid)" horizontal={false} />
          <XAxis type="number" {...axisProps} axisLine={false} tickFormatter={(v: number) => (view === "entries" ? String(v) : pctTick(v))} />
          <YAxis
            type="category"
            dataKey="cwe_family"
            {...axisProps}
            axisLine={{ stroke: "var(--line-strong)" }}
            width={150}
            tick={{ fill: "var(--ink-2)", fontSize: 11 }}
            tickFormatter={(l: string) => (l.startsWith("Unknown") ? "No CWE recorded" : l.replace(" (generic)", ""))}
          />
          {view === "ransomware" && <ReferenceLine x={overallRansomware} stroke="var(--ink-3)" strokeDasharray="4 4" />}
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as FamilyRow;
              return <TipBox title={r.cwe_family} lines={[`${num(r.entries)} entries`, `Known ransomware use ${pct(r.ransomware_share)} (${num(r.ransomware_known)})`]} />;
            }}
          />
          <Bar
            dataKey={key}
            fill={view === "entries" ? FRESH : OLD}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{ position: "right", fill: "var(--ink-2)", fontSize: 11, formatter: (v: unknown) => (view === "entries" ? num(Number(v)) : pct(Number(v), 0)) }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

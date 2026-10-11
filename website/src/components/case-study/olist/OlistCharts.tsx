"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame, Segmented, TipBox, axisProps, num, pct } from "@/components/case-study/ChartFrame";
import type { DelayRow, DestRow, MonthRow, RouteRow } from "@/data/olist";

const EARLY = "var(--series-1)";
const LATE = "var(--series-2)";
const monthLabel = (m: string) => {
  const [y, mm] = m.split("-");
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(mm) - 1]} ${y.slice(2)}`;
};
const isLate = (r: DelayRow) => r.delay_bucket.startsWith("late");

/* 1. Review score by how late or early the order arrived */
export function ReviewByDelayChart({ rows }: { rows: DelayRow[] }) {
  const [metric, setMetric] = useState<"avg_score" | "pct_1star">("avg_score");
  const fmt = (v: number) => (metric === "avg_score" ? v.toFixed(2) : pct(v));
  return (
    <ChartFrame
      title={metric === "avg_score" ? "Average review score by delivery timing" : "Share of 1-star reviews by delivery timing"}
      subtitle="Delivered orders, latest review per order. Buckets compare the delivery day with the estimated day."
      controls={
        <Segmented
          label="Measure"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "avg_score", label: "Average stars" },
            { value: "pct_1star", label: "% 1-star" },
          ]}
        />
      }
      legend={[
        { label: "Arrived on or before the estimate", color: EARLY, shape: "box" },
        { label: "Arrived after the estimate", color: LATE, shape: "box" },
      ]}
      table={{
        caption: "Review outcomes by delivery timing bucket",
        columns: ["Timing", "Orders", "Avg stars", "% 1-star", "% 5-star"],
        align: ["left", "right", "right", "right", "right"],
        rows: rows.map((r) => [r.label, num(r.orders), r.avg_score.toFixed(2), pct(r.pct_1star), pct(r.pct_5star)]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="label" {...axisProps} axisLine={{ stroke: "var(--line-strong)" }} interval={0} tickFormatter={(l: string) => l.replace(" days", "d").replace("On the estimated day", "On day")} />
          <YAxis {...axisProps} axisLine={false} width={44} domain={metric === "avg_score" ? [1, 5] : [0, "auto"]} tickFormatter={(v: number) => (metric === "avg_score" ? String(v) : `${Math.round(v * 100)}%`)} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as DelayRow;
              return <TipBox title={r.label} lines={[`${num(r.orders)} orders`, `Average ${r.avg_score.toFixed(2)} stars`, `1-star ${pct(r.pct_1star)} · 5-star ${pct(r.pct_5star)}`]} />;
            }}
          />
          <Bar dataKey={metric} radius={[4, 4, 0, 0]} isAnimationActive={false} label={{ position: "top", fill: "var(--ink-2)", fontSize: 11, formatter: (v: unknown) => fmt(Number(v)) }}>
            {rows.map((r) => (
              <Cell key={r.delay_bucket} fill={isLate(r) ? LATE : EARLY} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* 2. Monthly late rate, filterable by destination */
const DESTS = ["All", "SP", "RJ", "MG", "Other"] as const;
type Dest = (typeof DESTS)[number];

export function MonthlyLateChart({ rows, byDest, overall }: { rows: MonthRow[]; byDest: DestRow[]; overall: number }) {
  const [dest, setDest] = useState<Dest>("All");
  const data = useMemo(() => {
    if (dest === "All") return rows.map((r) => ({ month: r.month, late_rate: r.late_rate, delivered: r.delivered_orders, late: r.late_orders }));
    return byDest
      .filter((d) => d.destination === dest)
      .map((d) => ({ month: d.month, late_rate: d.late_rate, delivered: d.delivered_orders, late: d.late_orders }));
  }, [dest, rows, byDest]);
  const label = dest === "All" ? "all destinations" : dest === "Other" ? "other states" : `customers in ${dest}`;
  return (
    <ChartFrame
      title="Late-delivery rate by purchase month"
      subtitle={`Share of delivered orders that arrived after the estimated day, ${label}.`}
      controls={
        <Segmented
          label="Customer state"
          value={dest}
          onChange={setDest}
          options={DESTS.map((d) => ({ value: d, label: d === "All" ? "All states" : d }))}
        />
      }
      table={{
        caption: `Monthly late-delivery rate, ${label}`,
        columns: ["Month", "Delivered", "Late", "Late rate"],
        align: ["left", "right", "right", "right"],
        rows: data.map((d) => [monthLabel(d.month), num(d.delivered), num(d.late), pct(d.late_rate)]),
      }}
      note={`Dashed line: the overall late rate across all delivered orders (${pct(overall)}). Months run from January 2017 to August 2018, the window with complete delivery data.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 28, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="month" {...axisProps} axisLine={{ stroke: "var(--line-strong)" }} tickFormatter={monthLabel} minTickGap={18} />
          <YAxis {...axisProps} axisLine={false} width={44} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
          <ReferenceLine y={overall} stroke="var(--ink-3)" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof data)[number];
              return <TipBox title={monthLabel(r.month)} lines={[`Late rate ${pct(r.late_rate)}`, `${num(r.late)} late of ${num(r.delivered)} delivered`]} />;
            }}
          />
          <Line type="monotone" dataKey="late_rate" stroke={LATE} strokeWidth={2} dot={{ r: 2.5, fill: LATE, strokeWidth: 0 }} activeDot={{ r: 5, stroke: "var(--surface-1)", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* 3. Seller handling vs carrier transit time by month */
export function HandlingTransitChart({ rows }: { rows: MonthRow[] }) {
  const last = rows.length - 1;
  const endLabel = (text: string) =>
    function EndLabel(props: { x?: number | string; y?: number | string; index?: number }) {
      if (props.index !== last) return <g />;
      return (
        <text x={Number(props.x ?? 0) + 8} y={Number(props.y ?? 0) + 4} fill="var(--ink-2)" fontSize={11}>
          {text}
        </text>
      );
    };
  return (
    <ChartFrame
      title="Where the time goes: seller handling vs carrier transit"
      subtitle="Average days per delivered order, by purchase month."
      legend={[
        { label: "Carrier transit (hand-off to delivery)", color: LATE },
        { label: "Seller handling (purchase to hand-off)", color: EARLY },
      ]}
      table={{
        caption: "Average seller handling and carrier transit days by month",
        columns: ["Month", "Seller handling (days)", "Carrier transit (days)", "Late rate"],
        align: ["left", "right", "right", "right"],
        rows: rows.map((r) => [monthLabel(r.month), r.avg_seller_handling_days.toFixed(1), r.avg_carrier_transit_days.toFixed(1), pct(r.late_rate)]),
      }}
      note="Transit rose in the months with the most late orders while handling stayed nearly flat. The data has no carrier field, so this cannot say which carriers were slow."
      height={260}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 72, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="month" {...axisProps} axisLine={{ stroke: "var(--line-strong)" }} tickFormatter={monthLabel} minTickGap={18} />
          <YAxis {...axisProps} axisLine={false} width={36} />
          <Tooltip
            cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as MonthRow;
              return (
                <TipBox
                  title={monthLabel(r.month)}
                  lines={[`Carrier transit ${r.avg_carrier_transit_days.toFixed(1)} days`, `Seller handling ${r.avg_seller_handling_days.toFixed(1)} days`, `Late rate ${pct(r.late_rate)}`]}
                />
              );
            }}
          />
          <Line type="monotone" dataKey="avg_carrier_transit_days" stroke={LATE} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }} isAnimationActive={false} label={endLabel("Transit")} />
          <Line type="monotone" dataKey="avg_seller_handling_days" stroke={EARLY} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }} isAnimationActive={false} label={endLabel("Handling")} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* 4. Routes: share of delivered vs share of late */
export function RoutesChart({ top, highest, overall, minOrders }: { top: RouteRow[]; highest: RouteRow[]; overall: number; minOrders: number }) {
  const [view, setView] = useState<"volume" | "rate">("volume");
  const data = (view === "volume" ? top.slice(0, 10) : highest).map((r) => ({ ...r }));
  const height = data.length * 34 + 40;
  return (
    <ChartFrame
      title={view === "volume" ? "Routes with the most late orders" : `Highest late rates (routes with ${minOrders}+ orders)`}
      subtitle="Route = state of the order's main seller → state of the customer."
      controls={
        <Segmented
          label="Route view"
          value={view}
          onChange={setView}
          options={[
            { value: "volume", label: "Share of orders vs share of late" },
            { value: "rate", label: "Late rate" },
          ]}
        />
      }
      legend={
        view === "volume"
          ? [
              { label: "Share of all delivered orders", color: EARLY, shape: "box" },
              { label: "Share of all late orders", color: LATE, shape: "box" },
            ]
          : [{ label: "Late rate (bar) with 95% interval in the tooltip", color: LATE, shape: "box" }]
      }
      table={{
        caption: "Late deliveries by route",
        columns: ["Route", "Delivered", "Late", "Late rate (95% interval)", "Share of delivered", "Share of late"],
        align: ["left", "right", "right", "right", "right", "right"],
        rows: data.map((r) => [
          r.route,
          num(r.delivered_orders),
          num(r.late_orders),
          `${pct(r.late_rate)} (${pct(r.late_rate_low)}–${pct(r.late_rate_high)})`,
          pct(r.share_of_delivered),
          pct(r.share_of_late),
        ]),
      }}
      note={
        view === "volume"
          ? "When the orange bar is longer than the blue one, the route produces more than its share of late orders."
          : `Dashed line: overall late rate (${pct(overall)}). Small routes have wide intervals; check the table before reading much into the order.`
      }
      height={height}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 0, left: 8 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid stroke="var(--grid)" horizontal={false} />
          <XAxis type="number" {...axisProps} axisLine={false} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
          <YAxis type="category" dataKey="route" {...axisProps} axisLine={{ stroke: "var(--line-strong)" }} width={70} tick={{ fill: "var(--ink-2)", fontSize: 12 }} />
          {view === "rate" && <ReferenceLine x={overall} stroke="var(--ink-3)" strokeDasharray="4 4" />}
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as RouteRow;
              return (
                <TipBox
                  title={r.route}
                  lines={[
                    `${num(r.late_orders)} late of ${num(r.delivered_orders)} delivered`,
                    `Late rate ${pct(r.late_rate)} (95% ${pct(r.late_rate_low)}–${pct(r.late_rate_high)})`,
                    `${pct(r.share_of_delivered)} of orders, ${pct(r.share_of_late)} of late orders`,
                    `Average review ${r.avg_score.toFixed(2)}`,
                  ]}
                />
              );
            }}
          />
          {view === "volume" ? (
            <>
              <Bar dataKey="share_of_delivered" fill={EARLY} radius={[0, 4, 4, 0]} isAnimationActive={false} />
              <Bar dataKey="share_of_late" fill={LATE} radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </>
          ) : (
            <Bar dataKey="late_rate" fill={LATE} radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: "right", fill: "var(--ink-2)", fontSize: 11, formatter: (v: unknown) => pct(Number(v)) }} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* 5. Distribution of delivery vs estimate */
export function EstimateChart({ rows, median, clampNote }: { rows: { days_vs_estimate: number; orders: number; share: number }[]; median: number; clampNote: string }) {
  return (
    <ChartFrame
      title="How far from the estimate orders arrive"
      subtitle="Delivered orders by days between delivery and the estimated date. Negative = early."
      legend={[
        { label: "On or before the estimated day", color: EARLY, shape: "box" },
        { label: "After the estimated day", color: LATE, shape: "box" },
      ]}
      table={{
        caption: "Orders by days relative to the estimated delivery date",
        columns: ["Days vs estimate", "Orders", "Share"],
        align: ["left", "right", "right"],
        rows: rows.map((r) => [String(r.days_vs_estimate), num(r.orders), pct(r.share, 2)]),
      }}
      note={`Dashed line: median (${Math.abs(median)} days early). ${clampNote}`}
      height={260}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barCategoryGap={1}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="days_vs_estimate" {...axisProps} axisLine={{ stroke: "var(--line-strong)" }} interval={9} />
          <YAxis {...axisProps} axisLine={false} width={44} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
          <ReferenceLine x={median} stroke="var(--ink-2)" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as { days_vs_estimate: number; orders: number; share: number };
              const d = r.days_vs_estimate;
              return <TipBox title={d === 0 ? "On the estimated day" : d < 0 ? `${-d} days early` : `${d} days late`} lines={[`${num(r.orders)} orders`, `${pct(r.share, 2)} of delivered`]} />;
            }}
          />
          <Bar dataKey="share" isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.days_vs_estimate} fill={r.days_vs_estimate > 0 ? LATE : EARLY} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { aggregate, dayCount, firstDay, indexOf, isoOf, lastDay, series } from "@/data/apple-health";
import { FitnessIcon } from "./FitnessIcon";

type RingSpec = { key: string; label: string; value: number | null; goal: number; unit: string; color: string };

export const GOALS = { move: 500, exercise: 30, stand: 12 };

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const n0 = (v: number | null) => (v === null ? "–" : Math.round(v).toLocaleString("en-US"));
const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const RING_COUNT = ["No rings", "One of three rings", "Two of three rings", "All three rings"];

function dayStatus(closed: number, noWatch: boolean, steps: number | null) {
  const stepText = steps === null ? "" : `${n0(steps)} steps`;
  if (noWatch) return steps === null ? "No watch or phone data for this day." : `No watch that day, so no rings. The phone counted ${stepText}.`;
  return `${RING_COUNT[closed]} closed${stepText ? `, and ${stepText}` : ""}.`;
}

export function ringsFor(i: number): RingSpec[] {
  return [
    { key: "move", label: "Move", value: series("active_energy_kcal")[i], goal: GOALS.move, unit: "kcal", color: "var(--ring-move)" },
    { key: "exercise", label: "Exercise", value: series("exercise_min")[i], goal: GOALS.exercise, unit: "min", color: "var(--ring-exercise)" },
    { key: "stand", label: "Stand", value: series("stand_hours")[i], goal: GOALS.stand, unit: "hours", color: "var(--ring-stand)" },
  ];
}

/** Most recent day on which all three rings closed. */
export function lastClosedDay(): number {
  const move = series("active_energy_kcal");
  const ex = series("exercise_min");
  const st = series("stand_hours");
  for (let i = dayCount - 1; i >= 0; i--) {
    if ((move[i] ?? 0) >= GOALS.move && (ex[i] ?? 0) >= GOALS.exercise && (st[i] ?? 0) >= GOALS.stand) return i;
  }
  return dayCount - 1;
}

const LEVELS = [
  { max: 2500, label: "under 2,500", opacity: 0.18 },
  { max: 5000, label: "2,500 to 5,000", opacity: 0.34 },
  { max: 7500, label: "5,000 to 7,500", opacity: 0.55 },
  { max: 10000, label: "7,500 to 10,000", opacity: 0.78 },
  { max: Infinity, label: "10,000 or more", opacity: 1 },
];
const levelOf = (v: number) => LEVELS.findIndex((l) => v < l.max);

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

export function DayExplorer() {
  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = Number(firstDay.slice(0, 4)); y <= Number(lastDay.slice(0, 4)); y++) ys.push(y);
    return ys;
  }, []);
  const [day, setDay] = useState(lastClosedDay);
  const [year, setYear] = useState(() => Number(isoOf(lastClosedDay()).slice(0, 4)));
  const [ringsRef, ringsSeen] = useInView<HTMLDivElement>();
  const [calRef, calSeen] = useInView<HTMLDivElement>();
  const iso = isoOf(day);
  const rings = ringsFor(day);
  const closed = rings.filter((r) => r.value !== null && r.value >= r.goal).length;

  const steps = series("steps");
  const cells = useMemo(() => {
    const jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay();
    const out: { i: number; iso: string; col: number; row: number; v: number | null; inRange: boolean }[] = [];
    for (let d = 0; d < 366; d++) {
      const date = new Date(Date.UTC(year, 0, 1 + d));
      if (date.getUTCFullYear() !== year) break;
      const isoD = date.toISOString().slice(0, 10);
      const inRange = isoD >= firstDay && isoD <= lastDay;
      const i = inRange ? indexOf(isoD) : -1;
      out.push({ i, iso: isoD, col: Math.floor((d + jan1) / 7), row: date.getUTCDay(), v: inRange ? steps[i] : null, inRange });
    }
    return out;
  }, [year, steps]);
  const yearFrom = Math.max(0, indexOf(`${year}-01-01`));
  const yearTo = indexOf(`${year}-12-31`);
  const yearTotal = aggregate("steps", yearFrom, yearTo, "sum");
  const yearDays = aggregate("steps", yearFrom, yearTo, "count") ?? 0;
  const goalDays = cells.filter((c) => (c.v ?? 0) >= 10_000).length;

  const cell = 11;
  const pitch = 14;
  const cols = 54;
  const pick = (i: number) => {
    if (i >= 0) setDay(i);
  };

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface-1">
      <div className="grid gap-8 p-5 sm:p-8 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:items-center">
        <div ref={ringsRef} className="mx-auto flex w-full max-w-[15rem] justify-center py-4">
          <FitnessIcon closed={closed === 3} play={ringsSeen} replayKey={day} />
        </div>
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3">Selected day</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-ink-1">{fmtDay(iso)}</p>
          <p className="mt-1 text-sm text-ink-3">
            {dayStatus(closed, rings.every((r) => r.value === null), steps[day])}
          </p>
          <dl className="mt-5 grid grid-cols-3 gap-3">
            {rings.map((r) => (
              <div key={r.key} className="rounded-[var(--radius-md)] border border-line bg-surface-2/60 p-3">
                <dt className="flex items-center gap-2 text-xs text-ink-3">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                  {r.label}
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-ink-1">
                  {n0(r.value)}
                  <span className="block text-[0.6875rem] font-normal text-ink-3">
                    of {n0(r.goal)} {r.unit}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <label className="mt-5 flex flex-wrap items-center gap-3 text-sm text-ink-2">
            Pick a day
            <input
              type="date"
              min={firstDay}
              max={lastDay}
              value={iso}
              onChange={(e) => {
                if (!e.target.value) return;
                setDay(indexOf(e.target.value));
                setYear(Number(e.target.value.slice(0, 4)));
              }}
              className="rounded-md border border-line-strong bg-surface-2 px-2 py-1 font-mono text-xs text-ink-1 [color-scheme:dark]"
            />
          </label>
        </div>
      </div>

      <div className="border-t border-line p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">
            <strong className="text-ink-1">{year}</strong>: {n0(yearTotal)} steps over {yearDays} days,{" "}
            {goalDays} of them at 10,000 or more.
          </p>
          <div role="group" aria-label="Year" className="inline-flex flex-wrap gap-1 rounded-[1.25rem] bg-surface-2 p-1">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={y === year}
                onClick={() => setYear(y)}
                className={`rounded-full px-2.5 py-1 font-mono text-[0.6875rem] transition-colors ${
                  y === year ? "bg-surface-3 text-ink-1 shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-ink-3 hover:text-ink-1"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
        <div ref={calRef} className={`mt-5 overflow-x-auto calendar-anim ${calSeen ? "is-visible" : ""}`}>
          <svg
            key={year}
            viewBox={`0 0 ${cols * pitch + 24} ${7 * pitch + 18}`}
            className="h-auto w-full min-w-[40rem]"
            role="img"
            aria-label={`Daily steps in ${year}, one square per day. Select a square to load that day into the rings.`}
          >
            {["Mon", "Wed", "Fri"].map((d, k) => (
              <text key={d} x={0} y={18 + (1 + k * 2) * pitch + 9} className="fill-[var(--ink-3)] font-mono text-[8px]">
                {d}
              </text>
            ))}
            {Array.from({ length: 12 }, (_, m) => {
              const d = new Date(Date.UTC(year, m, 1));
              const jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay();
              const doy = Math.round((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000);
              return (
                <text key={m} x={24 + Math.floor((doy + jan1) / 7) * pitch} y={10} className="fill-[var(--ink-3)] font-mono text-[8px]">
                  {d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}
                </text>
              );
            })}
            {cells.map((c) => {
              const selected = c.i === day && c.inRange;
              const lvl = c.v === null ? -1 : levelOf(c.v);
              return (
                <rect
                  key={c.iso}
                  x={24 + c.col * pitch}
                  y={18 + c.row * pitch}
                  width={cell}
                  height={cell}
                  rx={2.5}
                  className="cal-cell cursor-pointer"
                  style={{ ["--col" as string]: c.col }}
                  fill={lvl < 0 ? "var(--surface-3)" : "var(--series-1)"}
                  fillOpacity={lvl < 0 ? 0.6 : LEVELS[lvl].opacity}
                  stroke={selected ? "var(--ink-1)" : "none"}
                  strokeWidth={selected ? 1.5 : 0}
                  onClick={() => pick(c.i)}
                >
                  <title>{`${shortDay(c.iso)}: ${c.v === null ? "no data" : `${n0(c.v)} steps`}`}</title>
                </rect>
              );
            })}
          </svg>
        </div>
        <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-3" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-surface-3" /> no data
          </li>
          {LEVELS.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--series-1)", opacity: l.opacity }} />
              {l.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

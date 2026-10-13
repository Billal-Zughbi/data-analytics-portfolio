"use client";

import { useSyncExternalStore } from "react";

const DAY_MS = 86_400_000;
const subscribe = () => () => {};
const localMonthDay = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * One line under the hero about the visitor's date: "My best {month} {day} was in {year}, with {steps} steps."
 * Worked out in the browser so it follows the visitor's own calendar; the static HTML leaves it out.
 */
export function OnThisDay({ start, steps }: { start: string; steps: (number | null)[] }) {
  const md = useSyncExternalStore(subscribe, localMonthDay, () => null);
  if (!md) return null;

  const t0 = Date.parse(`${start}T00:00:00Z`);
  let best: { year: number; steps: number } | null = null;
  for (let i = 0; i < steps.length; i++) {
    const v = steps[i];
    if (v === null) continue;
    const iso = new Date(t0 + i * DAY_MS).toISOString();
    if (iso.slice(5, 10) === md && (!best || v > best.steps)) best = { year: Number(iso.slice(0, 4)), steps: v };
  }
  if (!best) return null;

  const date = new Date(`2000-${md}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  return (
    <>
      {" "}
      My best {date} was in {best.year}, with {best.steps.toLocaleString("en-US")} steps.
    </>
  );
}

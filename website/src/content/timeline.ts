/**
 * Moments from Billal's story, marked on twelve years of step data in the About section.
 * Dates and numbers that come from the data are read from the generated outputs, never typed in;
 * the rest come from the résumé.
 */

import { bucketed, dayCount, series, summary } from "@/data/apple-health";

export type LifeEvent = {
  /** Month the marker sits on, YYYY-MM. */
  month: string;
  /** Date as shown in the list. */
  when: string;
  text: string;
};

const monthName = (ym: string, style: "short" | "long" = "short") =>
  new Date(`${ym.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-US", { month: style, year: "numeric", timeZone: "UTC" });
const about = (v: number, step = 100) => (Math.round(v / step) * step).toLocaleString("en-US");

/** Average daily steps per month across the whole export. */
export const monthlySteps = bucketed(["steps"], 0, dayCount - 1, "month").map((r) => ({
  month: String(r.date).slice(0, 7),
  steps: typeof r.steps === "number" ? r.steps : null,
}));

const best = monthlySteps.reduce((a, b) => ((b.steps ?? -1) > (a.steps ?? -1) ? b : a));
const lowYear = summary.yearly.filter((y) => y.steps_mean !== null && y.step_days >= 300).reduce((a, b) => (b.steps_mean! < a.steps_mean! ? b : a));
const lowYearMonth = monthlySteps
  .filter((m) => m.month.startsWith(String(lowYear.year)) && m.steps !== null)
  .reduce((a, b) => (b.steps! < a.steps! ? b : a));
const strength = summary.workouts.by_year.reduce((a, b) => ((b["Strength training"] ?? 0) > (a["Strength training"] ?? 0) ? b : a));
const stepRecord = summary.records.find((r) => r.key === "steps")!;

/** Dates Annie confirmed on 13 October 2026. The copy that leans on them only shows while the data still agrees. */
const COLLEGE_START = "2018-09";
const PANDEMIC_YEAR = 2020;

export const lifeEvents: LifeEvent[] = [
  {
    month: summary.source.first_day.slice(0, 7),
    when: monthName(summary.source.first_day),
    text: "My phone started counting my steps, which is where this chart starts.",
  },
  {
    month: summary.source.watch_start.slice(0, 7),
    when: monthName(summary.source.watch_start),
    text: "I got my first Apple Watch and started closing rings.",
  },
  {
    month: best.month,
    when: monthName(best.month),
    text:
      best.month === COLLEGE_START
        ? `I started at TCNJ on the pre-med track, and that first month is still my most active on record, at about ${about(best.steps!)} steps a day.`
        : `My most active month on record, at about ${about(best.steps!)} steps a day.`,
  },
  {
    month: lowYearMonth.month,
    when: String(lowYear.year),
    text:
      lowYear.year === PANDEMIC_YEAR
        ? `The pandemic kept me at home, which made this my quietest year, at about ${about(lowYear.steps_mean!)} steps a day.`
        : `My quietest year, at about ${about(lowYear.steps_mean!)} steps a day.`,
  },
  { month: "2022-05", when: "May 2022", text: "I started my Data Analytics internship at Arconic." },
  {
    month: "2022-12",
    when: "Dec 2022",
    text: "I graduated from TCNJ, and the next month I started full time as an Analytics Engineer at Arconic.",
  },
  {
    month: `${strength.year}-07`,
    when: String(strength.year),
    text: `Strength training became part of my week, with ${strength["Strength training"]} sessions that year.`,
  },
  { month: "2025-03", when: "Mar 2025", text: "I built my first Power BI report on this data." },
  {
    month: stepRecord.date!.slice(0, 7),
    when: monthName(stepRecord.date!),
    text: `My most steps in a single day: ${stepRecord.value.toLocaleString("en-US")}.`,
  },
  {
    month: summary.source.last_day.slice(0, 7),
    when: monthName(summary.source.last_day),
    text: "I rebuilt that report on twelve years of data for this site.",
  },
];

/** Flights of stairs since the first day the phone counted one, and how that compares with Mount Rainier. */
const flights = series("flights_climbed");
const firstFlight = flights.findIndex((v) => v !== null);
const totalFlights = flights.reduce<number>((t, v) => t + (v ?? 0), 0);
/** Apple counts a flight as about 10 feet (3 meters) of elevation gain. */
const FEET_PER_FLIGHT = 10;
/** Summit elevation of Mount Rainier, as given by the National Park Service. */
const RAINIER_FT = 14_410;

export const stairs = {
  since: String(new Date(Date.parse(`${summary.source.first_day}T00:00:00Z`) + firstFlight * 86_400_000).getUTCFullYear()),
  flights: totalFlights,
  feet: totalFlights * FEET_PER_FLIGHT,
  rainiers: Math.round((totalFlights * FEET_PER_FLIGHT) / RAINIER_FT),
  rainierFt: RAINIER_FT,
};

export { monthName };

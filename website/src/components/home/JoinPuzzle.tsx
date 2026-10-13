"use client";

import { useState } from "react";

/*
 * A small, easy puzzle for the Validate step: a join that fans out and doubles a total.
 * The two days of steps are a made-up example, not data from the Apple Health project.
 */

const DAYS = [
  { day: "Mon", steps: 8000 },
  { day: "Tue", steps: 6000 },
];
const DEVICES = ["Watch", "Phone"];
const WALKED = DAYS.reduce((t, d) => t + d.steps, 0);
const n = (v: number) => v.toLocaleString("en-US");

const OPTIONS = [
  {
    key: "sum",
    text: "SUM adds every value twice.",
    reply: "Not quite. SUM adds each row once, so look at how many rows reach it.",
  },
  {
    key: "fanout",
    text: "Each day matches two rows in devices, so every day's steps show up twice.",
    reply: "That's it. Joining on day turns one row per day into one row per device. The fix is to join to something with one row per day.",
  },
  {
    key: "loaded",
    text: "The steps were loaded into daily_steps twice.",
    reply: "Not this time. daily_steps has one row per day. Take a look at the devices table.",
  },
];

function Table({ name, head, rows }: { name: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[0.6875rem] text-ink-3">{name}</p>
      <table className="mt-1.5 w-full border-collapse font-mono text-[0.6875rem]">
        <thead>
          <tr className="text-left text-ink-3">
            {head.map((h) => (
              <th key={h} scope="col" className="border-b border-line py-1 pr-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-ink-2">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="border-b border-line/60 py-1 pr-3 tabular-nums">
                  {typeof c === "number" ? n(c) : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JoinPuzzle() {
  const [answer, setAnswer] = useState<string | null>(null);
  const [fixed, setFixed] = useState(false);
  const solved = answer === "fanout";

  const rows = fixed
    ? DAYS.map((d) => ({ ...d, extra: `${DEVICES.length}`, dup: false }))
    : DAYS.flatMap((d) => DEVICES.map((dev, i) => ({ ...d, extra: dev, dup: i > 0 })));
  const total = rows.reduce((t, r) => t + r.steps, 0);
  const chosen = OPTIONS.find((o) => o.key === answer);

  return (
    <div data-xf="sql reconciliation" className="mt-14 rounded-[var(--radius-lg)] border border-line bg-surface-1 p-6 sm:p-8">
      <div className="flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em]">
        <span className="text-accent">Try it</span>
        <span className="text-ink-3">A quick puzzle for step 3</span>
        <span aria-hidden data-pin />
      </div>
      <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">Why did the total double?</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-base">
        A small version of the double counting I had to fix in my own Apple Health data. Over these two days I walked {n(WALKED)} steps, but
        this query says {n(WALKED * DEVICES.length)}.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
        <div className="min-w-0 space-y-5">
          <pre className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-bg/60 p-4 font-mono text-[0.75rem] leading-relaxed text-ink-2">
            <code>
              <span className="text-accent-2">SELECT</span> SUM(s.steps) <span className="text-accent-2">AS</span> total_steps{"\n"}
              <span className="text-accent-2">FROM</span> daily_steps <span className="text-accent-2">AS</span> s{"\n"}
              <span className={`puzzle-line ${solved && !fixed ? "is-bad" : ""} ${fixed ? "is-good" : ""}`}>
                {fixed ? (
                  <>
                    <span className="text-accent-2">JOIN</span> (<span className="text-accent-2">SELECT</span> day, COUNT(*) <span className="text-accent-2">AS</span> devices
                    {"\n"}      <span className="text-accent-2">FROM</span> devices <span className="text-accent-2">GROUP BY</span> day) <span className="text-accent-2">AS</span> d
                  </>
                ) : (
                  <>
                    <span className="text-accent-2">JOIN</span> devices <span className="text-accent-2">AS</span> d
                  </>
                )}
              </span>
              {"\n"}  <span className="text-accent-2">ON</span> d.day = s.day;
            </code>
          </pre>
          <div className="grid grid-cols-2 gap-5">
            <Table name="daily_steps" head={["day", "steps"]} rows={DAYS.map((d) => [d.day, d.steps])} />
            <Table name="devices" head={["day", "device"]} rows={DAYS.flatMap((d) => DEVICES.map((dev) => [d.day, dev]))} />
          </div>
        </div>

        <div className="min-w-0">
          <div className="rounded-[var(--radius-md)] border border-line bg-surface-2/60 p-4">
            <p className="font-mono text-[0.6875rem] text-ink-3">Rows going into SUM ({rows.length})</p>
            <ul className="mt-2 space-y-1 font-mono text-[0.6875rem]">
              {rows.map((r, i) => (
                <li
                  key={`${fixed}-${i}`}
                  className={`puzzle-row flex justify-between gap-3 rounded px-2 py-1 tabular-nums ${r.dup ? "bg-warn/10 text-warn" : "bg-surface-3/40 text-ink-2"}`}
                >
                  <span>{r.day}</span>
                  <span>{n(r.steps)}</span>
                  <span className="w-16 text-right">{fixed ? `${r.extra} devices` : r.extra}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
              <span className="font-mono text-[0.6875rem] text-ink-3">total_steps</span>
              <span className={`text-2xl font-semibold tabular-nums tracking-tight ${total === WALKED ? "text-good" : "text-warn"}`}>{n(total)}</span>
            </div>
            <p className="mt-1 text-right text-xs text-ink-3">
              {total === WALKED ? "Matches what I walked" : `Twice the ${n(WALKED)} I walked`}
            </p>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-ink-1">What went wrong?</legend>
            <div className="mt-3 space-y-2">
              {OPTIONS.map((o) => {
                const picked = answer === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={picked}
                    onClick={() => setAnswer(o.key)}
                    className={`puzzle-option w-full rounded-[var(--radius-sm)] border px-3 py-2 text-left text-sm leading-snug transition-colors ${
                      picked ? (o.key === "fanout" ? "border-good/70 bg-good/10 text-ink-1" : "border-warn/60 bg-warn/10 text-ink-1") : "border-line text-ink-2 hover:border-line-strong hover:text-ink-1"
                    }`}
                  >
                    {o.text}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <p aria-live="polite" className="mt-3 min-h-[2.5rem] text-sm leading-relaxed text-ink-2">
            {chosen?.reply}
          </p>
          {solved && (
            <button
              type="button"
              onClick={() => setFixed((v) => !v)}
              className="mt-1 inline-flex h-10 items-center rounded-full border border-line-strong px-4 text-sm font-medium text-ink-1 transition-colors hover:border-accent"
            >
              {fixed ? "Undo the fix" : "Fix the join"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

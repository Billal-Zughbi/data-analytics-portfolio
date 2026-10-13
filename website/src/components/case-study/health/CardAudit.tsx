"use client";

import { useState } from "react";
import { summary } from "@/data/apple-health";
import { Segmented } from "../ChartFrame";

const fmt = (v: number | null, unit: string) => {
  if (v === null) return "–";
  const digits = Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 100 ? 1 : 2;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: digits })} ${unit}`;
};

/** Every card on the original report: what it showed, and what the rebuild gives for the same dates. */
export function CardAudit() {
  const pages = Array.from(new Set(summary.cards.map((c) => c.page)));
  const [view, setView] = useState<"issues" | "all">("issues");
  const rows = summary.cards.filter((c) => view === "all" || c.notes.length > 0);
  return (
    <div className="space-y-4">
      <Segmented
        label="Cards to show"
        value={view}
        onChange={setView}
        options={[
          { value: "issues", label: `Cards that needed a fix (${summary.cards.filter((c) => c.notes.length).length})` },
          { value: "all", label: `All ${summary.cards.length} cards` },
        ]}
      />
      <div className="space-y-6">
        {pages.map((page) => {
          const cards = rows.filter((c) => c.page === page);
          if (!cards.length) return null;
          return (
            <div key={page}>
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3">{page}</p>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface-1">
                {cards.map((c) => (
                  <li key={c.label} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-1">{c.label}</p>
                      {c.notes.length > 0 ? (
                        <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-3">
                          {c.notes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-xs text-ink-3">Correct as shown.</p>
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-4 text-right text-xs sm:w-[16rem]">
                      <div>
                        <dt className="text-ink-3">Report showed</dt>
                        <dd className="mt-0.5 font-mono text-sm text-ink-1">{c.shown}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-3">Should have shown</dt>
                        <dd className={`mt-0.5 font-mono text-sm ${c.notes.length ? "text-warn" : "text-ink-2"}`}>
                          {fmt(c.corrected, c.corrected_unit)}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

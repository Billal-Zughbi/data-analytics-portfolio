"use client";

import { useEffect, useRef, useState } from "react";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Each ring fills while you read two sections of the home page. */
const RINGS = [
  { key: "move", label: "Move", color: "var(--ring-move)", sections: ["projects", "workflow"], names: "Projects and How I work", r: 17 },
  { key: "exercise", label: "Exercise", color: "var(--ring-exercise)", sections: ["experience", "skills"], names: "Experience and Toolkit", r: 11 },
  { key: "stand", label: "Stand", color: "var(--ring-stand)", sections: ["about", "contact"], names: "About and Contact", r: 5 },
] as const;

const SPARK_COLORS = ["var(--ring-move)", "var(--ring-exercise)", "var(--ring-stand)"];
const pct = (p: number) => `${Math.round(p * 100)}%`;

/**
 * Activity-style reading rings in the corner of the home page. They close as you scroll through the
 * page and celebrate once when all three are closed. Purely a bonus: the page reads the same without them.
 */
export function ReadingRings() {
  const [progress, setProgress] = useState([0, 0, 0]);
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [toast, setToast] = useState(false);
  const best = useRef([0, 0, 0]);
  const done = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const point = y + window.innerHeight * 0.7;
      const atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 4;
      const next = RINGS.map((ring, i) => {
        const els = ring.sections.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
        if (!els.length) return best.current[i];
        const top = els[0].getBoundingClientRect().top + y;
        const last = els[els.length - 1].getBoundingClientRect();
        const bottom = last.bottom + y;
        const p = atEnd && point > top ? 1 : Math.min(1, Math.max(0, (point - top) / Math.max(1, bottom - top)));
        return Math.max(best.current[i], p);
      });
      best.current = next;
      setProgress(next);
      setShown(y > window.innerHeight * 0.45);
      if (!done.current && next.every((p) => p >= 0.999)) {
        done.current = true;
        setCelebrate(true);
        setToast(true);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(false), 9000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const allClosed = progress.every((p) => p >= 0.999);
  const summary = RINGS.map((r, i) => `${r.label} ${pct(progress[i])}`).join(", ");

  return (
    <div
      ref={wrap}
      className={`rings-dock fixed bottom-3 right-3 z-40 sm:bottom-5 sm:right-5 ${shown || open ? "is-shown" : ""}`}
    >
      {open && (
        <div
          id="reading-rings-panel"
          className="absolute bottom-[calc(100%+0.75rem)] right-0 w-[17.5rem] rounded-[var(--radius-md)] border border-line-strong bg-surface-2/95 p-4 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)] backdrop-blur-md"
        >
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-ink-3">Reading rings</p>
          <p className="mt-2 text-sm leading-snug text-ink-2">
            {allClosed ? "All three rings are closed. Thanks for reading!" : "Each ring fills as you read part of the page."}
          </p>
          <ul className="mt-4 space-y-3">
            {RINGS.map((r, i) => (
              <li key={r.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-baseline gap-2">
                    <span aria-hidden className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: r.color }} />
                    <span className="font-semibold text-ink-1">{r.label}</span>
                    <a href={`#${r.sections[0]}`} onClick={() => setOpen(false)} className="text-ink-3 underline-offset-2 hover:text-ink-1 hover:underline">
                      {r.names}
                    </a>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-ink-2">{pct(progress[i])}</span>
                </div>
                <div aria-hidden className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full transition-[width] duration-300" style={{ width: pct(progress[i]), background: r.color }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="rings-toast absolute bottom-[calc(100%+0.75rem)] right-0 flex w-[17.5rem] items-center gap-3 rounded-[var(--radius-md)] border border-line-strong bg-surface-2/95 p-3 pr-2 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)] backdrop-blur-md"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static export; the supplied icon, unedited */}
          <img src={`${base}/images/apple-fitness.png`} alt="" width={44} height={44} className="ring-celebrate h-11 w-11 shrink-0" />
          <p className="flex-1 text-sm leading-snug text-ink-1">All three rings closed. Thanks for reading all the way to the end!</p>
          <button type="button" onClick={() => setToast(false)} className="xf-btn h-7 min-w-7 self-start" aria-label="Dismiss">
            <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <button
        type="button"
        aria-expanded={open}
        aria-controls="reading-rings-panel"
        aria-label={`Reading progress: ${summary}. ${open ? "Hide" : "Show"} details`}
        onClick={() => {
          setOpen((v) => !v);
          setToast(false);
        }}
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-surface-1/90 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.9)] backdrop-blur-md transition-colors hover:border-accent"
      >
        <svg viewBox="0 0 40 40" aria-hidden className={`h-10 w-10 ${celebrate ? "ring-celebrate" : ""}`} key={celebrate ? "spin" : "still"}>
          {RINGS.map((r, i) => {
            const c = 2 * Math.PI * r.r;
            return (
              <g key={r.key} transform="rotate(-90 20 20)">
                <circle cx="20" cy="20" r={r.r} fill="none" stroke={r.color} strokeOpacity="0.22" strokeWidth="5" />
                <circle
                  cx="20"
                  cy="20"
                  r={r.r}
                  fill="none"
                  stroke={r.color}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - progress[i])}
                  opacity={progress[i] > 0.005 ? 1 : 0}
                  className="transition-[stroke-dashoffset] duration-300 ease-out"
                />
              </g>
            );
          })}
        </svg>
        {celebrate &&
          Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const dist = 44 + (i % 3) * 10;
            return (
              <span
                key={i}
                aria-hidden
                className="ring-spark pointer-events-none absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 rounded-full"
                style={
                  {
                    background: SPARK_COLORS[i % 3],
                    "--dx": `${Math.cos(angle) * dist}px`,
                    "--dy": `${Math.sin(angle) * dist}px`,
                    animationDelay: `${900 + (i % 4) * 40}ms`,
                    opacity: 0,
                  } as React.CSSProperties
                }
              />
            );
          })}
      </button>
    </div>
  );
}

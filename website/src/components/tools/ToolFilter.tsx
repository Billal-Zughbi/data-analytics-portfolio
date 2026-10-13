"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toolBySlug } from "@/content/tools";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Mark = { at: number; i: number };

/**
 * Where each match sits on the page, from 0 (top) to 1 (bottom), for the rail. Matches closer together
 * than a rail dot share one dot, which jumps to the first of them.
 */
function positions(els: HTMLElement[]): Mark[] {
  const h = document.documentElement.scrollHeight;
  const gap = 14 / Math.max(1, window.innerHeight - 192); // 14 px on the rail, which is the viewport minus 2 × 6rem
  const all = els
    .map((el, i) => {
      const r = el.getBoundingClientRect();
      return { at: Math.min(1, Math.max(0, (r.top + window.scrollY + r.height / 2) / h)), i };
    })
    .sort((a, b) => a.at - b.at);
  const kept: Mark[] = [];
  for (const m of all) if (!kept.length || m.at - kept[kept.length - 1].at >= gap) kept.push(m);
  return kept;
}

/**
 * Cross-filtering for the home page, the way a slicer filters a Power BI report page.
 *
 * Clicking any tool button (data-tool) selects that tool: elements tagged with it (data-xf) light up and
 * show its logo at their [data-pin] spot, everything else that is tagged dims, and mentions of the tool in
 * text are highlighted. A bar at the bottom counts the matches and steps through them; on wide screens a
 * rail on the right edge marks where they are on the page. Escape or "Clear" removes the filter.
 *
 * All content stays in the page and readable while filtered; the filter only changes emphasis.
 */
export function ToolFilter() {
  const [active, setActive] = useState<string | null>(null);
  const [hits, setHits] = useState<HTMLElement[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [message, setMessage] = useState("");
  const activeRef = useRef<string | null>(null);
  const origin = useRef<DOMRect | null>(null);
  const barLogo = useRef<HTMLSpanElement>(null);
  const lastButton = useRef<HTMLElement | null>(null);

  // Applies a filter (or clears it with null) to the page, then updates the bar.
  const apply = useCallback((slug: string | null) => {
    activeRef.current = slug;
    const root = document.documentElement;
    const tool = slug ? toolBySlug[slug] : null;
    if (tool) {
      root.dataset.xfActive = tool.slug;
      root.style.setProperty("--xf-color", tool.color ?? "var(--accent)");
      root.style.setProperty("--xf-logo", tool.logo ? `url("${base}${tool.logo}")` : "none");
      root.style.setProperty("--xf-pin-bg", tool.plate ? "#f4f3ef" : "var(--surface-2)");
    } else {
      delete root.dataset.xfActive;
      for (const v of ["--xf-color", "--xf-logo", "--xf-pin-bg"]) root.style.removeProperty(v);
    }
    root.classList.toggle("xf-has-logo", Boolean(tool?.logo));

    document.querySelectorAll<HTMLElement>("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === slug)));

    const found: HTMLElement[] = [];
    document.querySelectorAll<HTMLElement>("[data-xf], [data-xf-text]").forEach((el) => {
      const slugs = (el.getAttribute("data-xf") ?? el.getAttribute("data-xf-text") ?? "").split(" ");
      const hit = Boolean(slug && slugs.includes(slug));
      el.classList.toggle("xf-hit", hit);
      el.classList.toggle("xf-dim", Boolean(slug) && !hit && el.hasAttribute("data-xf"));
      if (hit) {
        el.style.setProperty("--xf-i", String(found.length));
        found.push(el);
      }
    });
    document.querySelectorAll<HTMLElement>("[data-mention]").forEach((m) => m.classList.toggle("xf-mark", m.dataset.mention === slug));

    setActive(slug);
    setHits(found);
    setCursor(-1);
    setMarks(positions(found));
    setMessage(
      tool
        ? found.length
          ? `Filtered to ${tool.name}: ${found.length} ${found.length === 1 ? "place" : "places"} on this page. Press Escape to clear.`
          : `${tool.name} is listed under my skills and doesn't come up anywhere else on this page.`
        : "Filter cleared.",
    );
  }, []);

  // One listener for every tool button on the page.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest<HTMLElement>("[data-tool]");
      if (!btn?.dataset.tool) return;
      e.preventDefault();
      lastButton.current = btn;
      origin.current = (btn.querySelector("img, .logo-plate") ?? btn).getBoundingClientRect();
      apply(activeRef.current === btn.dataset.tool ? null : btn.dataset.tool);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeRef.current) apply(null);
    };
    document.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [apply]);

  // Keep the rail in step with layout changes.
  useEffect(() => {
    if (!hits.length) return;
    const ro = new ResizeObserver(() => setMarks(positions(hits)));
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [hits]);

  // The bar's logo flies in from the button that was clicked.
  useLayoutEffect(() => {
    const el = barLogo.current;
    const from = origin.current;
    if (!active || !el || !from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = el.getBoundingClientRect();
    if (!to.width) return;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const s = Math.max(0.5, Math.min(2.4, from.width / to.width));
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.4 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ],
      { duration: 650, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [active]);

  const go = (i: number) => {
    const el = hits[i];
    if (!el) return;
    setCursor(i);
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    el.classList.remove("xf-flash");
    void el.offsetWidth;
    el.classList.add("xf-flash");
  };

  const clear = () => {
    apply(null);
    lastButton.current?.focus({ preventScroll: true });
  };

  const tool = active ? toolBySlug[active] : null;
  const n = hits.length;

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {message}
      </p>

      {tool && (
        <div
          role="region"
          aria-label="Page filter"
          className="xf-bar fixed bottom-3 left-3 right-[4.25rem] z-40 flex items-center gap-2 rounded-full border border-line-strong bg-surface-2/95 py-1.5 pl-2 pr-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.9)] backdrop-blur-md sm:bottom-5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:pl-2.5"
        >
          <span ref={barLogo} aria-hidden className="xf-bar-logo flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            {tool.logo ? (
              tool.plate ? (
                <span className="logo-plate" style={{ width: 24, height: 24 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
                  <img src={`${base}${tool.logo}`} alt="" style={{ height: 12 }} />
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- static export
                <img src={`${base}${tool.logo}`} alt="" width={22} height={22} className="h-[1.375rem] w-[1.375rem]" />
              )
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--xf-color)] shadow-[0_0_12px_var(--xf-color)]" />
            )}
          </span>
          {/* On phones the tool name and the count sit on two lines, so a long name never hides the count. */}
          <p className="min-w-0 flex-1 text-sm leading-tight sm:flex-none sm:truncate">
            <span className="hidden font-mono text-[0.625rem] uppercase tracking-[0.14em] text-ink-3 sm:inline">Filter </span>
            <span className="block truncate font-semibold text-ink-1 sm:inline">{tool.name}</span>
            <span className="hidden text-ink-3 sm:inline"> · </span>
            <span className="block truncate text-xs text-ink-2 sm:inline sm:text-sm">
              {n ? (
                <>
                  {cursor >= 0 ? `${cursor + 1} of ${n}` : `${n} ${n === 1 ? "place" : "places"}`}
                  <span className="hidden sm:inline"> on this page</span>
                </>
              ) : (
                "only in my skills"
              )}
            </span>
          </p>
          {n > 0 && (
            <span className="flex shrink-0 items-center">
              <button type="button" onClick={() => go((cursor - 1 + n) % n)} className="xf-btn" aria-label="Previous match">
                <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 10l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" onClick={() => go((cursor + 1) % n)} className="xf-btn" aria-label="Next match">
                <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={clear}
            className="xf-btn gap-1 px-2.5 text-xs font-medium"
            aria-label={`Clear the ${tool.name} filter`}
          >
            <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      )}

      {tool && marks.length > 0 && (
        <div aria-hidden className="xf-rail pointer-events-none fixed bottom-24 right-2 top-24 z-30 hidden w-3 lg:block">
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line-strong" />
          {marks.map((m, k) => (
            <button
              key={m.i}
              type="button"
              tabIndex={-1}
              onClick={() => go(m.i)}
              className="xf-mark-dot pointer-events-auto absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ top: `${m.at * 100}%`, ["--xf-i" as string]: k }}
            />
          ))}
        </div>
      )}
    </>
  );
}

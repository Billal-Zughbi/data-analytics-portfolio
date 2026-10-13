"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toolBySlug, type Tool } from "@/content/tools";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** At most this many logos are stacked on one spot when several selected tools match it. */
const MAX_PINS = 3;

type Mark = { at: number; i: number; color: string };

const colorOf = (tool: Tool) => tool.color ?? "var(--accent)";
const names = (slugs: string[]) => new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(slugs.map((s) => toolBySlug[s].name));

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
      const at = Math.min(1, Math.max(0, (r.top + window.scrollY + r.height / 2) / h));
      return { at, i, color: el.style.getPropertyValue("--xf-color") || "var(--accent)" };
    })
    .sort((a, b) => a.at - b.at);
  const kept: Mark[] = [];
  for (const m of all) if (!kept.length || m.at - kept[kept.length - 1].at >= gap) kept.push(m);
  return kept;
}

/** Fades the edges of the bar's tool list where more tools are scrolled out of view. */
function edgeFade(list: HTMLElement | null) {
  if (!list) return;
  const left = list.scrollLeft > 2;
  const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 2;
  list.dataset.fade = left && right ? "both" : left ? "left" : right ? "right" : "";
}

/** One logo (or a colored dot, for tools without a logo) pinned to a matching spot. */
function pin(tool: Tool, delay: number) {
  const el = document.createElement("span");
  el.className = tool.logo ? "xf-pin" : "xf-pin xf-pin-dot";
  el.dataset.slug = tool.slug;
  el.style.setProperty("--pin-color", colorOf(tool));
  if (tool.logo) {
    el.style.setProperty("--pin-logo", `url("${base}${tool.logo}")`);
    el.style.setProperty("--pin-bg", tool.plate ? "#f4f3ef" : "var(--surface-2)");
  }
  el.style.animationDelay = `${delay * 50}ms`;
  return el;
}

/**
 * Cross-filtering for the home page, the way a slicer filters a Power BI report page.
 *
 * Clicking a tool button (data-tool) adds that tool to the filter, and clicking it again takes it out, so
 * several tools can be selected at once. Elements tagged with any selected tool (data-xf) light up and show
 * the matching logos at their [data-pin] spot, everything else that is tagged dims, and mentions of the
 * selected tools in text are highlighted in each tool's color. A bar at the bottom lists the selected tools
 * with their counts, counts the matches and steps through them; on wide screens a rail on the right edge
 * marks where they are on the page. Escape or "Clear" removes the whole filter.
 *
 * All content stays in the page and readable while filtered; the filter only changes emphasis.
 */
export function ToolFilter() {
  const [selected, setSelected] = useState<string[]>([]);
  const [hits, setHits] = useState<HTMLElement[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [cursor, setCursor] = useState(-1);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [message, setMessage] = useState("");
  const selectedRef = useRef<string[]>([]);
  const added = useRef<{ slug: string; from: DOMRect } | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const lastButton = useRef<HTMLElement | null>(null);

  // Applies the selection (an empty list clears the filter) to the page, then updates the bar.
  const apply = useCallback((next: string[]) => {
    selectedRef.current = next;
    const root = document.documentElement;
    if (next.length) root.dataset.xfActive = next.join(" ");
    else delete root.dataset.xfActive;

    document.querySelectorAll<HTMLElement>("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(next.includes(b.dataset.tool ?? ""))));

    const found: HTMLElement[] = [];
    const perTool: Record<string, number> = Object.fromEntries(next.map((s) => [s, 0]));
    let fresh = 0;
    document.querySelectorAll<HTMLElement>("[data-xf], [data-xf-text]").forEach((el) => {
      const tags = (el.getAttribute("data-xf") ?? el.getAttribute("data-xf-text") ?? "").split(" ");
      const matched = next.filter((s) => tags.includes(s));
      const hit = matched.length > 0;
      el.classList.toggle("xf-hit", hit);
      el.classList.toggle("xf-dim", next.length > 0 && !hit && el.hasAttribute("data-xf"));
      if (hit) el.style.setProperty("--xf-color", colorOf(toolBySlug[matched[0]]));
      else el.style.removeProperty("--xf-color");

      // Logos already pinned stay put; only newly matching tools pop in, so adding a tool doesn't replay the rest.
      const want = matched.slice(0, MAX_PINS);
      el.querySelectorAll<HTMLElement>("[data-pin]").forEach((spot) => {
        if (spot.closest("[data-xf], [data-xf-text]") !== el) return;
        const have = new Set<string>();
        spot.querySelectorAll<HTMLElement>(":scope > .xf-pin").forEach((p) => {
          if (want.includes(p.dataset.slug ?? "")) have.add(p.dataset.slug ?? "");
          else p.remove();
        });
        for (const s of want) if (!have.has(s)) spot.append(pin(toolBySlug[s], Math.min(fresh++, 12)));
      });

      if (hit) {
        for (const s of matched) perTool[s] += 1;
        found.push(el);
      }
    });
    document.querySelectorAll<HTMLElement>("[data-mention]").forEach((m) => {
      const slug = m.dataset.mention ?? "";
      const on = next.includes(slug);
      m.classList.toggle("xf-mark", on);
      if (on) m.style.setProperty("--xf-color", colorOf(toolBySlug[slug]));
      else m.style.removeProperty("--xf-color");
    });

    setSelected(next);
    setHits(found);
    setCounts(perTool);
    setCursor(-1);
    setMarks(positions(found));
    setMessage(
      !next.length
        ? "Filter cleared."
        : found.length
          ? `Filtered to ${names(next)}: ${found.length} ${found.length === 1 ? "place" : "places"} on this page. Press Escape to clear.`
          : `${names(next)} ${next.length === 1 ? "is" : "are"} listed under my skills and ${next.length === 1 ? "doesn't" : "don't"} come up anywhere else on this page.`,
    );
  }, []);

  // One listener for every tool button on the page: a click adds the tool, a second click takes it out.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest<HTMLElement>("[data-tool]");
      const slug = btn?.dataset.tool;
      if (!btn || !slug) return;
      e.preventDefault();
      lastButton.current = btn;
      const current = selectedRef.current;
      if (current.includes(slug)) {
        apply(current.filter((s) => s !== slug));
      } else {
        added.current = { slug, from: (btn.querySelector("img, .logo-plate") ?? btn).getBoundingClientRect() };
        apply([...current, slug]);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedRef.current.length) apply([]);
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
    const ro = new ResizeObserver(() => {
      setMarks(positions(hits));
      edgeFade(chipsRef.current);
    });
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [hits]);

  // A newly added tool's logo flies into its place in the bar from the button that was clicked.
  useLayoutEffect(() => {
    const a = added.current;
    added.current = null;
    const chips = chipsRef.current;
    if (!chips) return;
    if (a) chips.scrollLeft = chips.scrollWidth; // the newest tool is last; keep it in view
    edgeFade(chips);
    if (!a) return;
    const logo = chips.querySelector<HTMLElement>(`[data-chip="${a.slug}"] .xf-chip-logo`);
    if (!logo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = logo.getBoundingClientRect();
    if (!to.width) return;
    const dx = a.from.left + a.from.width / 2 - (to.left + to.width / 2);
    const dy = a.from.top + a.from.height / 2 - (to.top + to.height / 2);
    const s = Math.max(0.5, Math.min(2.4, a.from.width / to.width));
    logo.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.4 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ],
      { duration: 650, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [selected]);

  const go = (i: number) => {
    const el = hits[i];
    if (!el) return;
    setCursor(i);
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    el.classList.remove("xf-flash");
    void el.offsetWidth;
    el.classList.add("xf-flash");
  };

  // Takes one tool out from its chip in the bar, then keeps keyboard focus in the bar.
  const remove = (slug: string, index: number) => {
    const next = selectedRef.current.filter((s) => s !== slug);
    apply(next);
    requestAnimationFrame(() => {
      const xs = chipsRef.current?.querySelectorAll<HTMLButtonElement>(".xf-chip-x");
      const target = xs?.length ? xs[Math.min(index, xs.length - 1)] : lastButton.current;
      target?.focus({ preventScroll: true });
    });
  };

  const clear = () => {
    apply([]);
    lastButton.current?.focus({ preventScroll: true });
  };

  const chosen = selected.map((s) => toolBySlug[s]);
  const n = hits.length;

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {message}
      </p>

      {chosen.length > 0 && (
        <div
          role="region"
          aria-label="Page filter"
          className="xf-bar fixed bottom-3 left-3 right-[4.25rem] z-40 flex flex-col gap-1 rounded-[1.375rem] border border-line-strong bg-surface-2/95 p-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.9)] backdrop-blur-md sm:bottom-5 sm:left-1/2 sm:right-auto sm:max-w-[min(60rem,calc(100vw-2.5rem))] sm:-translate-x-1/2 sm:flex-row sm:items-center sm:gap-2 sm:rounded-full sm:pl-2.5"
        >
          {/* The selected tools, in the order they were picked. On phones they scroll sideways above the controls. */}
          <div ref={chipsRef} onScroll={(e) => edgeFade(e.currentTarget)} className="xf-chips flex min-w-0 items-center gap-1.5 overflow-x-auto">
            <span className="hidden shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-ink-3 sm:inline">Filter</span>
            {chosen.map((t, i) => (
              <span
                key={t.slug}
                data-chip={t.slug}
                className="xf-chip flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-0.5"
                style={{ ["--tool" as string]: colorOf(t) }}
              >
                <span aria-hidden className="xf-chip-logo flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                  {t.logo ? (
                    t.plate ? (
                      <span className="logo-plate" style={{ width: 20, height: 20 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
                        <img src={`${base}${t.logo}`} alt="" style={{ height: 10 }} />
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- static export
                      <img src={`${base}${t.logo}`} alt="" width={18} height={18} className="h-[1.125rem] w-[1.125rem]" />
                    )
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-[var(--tool)] shadow-[0_0_10px_var(--tool)]" />
                  )}
                </span>
                <span className="whitespace-nowrap text-sm font-semibold leading-none text-ink-1">{t.name}</span>
                <span className="whitespace-nowrap rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[0.625rem] leading-none text-ink-2">
                  {counts[t.slug] ? counts[t.slug] : "skills only"}
                </span>
                <button type="button" onClick={() => remove(t.slug, i)} className="xf-chip-x" aria-label={`Remove ${t.name} from the filter`}>
                  <svg viewBox="0 0 16 16" aria-hidden className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1 pl-2 sm:pl-0">
            <p className="mr-auto whitespace-nowrap text-xs text-ink-2 sm:mr-0 sm:pl-1 sm:text-sm">
              {n ? (
                <>
                  {cursor >= 0 ? `${cursor + 1} of ${n}` : `${n} ${n === 1 ? "place" : "places"}`}
                  <span className="hidden sm:inline"> on this page</span>
                </>
              ) : (
                "Only in my skills"
              )}
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
            <button type="button" onClick={clear} className="xf-btn gap-1 px-2.5 text-xs font-medium" aria-label="Clear the filter">
              <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>
      )}

      {chosen.length > 0 && marks.length > 0 && (
        <div aria-hidden className="xf-rail pointer-events-none fixed bottom-24 right-2 top-24 z-30 hidden w-3 lg:block">
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line-strong" />
          {marks.map((m, k) => (
            <button
              key={m.i}
              type="button"
              tabIndex={-1}
              onClick={() => go(m.i)}
              className="xf-mark-dot pointer-events-auto absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ top: `${m.at * 100}%`, ["--xf-i" as string]: k, ["--xf-color" as string]: m.color }}
            />
          ))}
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef } from "react";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The SVG is drawn 1:1 on 1280 x 800 elevation-tile pixels, each about 26.14 m across at Mount Rainier (zoom 12). */
const MAP = { width: 1280, height: 800, metersPerPixel: 26.14 };

/**
 * Contour lines of Mount Rainier (drawn by scripts/rainier_contours.py from USGS elevation data)
 * as a faint background, with a small map legend in the top corner. Where a mouse is moving, the
 * lines near the pointer light up. Decorative only: hidden from assistive technology (the footer
 * says what the lines are) and never in the way of clicks.
 */
export function Topo({ className = "", captionTop = "1rem" }: { className?: string; captionTop?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    const host = el.parentElement ?? el;
    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${x - r.left}px`);
      el.style.setProperty("--my", `${y - r.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      el.classList.add("is-lit");
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => el.classList.remove("is-lit");
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`topo pointer-events-none absolute inset-0 ${className}`}
      style={{
        ["--topo" as string]: `url("${base}/images/rainier-contours.svg")`,
        ["--map-w" as string]: MAP.width,
        ["--map-h" as string]: MAP.height,
        ["--km" as string]: 1000 / MAP.metersPerPixel,
      }}
    >
      <span className="topo-lines" />
      <span className="topo-lit" />
      <div
        className="topo-caption absolute inset-x-0 mx-auto flex max-w-6xl flex-col items-end gap-1 px-4 font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-ink-3 sm:px-6 md:pr-9"
        style={{ top: captionTop }}
      >
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 10 9" className="topo-peak h-[0.5625rem] w-2.5">
            <path d="M5 1 9 8H1Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          Mount Rainier, WA
        </span>
        <span>Contour lines every 100 m</span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="topo-scale" />1 km
        </span>
      </div>
    </div>
  );
}

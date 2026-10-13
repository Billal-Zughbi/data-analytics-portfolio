"use client";

import { useEffect, useRef } from "react";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Contour lines of Mount Rainier (drawn by scripts/rainier_contours.py from USGS elevation data)
 * as a faint background. Where a mouse is moving, the lines near the pointer light up.
 * Decorative only: hidden from assistive technology and never in the way of clicks.
 */
export function Topo({ className = "" }: { className?: string }) {
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
      style={{ ["--topo" as string]: `url("${base}/images/rainier-contours.svg")` }}
    >
      <span className="topo-lines" />
      <span className="topo-lit" />
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { HeroFallback } from "./HeroFallback";

const DataFlowScene = dynamic(() => import("./DataFlowScene"), { ssr: false });

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Decides how to show the hero visual:
 *  - static SVG on the server and until WebGL is ready (and forever without WebGL);
 *  - the animated scene when WebGL works;
 *  - a single still frame when the visitor prefers reduced motion;
 *  - paused while the hero is scrolled out of view.
 */
export function HeroVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [inView, setInView] = useState(true);
  const [dense, setDense] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    // Defer WebGL start-up until the browser is idle so text paints first.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const handle = idle(() => {
      setDense(window.innerWidth >= 768);
      setWebgl(supportsWebGL());
    });
    return () => {
      mq.removeEventListener("change", update);
      if (window.cancelIdleCallback && typeof handle === "number") window.cancelIdleCallback(handle);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,black_14%,black_90%,transparent)]"
    >
      <HeroFallback
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}
      />
      {webgl && (
        <div className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`}>
          <DataFlowScene animate={!reduceMotion && inView} dense={dense} onReady={() => setReady(true)} />
        </div>
      )}
    </div>
  );
}

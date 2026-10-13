"use client";

import { usePrefersReducedMotion } from "./motion";

const SPARK_COLORS = ["var(--ring-move)", "var(--ring-exercise)", "var(--ring-stand)"];

/**
 * The Apple Fitness icon, shown exactly as supplied (the file is unchanged; CSS only rounds off the
 * white corners around it). On a day with all three rings closed it spins once and throws a few
 * sparks, replaying whenever `replayKey` changes. The day's numbers are always printed beside it.
 */
export function FitnessIcon({ closed, play, replayKey }: { closed: boolean; play: boolean; replayKey: string | number }) {
  const reduced = usePrefersReducedMotion();
  const celebrate = closed && play && !reduced;
  return (
    <div className="relative mx-auto h-[148px] w-[148px]">
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, image is served unchanged */}
      <img
        key={celebrate ? `spin-${replayKey}` : "still"}
        src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/images/apple-fitness.png`}
        alt="Apple Fitness icon"
        width={148}
        height={148}
        className={`block h-[148px] w-[148px] [clip-path:inset(2px_round_26%)] ${celebrate ? "ring-celebrate" : ""}`}
      />
      {celebrate &&
        Array.from({ length: 14 }, (_, i) => {
          const angle = (i / 14) * Math.PI * 2;
          const dist = 96 + (i % 3) * 12;
          return (
            <span
              key={`${replayKey}-${i}`}
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
    </div>
  );
}

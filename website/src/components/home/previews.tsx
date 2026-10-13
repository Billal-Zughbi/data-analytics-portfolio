import { bucketed, dayCount, firstDay, lastDay } from "@/data/apple-health";
import type { CardPreview } from "./ProjectCard";

/* Small server-rendered previews for the project cards, drawn from each project's generated data. */

/** Sparkline of average daily steps per month, drawn on the server from the real daily series. */
function StepsSparkline() {
  const values = bucketed(["steps"], 0, dayCount - 1, "month").map((r) => (typeof r.steps === "number" ? r.steps : null));
  const nums = values.filter((v): v is number => v !== null);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const w = 560;
  const h = 150;
  const pts = values
    .map((v, i) => (v === null ? null : [(i / (values.length - 1)) * w, h - ((v - min) / (max - min)) * (h - 16) - 8]))
    .filter((p): p is number[] => p !== null);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const area = `${d}L${w},${h}L0,${h}Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="var(--grid)" />
      ))}
      <path d={area} fill="url(#spark-fill)" />
      <path
        d={d}
        fill="none"
        stroke="var(--series-1)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        className="spark-line"
        pathLength={1}
      />
    </svg>
  );
}


export function previewFor(slug: string): CardPreview {
  switch (slug) {
    case "apple-health-analytics":
      return { label: `Average daily steps per month · ${firstDay.slice(0, 4)} to ${lastDay.slice(0, 4)}`, badge: "real data", node: <StepsSparkline /> };
    default:
      throw new Error(`No card preview for ${slug}`);
  }
}

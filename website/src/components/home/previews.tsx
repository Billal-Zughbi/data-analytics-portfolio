import { weekly } from "@/data/apple-health";
import { reviewByDelay } from "@/data/olist";
import { lagByYear } from "@/data/kev";
import type { CardPreview } from "./ProjectCard";

/* Small server-rendered previews for the project cards, drawn from each project's generated data. */

/** Sparkline of the synthetic weekly step series, drawn on the server. */
function StepsSparkline() {
  const values = weekly.map((r) => (typeof r.steps === "number" ? r.steps : null));
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


/** Average review score by delivery timing bucket (Olist). */
function ReviewBars() {
  const w = 560;
  const h = 150;
  const gap = 10;
  const bw = (w - gap * (reviewByDelay.length - 1)) / reviewByDelay.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="var(--grid)" />
      ))}
      {reviewByDelay.map((r, i) => {
        const bh = ((r.avg_score - 1) / 4) * (h - 8);
        return (
          <rect
            key={r.delay_bucket}
            x={i * (bw + gap)}
            y={h - bh}
            width={bw}
            height={bh}
            rx={4}
            fill={r.delay_bucket.startsWith("late") ? "var(--series-2)" : "var(--series-1)"}
            opacity={0.9}
          />
        );
      })}
    </svg>
  );
}

/** Age of CVEs at KEV listing, stacked share per year added. */
function ListingAgeBars() {
  const rows = lagByYear.by_added_year;
  const w = 560;
  const h = 150;
  const gap = 14;
  const bw = (w - gap * (rows.length - 1)) / rows.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      {rows.map((r, i) => {
        const parts = [
          [r.share_within_30d, "var(--series-1)"],
          [Math.max(0, 1 - r.share_within_30d - r.share_over_1y), "var(--neutral-mid)"],
          [r.share_over_1y, "var(--series-2)"],
        ] as const;
        let y = h;
        return (
          <g key={r.added_year}>
            {parts.map(([share, fill], j) => {
              const ph = share * h;
              y -= ph;
              return <rect key={j} x={i * (bw + gap)} y={y + 1} width={bw} height={Math.max(0, ph - 2)} rx={3} fill={fill} opacity={0.9} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

export function previewFor(slug: string): CardPreview {
  switch (slug) {
    case "apple-health-analytics":
      return { label: "Average daily steps · weekly", badge: "synthetic data", node: <StepsSparkline /> };
    case "olist-delivery-experience":
      return { label: "Avg review stars · early → late", node: <ReviewBars /> };
    case "known-exploited-vulnerabilities":
      return { label: "Age of CVEs when listed · 2021 → 2026", node: <ListingAgeBars /> };
    default:
      throw new Error(`No card preview for ${slug}`);
  }
}

import Link from "next/link";
import type { Project } from "@/content/projects";
import { ArrowRight } from "@/components/icons";
import { weekly } from "@/data/apple-health";

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

export function ProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <article className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface-1 transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-line-strong">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(600px_circle_at_80%_0%,rgb(79_216_255/0.08),transparent_60%)]"
      />
      <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative p-6 sm:p-10">
          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
            <span className="text-accent">P{String(index + 1).padStart(2, "0")}</span>
            <span>Flagship case study</span>
          </div>
          <h3 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Link
              href={`/projects/${project.slug}/`}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {project.title}
            </Link>
          </h3>
          <p className="mt-4 text-base leading-relaxed text-ink-2 text-pretty">{project.summary}</p>
          <p className="mt-5 border-l-2 border-accent/60 pl-4 text-sm leading-relaxed text-ink-2">
            <span className="block font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Question</span>
            {project.question}
          </p>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Tools">
            {project.stack.map((s) => (
              <li key={s} className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-ink-2">
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-accent">
            Read the case study
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </p>
        </div>

        <div className="relative border-t border-line bg-surface-2/50 p-6 sm:p-10 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
            <span>Average daily steps · weekly</span>
            <span className="rounded-full border border-warn/40 px-2 py-0.5 text-warn normal-case tracking-normal">
              synthetic data
            </span>
          </div>
          <div className="mt-6 h-40">
            <StepsSparkline />
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-ink-2">
            {project.demonstrates.map((d) => (
              <li key={d} className="flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-2" />
                {d}
              </li>
            ))}
          </ul>
          <p className="mt-6 font-mono text-[11px] leading-relaxed text-ink-3">{project.dataNote}</p>
        </div>
      </div>
    </article>
  );
}

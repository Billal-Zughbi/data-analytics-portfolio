import Link from "next/link";
import type { Project } from "@/content/projects";
import { ArrowRight } from "@/components/icons";
import { toolFor, xf } from "@/content/tools";
import { Pin, ToolChip } from "@/components/tools/ToolBits";

export type CardPreview = { label: string; badge?: string; node: React.ReactNode };

export function ProjectCard({ project, preview }: { project: Project; preview: CardPreview }) {
  return (
    <article
      data-xf={xf([...project.stack.map((s) => toolFor(s).slug), ...project.alsoUses])}
      className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface-1 transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-line-strong">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(600px_circle_at_80%_0%,rgb(79_216_255/0.08),transparent_60%)]"
      />
      <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative p-6 sm:p-10">
          <div className="flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3">
            <span className="text-accent">Case study</span>
            <Pin />
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
            <span className="block font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3">Question</span>
            {project.question}
          </p>
          {/* Above the card-wide link, so the chips filter the page instead of opening the case study. */}
          <ul className="relative z-10 mt-6 flex flex-wrap gap-2" aria-label="Tools">
            {project.stack.map((s) => (
              <li key={s}>
                <ToolChip label={s} className="rounded-full border border-line px-3 py-1 font-mono text-[0.6875rem] text-ink-2" />
              </li>
            ))}
          </ul>
          <p className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-accent">
            Read the case study
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </p>
        </div>

        <div className="relative border-t border-line bg-surface-2/50 p-6 sm:p-10 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3">
            <span>{preview.label}</span>
            {preview.badge && (
              <span className="ml-3 shrink-0 whitespace-nowrap rounded-full border border-warn/40 px-2 py-0.5 text-warn normal-case tracking-normal">
                {preview.badge}
              </span>
            )}
          </div>
          <div className="mt-6 h-40">{preview.node}</div>
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-ink-2">
            {project.demonstrates.map((d) => (
              <li key={d} className="flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-2" />
                {d}
              </li>
            ))}
          </ul>
          <p className="mt-6 font-mono text-[0.6875rem] leading-relaxed text-ink-3">{project.dataNote}</p>
        </div>
      </div>
    </article>
  );
}

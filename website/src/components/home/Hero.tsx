import Link from "next/link";
import { profile } from "@/content/profile";
import { HeroVisual } from "@/components/hero/HeroVisual";
import { ArrowRight, ExternalIcon } from "@/components/icons";

/*
 * Labels for the three parts of the hero graphic, drawn as a numbered axis just under it.
 * Offsets are fractions of the figure height (the scene is centred and scales with height).
 */
const STAGES = [
  { n: "1", label: "Raw records", short: "Raw", offset: -0.25 },
  { n: "2", label: "Transform", offset: 0.02 },
  { n: "3", label: "Model & measures", short: "Model", offset: 0.31 },
];

function StageAxis() {
  const at = (k: number) => `calc(50% + ${k} * var(--fig-h))`;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[80%] font-mono text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.16em]">
      <div className="absolute h-px bg-gradient-to-r from-transparent via-line-strong to-accent/60" style={{ left: at(-0.42), right: `calc(50% - 0.47 * var(--fig-h))` }} />
      <svg
        viewBox="0 0 8 8"
        className="absolute h-2 w-2 -translate-y-1/2 text-accent/70"
        style={{ left: `calc(50% + 0.47 * var(--fig-h) - 4px)` }}
      >
        <path d="M0 0 L8 4 L0 8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      {STAGES.map((s) => (
        <div key={s.n} className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: at(s.offset) }}>
          <span className="h-2 w-2 -translate-y-1/2 rounded-full border border-accent bg-bg shadow-[0_0_10px_rgb(79_216_255/0.5)]" />
          <span className="mt-1.5 whitespace-nowrap text-ink-2">
            <span className="text-accent">{s.n}</span> {s.short ? <><span className="sm:hidden">{s.short}</span><span className="hidden sm:inline">{s.label}</span></> : s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-clip pt-16">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[720px] rounded-full bg-[radial-gradient(closest-side,rgb(79_216_255/0.10),transparent)] blur-2xl"
      />

      <div className="hero-exit relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-20 pt-14 sm:px-6 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-0 lg:pb-28 lg:pt-16">
        <div className="relative z-10 max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
            {profile.title} · {profile.location}
          </p>
          <h1 id="hero-title" className="mt-6 text-5xl font-semibold tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            {profile.name}
          </h1>
          <p className="mt-6 text-2xl font-medium leading-snug tracking-tight text-ink-1 text-balance sm:text-3xl">
            {profile.headline}
          </p>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-2 text-pretty sm:text-lg">{profile.intro}</p>

          <div className="mt-9 flex flex-wrap items-center gap-2.5">
            <Link
              href="/#projects"
              className="glow-accent group inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-bg transition-transform duration-300 hover:-translate-y-0.5"
            >
              Explore projects
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            {profile.resumeUrl && (
              <a
                href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${profile.resumeUrl}`}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-5 text-sm font-medium text-ink-1 transition-colors hover:border-accent"
              >
                Resume (PDF)
              </a>
            )}
            <a
              href={profile.links.linkedin}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-5 text-sm font-medium text-ink-1 transition-colors hover:border-accent"
            >
              LinkedIn <ExternalIcon className="h-3.5 w-3.5 text-ink-3" />
            </a>
            <a
              href={profile.links.github}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-5 text-sm font-medium text-ink-1 transition-colors hover:border-accent"
            >
              GitHub <ExternalIcon className="h-3.5 w-3.5 text-ink-3" />
            </a>
          </div>

        </div>

        {/* --fig-h drives both the canvas height and the label positions below, because the 3D scene scales with height. */}
        <figure className="relative h-[var(--fig-h)] [--fig-h:300px] sm:[--fig-h:380px] lg:[--fig-h:500px]">
          <HeroVisual />
          <StageAxis />
          <span className="sr-only">
            Animated illustration: scattered data points flow through a transform ring and settle into ordered columns.
          </span>
        </figure>
      </div>

      <a
        href="#projects"
        className="scroll-cue absolute bottom-16 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3 transition-colors hover:text-ink-1 lg:flex"
      >
        Projects
        <span aria-hidden className="relative h-8 w-px overflow-hidden bg-line-strong">
          <span className="scroll-cue-dot absolute inset-x-0 top-0 h-3 bg-accent" />
        </span>
      </a>
    </section>
  );
}

import Link from "next/link";
import { profile } from "@/content/profile";
import { HeroVisual } from "@/components/hero/HeroVisual";
import { ArrowRight, ExternalIcon } from "@/components/icons";
import { Topo } from "@/components/Topo";
import { HeroFallback } from "@/components/hero/HeroFallback";
import { OnThisDay } from "@/components/hero/OnThisDay";
import { dayCount, firstDay, lastDay, series, summary } from "@/data/apple-health";

/*
 * Labels for the three parts of the hero graphic, drawn as a numbered axis just under it.
 * Offsets are fractions of the figure height (the scene is centred and scales with height).
 */
const STAGES = [
  { n: "1", label: "Records", value: `${(summary.headline.records / 1e6).toFixed(1)}M`, offset: -0.46 },
  { n: "2", label: "Transform", value: "Python", offset: -0.17 },
  { n: "3", label: "Days", value: dayCount.toLocaleString("en-US"), offset: 0.14 },
];

const monthYear = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

function StageAxis() {
  // Never closer than 2.5rem to the left edge, so the first label stays inside the figure. On the narrowest
  // phones the first label is clamped right against the second, so it hugs the left edge instead and the type steps down.
  const at = (k: number) => `max(calc(50% + ${k} * var(--fig-h)), var(--stage-min, 2.5rem))`;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-[80%] font-mono text-[0.625rem] uppercase max-[359px]:text-[0.5625rem] max-[359px]:[--stage-min:0.5rem] sm:tracking-[0.16em]"
    >
      <div
        className="absolute h-px bg-gradient-to-r from-transparent via-line-strong to-accent/60"
        style={{ left: `max(calc(50% - 0.54 * var(--fig-h)), 0px)`, right: `calc(50% - 0.47 * var(--fig-h))` }}
      />
      <svg
        viewBox="0 0 8 8"
        className="absolute h-2 w-2 -translate-y-1/2 text-accent/70"
        style={{ left: `calc(50% + 0.47 * var(--fig-h) - 4px)` }}
      >
        <path d="M0 0 L8 4 L0 8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      {STAGES.map((s, i) => (
        <div
          key={s.n}
          className={`absolute flex -translate-x-1/2 flex-col items-center ${i === 0 ? "max-[359px]:translate-x-0 max-[359px]:items-start" : ""}`}
          style={{ left: at(s.offset) }}
        >
          <span className="h-2 w-2 -translate-y-1/2 rounded-full border border-accent bg-bg shadow-[0_0_10px_rgb(79_216_255/0.5)]" />
          <span className="mt-1.5 whitespace-nowrap text-ink-2">
            <span className="text-accent">{s.n}</span> {s.label}
          </span>
          <span className="mt-0.5 whitespace-nowrap normal-case tracking-normal text-ink-3">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Hero() {
  const steps = series("steps");
  const years = Number(lastDay.slice(0, 4)) - Number(firstDay.slice(0, 4)) + 1;
  return (
    <section aria-labelledby="hero-title" className="relative overflow-clip pt-16">
      <Topo captionTop="5rem" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-10 h-[32.5rem] w-[45rem] rounded-full bg-[radial-gradient(closest-side,rgb(79_216_255/0.10),transparent)] blur-2xl"
      />

      <div className="hero-exit relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-20 pt-14 sm:px-6 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-0 lg:pb-28 lg:pt-16">
        <div className="relative z-10 max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
            {profile.title} · <span className="whitespace-nowrap">{profile.location}</span>
          </p>
          <h1 id="hero-title" className="mt-6 text-5xl font-semibold tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            {profile.name}
          </h1>
          <p className="mt-6 text-2xl font-medium leading-snug tracking-tight text-ink-1 text-balance sm:text-3xl">{profile.headline}</p>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-2 text-pretty sm:text-lg">{profile.intro}</p>

          <div className="mt-9 flex flex-wrap items-center gap-2.5">
            <Link
              href="/#projects"
              className="glow-accent group inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-bg transition-transform duration-300 hover:-translate-y-0.5"
            >
              Explore the project
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            {profile.resumeUrl && (
              <a
                href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${profile.resumeUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-5 text-sm font-medium text-ink-1 transition-colors hover:border-accent"
              >
                Resume <ExternalIcon className="h-3.5 w-3.5 text-ink-3" />
              </a>
            )}
            <a
              href={profile.links.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-5 text-sm font-medium text-ink-1 transition-colors hover:border-accent"
            >
              LinkedIn <ExternalIcon className="h-3.5 w-3.5 text-ink-3" />
            </a>
          </div>
        </div>

        {/* --fig-h drives both the canvas height and the label positions below, because the 3D scene scales with height. */}
        <figure className="relative">
          <div className="relative h-[var(--fig-h)] [--fig-h:18.75rem] sm:[--fig-h:23.75rem] lg:[--fig-h:31.25rem]">
            <HeroVisual
              start={firstDay}
              steps={steps}
              fallback={<HeroFallback start={firstDay} steps={steps} className="h-full w-full" />}
            />
            <StageAxis />
          </div>
          <figcaption className="mx-auto mt-1 max-w-md text-center font-mono text-[0.6875rem] leading-relaxed text-ink-3 text-balance">
            <span className="sr-only">
              Animated chart: points stream in from the left, pass through a ring and settle into {years} columns of dots, one per
              year.{" "}
            </span>
            Each dot is one day of my Apple Health data, {monthYear(firstDay)} to {monthYear(lastDay)}: one column per year, brighter on
            days with more steps. <span className="text-[var(--warn)]">Today&apos;s date</span> glows in every year.
            <OnThisDay start={firstDay} steps={steps} />
          </figcaption>
        </figure>
      </div>

      <a
        href="#projects"
        className="scroll-cue absolute bottom-16 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-ink-3 transition-colors hover:text-ink-1 lg:flex"
      >
        Projects
        <span aria-hidden className="relative h-8 w-px overflow-hidden bg-line-strong">
          <span className="scroll-cue-dot absolute inset-x-0 top-0 h-3 bg-accent" />
        </span>
      </a>
    </section>
  );
}

import Link from "next/link";
import { profile } from "@/content/profile";
import { HeroVisual } from "@/components/hero/HeroVisual";
import { ArrowRight, ExternalIcon } from "@/components/icons";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden pt-16">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[720px] rounded-full bg-[radial-gradient(closest-side,rgb(79_216_255/0.10),transparent)] blur-2xl"
      />

      <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-6xl items-center gap-6 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-0 lg:pb-24">
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

          <div className="mt-9 flex flex-wrap items-center gap-3">
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
                Résumé (PDF)
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
              className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-ink-2 transition-colors hover:text-ink-1"
            >
              GitHub <ExternalIcon className="h-3.5 w-3.5 text-ink-3" />
            </a>
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            <div>
              <dt>Model</dt>
              <dd className="mt-1 normal-case tracking-normal text-ink-2">SQL · DAX</dd>
            </div>
            <div>
              <dt>Build</dt>
              <dd className="mt-1 normal-case tracking-normal text-ink-2">Python · Fabric</dd>
            </div>
            <div>
              <dt>Report</dt>
              <dd className="mt-1 normal-case tracking-normal text-ink-2">Power BI</dd>
            </div>
          </dl>
        </div>

        <figure className="relative h-[300px] sm:h-[380px] lg:h-[560px]">
          <HeroVisual />
          <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 hidden justify-between px-6 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 sm:flex">
            <span>raw records</span>
            <span>transform</span>
            <span>model · measures</span>
          </figcaption>
          <span className="sr-only">
            Animated illustration: scattered data points flow through a transform ring and settle into ordered columns.
          </span>
        </figure>
      </div>
    </section>
  );
}

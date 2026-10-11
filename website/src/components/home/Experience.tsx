import { experience, highlights } from "@/content/profile";
import { Reveal } from "@/components/Reveal";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Company mark on a dark tile with a soft glow, so the logo sits on the site's surface instead of a white box. */
function CompanyLogo({ src, company }: { src: string; company: string }) {
  return (
    <span className="company-logo relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line-strong bg-surface-1">
      <span aria-hidden className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_40%,rgb(6_175_186/0.22),transparent_70%)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}${src}`} alt={`${company} logo`} width={32} height={32} className="relative h-8 w-8" loading="lazy" />
    </span>
  );
}

export function Experience() {
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_2.2fr]">
      <Reveal>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line lg:sticky lg:top-24 lg:grid-cols-1">
          {highlights.map((h) => (
            <div key={h.label} className="bg-surface-1 p-5">
              <dt className="sr-only">{h.label}</dt>
              <dd>
                <span className="block text-3xl font-semibold tracking-tight">{h.value}</span>
                <span className="mt-1 block text-sm text-ink-3">{h.label}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 font-mono text-[11px] text-ink-3">Professional results at Arconic, from my resume.</p>
      </Reveal>

      <ol className="relative space-y-10 border-l border-line pl-8">
        {experience.map((role) => (
          <Reveal as="li" key={`${role.title}-${role.start}`} className="relative">
            <span
              aria-hidden
              className="absolute -left-[37px] top-1.5 h-[9px] w-[9px] rounded-full border border-accent bg-bg shadow-[0_0_12px_rgb(79_216_255/0.5)]"
            />
            <div className="flex items-start gap-4">
              {role.logo && <CompanyLogo src={role.logo} company={role.company} />}
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
                  {role.start} – {role.end}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">
                  {role.title} <span className="text-ink-3">·</span> {role.company}
                </h3>
                <p className="text-sm text-ink-3">{role.location}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              {role.highlights.map((h) => (
                <li key={h} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                  <span aria-hidden className="mt-2 h-1 w-3 shrink-0 rounded-full bg-accent/60" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Tools used">
              {role.tools.map((t) => (
                <li key={t} className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-ink-3">
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

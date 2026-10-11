import { profile } from "@/content/profile";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Cut-out portrait set into a panel that uses the site's grid, glow and
 * corner marks. The image file has its background removed and no metadata.
 */
export function Portrait() {
  return (
    <figure className="portrait relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface-1 lg:max-w-none">
      <div aria-hidden className="portrait-grid absolute inset-0" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 42% at 52% 30%, rgb(79 216 255 / 0.20), transparent 70%), radial-gradient(70% 50% at 50% 100%, rgb(157 140 255 / 0.16), transparent 70%)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, image is pre-sized */}
      <img
        src={`${BASE}/images/billal-zughbi.webp`}
        alt={`Portrait of ${profile.name}`}
        width={960}
        height={1200}
        loading="lazy"
        decoding="async"
        className="portrait-img absolute inset-x-0 bottom-0 h-[94%] w-full object-cover object-top"
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-surface-1 via-surface-1/70 to-transparent" />
      <div aria-hidden className="portrait-scan absolute inset-x-0 top-0 h-px" />
      {["left-3 top-3 border-l border-t", "right-3 top-3 border-r border-t", "left-3 bottom-3 border-l border-b", "right-3 bottom-3 border-r border-b"].map((c) => (
        <span key={c} aria-hidden className={`absolute h-4 w-4 border-accent/70 ${c}`} />
      ))}
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-6 font-mono text-[11px] uppercase tracking-[0.14em]">
        <span>
          <span className="block text-ink-1">{profile.name}</span>
          <span className="mt-1 block text-ink-3">{profile.location}</span>
        </span>
        <span className="flex items-center gap-2 text-ink-3">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" aria-hidden />
          BI · Analytics
        </span>
      </figcaption>
    </figure>
  );
}

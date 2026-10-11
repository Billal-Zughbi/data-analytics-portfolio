import { profile } from "@/content/profile";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Portrait in a framed panel. The photo is shown as supplied, only cropped:
 * no filters or overlays are applied to it.
 */
export function Portrait() {
  return (
    <figure className="portrait relative isolate mx-auto w-full max-w-sm rounded-[var(--radius-lg)] border border-line bg-surface-1 p-3 lg:max-w-none">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-[var(--radius-lg)] opacity-80 blur-2xl"
        style={{ background: "radial-gradient(60% 50% at 50% 35%, rgb(79 216 255 / 0.16), transparent 70%)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, image is pre-sized */}
      <img
        src={`${BASE}/images/billal-zughbi.jpg`}
        alt={`Portrait of ${profile.name}`}
        width={960}
        height={1200}
        loading="lazy"
        decoding="async"
        className="block aspect-[4/5] w-full rounded-[var(--radius-md)] object-cover"
      />
      <figcaption className="px-2 pb-1 pt-4 font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="block text-ink-1">{profile.name}</span>
        <span className="mt-1 block text-ink-3">{profile.location}</span>
      </figcaption>
    </figure>
  );
}

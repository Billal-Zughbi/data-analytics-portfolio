import { Reveal } from "./Reveal";

type Props = {
  id?: string;
  index?: string;
  eyebrow: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** The section right after the hero: a panel that slides up over it as you scroll. */
  sheet?: boolean;
};

/** A homepage or case-study section with the indexed node-rule heading. */
export function Section({ id, index, eyebrow, title, intro, children, className = "", sheet = false }: Props) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={`relative scroll-mt-20 ${sheet ? "sheet-panel z-10 -mt-12 rounded-t-[2.5rem] bg-bg pb-20 pt-16 sm:pb-28 sm:pt-20" : "py-20 sm:py-28"} ${className}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="flex items-center gap-4">
            {index && <span className="font-mono text-xs text-accent">{index}</span>}
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-ink-3">{eyebrow}</span>
            <div className="node-rule ml-2 hidden flex-1 sm:block" aria-hidden />
          </div>
          <h2
            id={headingId}
            className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            {title}
          </h2>
          {intro && <div className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2 text-pretty sm:text-lg">{intro}</div>}
        </Reveal>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

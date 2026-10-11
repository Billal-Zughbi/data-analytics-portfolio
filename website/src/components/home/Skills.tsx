import { skills } from "@/content/profile";
import { Reveal } from "@/components/Reveal";

export function Skills() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {skills.map((g, i) => (
        <Reveal key={g.group} delay={i * 0.08}>
          <div className="h-full rounded-[var(--radius-md)] border border-line bg-surface-1 p-6 transition-colors duration-300 hover:border-line-strong">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">0{i + 1}</p>
            <h3 className="mt-3 text-lg font-semibold tracking-tight">{g.group}</h3>
            <p className="mt-1 text-sm text-ink-3">{g.note}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {g.items.map((s) => (
                <li key={s} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm text-ink-1">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

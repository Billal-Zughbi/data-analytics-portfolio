import { skills } from "@/content/profile";
import { toolFor } from "@/content/tools";
import { Reveal } from "@/components/Reveal";
import { ToolChip, ToolTile } from "@/components/tools/ToolBits";

/**
 * The toolkit, laid out like a Power BI tile slicer: selecting a tool filters the rest of the page
 * (see components/tools/ToolFilter.tsx). Tools with an official logo get a tile; the rest are chips.
 */
export function Skills() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {skills.map((g, i) => {
        const items = g.items.map(toolFor);
        const tiles = items.filter((t) => t.logo);
        const chips = items.filter((t) => !t.logo);
        return (
          <Reveal key={g.group} delay={i * 0.08}>
            <div className="h-full rounded-[var(--radius-md)] border border-line bg-surface-1 p-6 transition-colors duration-300 hover:border-line-strong">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-accent">0{i + 1}</p>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">{g.group}</h3>
              <p className="mt-1 text-sm text-ink-3">{g.note}</p>
              {tiles.length > 0 && (
                <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2">
                  {tiles.map((t) => (
                    <li key={t.slug}>
                      <ToolTile tool={t} />
                    </li>
                  ))}
                </ul>
              )}
              {chips.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {chips.map((t) => (
                    <li key={t.slug}>
                      <ToolChip label={t.name} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm text-ink-1" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

import { Reveal } from "@/components/Reveal";

const STAGES = [
  {
    key: "source",
    title: "Source",
    verb: "Find and land the data",
    body: "Pull from the systems that already hold the truth, from warehouse tables to legacy databases and exports, and make loads repeatable.",
    tools: ["SQL", "Snowflake", "Fabric", "Python", "Power Automate"],
  },
  {
    key: "model",
    title: "Model",
    verb: "Fix the grain, shape the schema",
    body: "Decide what one row means, standardize names and types, and build star schemas that make the right question easy to ask.",
    tools: ["Data modeling", "Star schema", "Power Query (M)", "ETL/ELT"],
  },
  {
    key: "validate",
    title: "Validate",
    verb: "Prove the numbers",
    body: "Reconcile totals against the source, test for duplicates and join fan-out, and define every measure before it reaches a visual.",
    tools: ["SQL checks", "pytest", "DAX measures", "Reconciliation"],
  },
  {
    key: "communicate",
    title: "Communicate",
    verb: "Put it in front of decisions",
    body: "Build reports around the decision they support, with clear definitions, sensible security and documentation people can follow.",
    tools: ["Power BI", "Row-Level Security", "Documentation"],
  },
];

export function Workflow() {
  return (
    <Reveal>
      <div className="relative">
        {/* Connector: horizontal on desktop, vertical on mobile */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 top-[22px] hidden h-2 w-full lg:block"
          viewBox="0 0 1000 8"
          preserveAspectRatio="none"
        >
          <path d="M12 4H988" stroke="var(--line-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path
            d="M12 4H988"
            stroke="url(#flow-grad)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            className="flow-line"
            pathLength={1}
          />
          <defs>
            <linearGradient id="flow-grad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="var(--accent)" />
              <stop offset="1" stopColor="var(--accent-2)" />
            </linearGradient>
          </defs>
        </svg>

        <ol className="relative grid gap-10 lg:grid-cols-4 lg:gap-6">
          {STAGES.map((s, i) => (
            <li key={s.key} className="relative pl-12 lg:pl-0">
              <span
                aria-hidden
                className="absolute left-[13px] top-12 bottom-[-2.5rem] w-px bg-line-strong lg:hidden"
                style={{ display: i === STAGES.length - 1 ? "none" : undefined }}
              />
              <div className="absolute left-0 top-0 flex h-[44px] w-[28px] items-center lg:static lg:w-auto">
                <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-bg font-mono text-[11px] text-accent">
                  {i + 1}
                  <span aria-hidden className="absolute inset-0 rounded-full shadow-[0_0_18px_rgb(79_216_255/0.35)]" />
                </span>
              </div>
              <h3 className="mt-0 text-lg font-semibold tracking-tight lg:mt-6">
                {s.title}
                <span className="block text-sm font-normal text-ink-3">{s.verb}</span>
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{s.body}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${s.title} tools`}>
                {s.tools.map((t) => (
                  <li key={t} className="rounded-md bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink-2">
                    {t}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </Reveal>
  );
}

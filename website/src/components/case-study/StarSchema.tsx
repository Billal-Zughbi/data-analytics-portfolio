/** Star schema of the Power BI rebuild, drawn as SVG (server component). */
export function StarSchema() {
  const box = "fill-[var(--surface-2)] stroke-[var(--line-strong)]";
  return (
    <figure className="rounded-[var(--radius-lg)] border border-line bg-surface-1 p-4 sm:p-6">
      <svg viewBox="0 0 640 260" className="h-auto w-full" role="img" aria-labelledby="schema-title schema-desc">
        <title id="schema-title">Power BI data model</title>
        <desc id="schema-desc">
          A fact table, fact_daily_metric, with one row per date and metric, related many-to-one to dim_date on date
          and to dim_metric on metric.
        </desc>
        <defs>
          <marker id="one" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8">
            <path d="M5 0V10" stroke="var(--ink-3)" strokeWidth="1.5" />
          </marker>
        </defs>
        {/* links */}
        <path d="M200 130H240" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d="M400 130H440" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="220" y="120" textAnchor="middle" className="fill-[var(--ink-3)] font-mono text-[0.625rem]">1 : *</text>
        <text x="420" y="120" textAnchor="middle" className="fill-[var(--ink-3)] font-mono text-[0.625rem]">* : 1</text>

        {/* dim_date */}
        <rect x="10" y="40" width="190" height="180" rx="10" className={box} />
        <text x="26" y="66" className="fill-[var(--ink-1)] font-mono text-[0.8125rem] font-semibold">dim_date</text>
        <text x="26" y="84" className="fill-[var(--ink-3)] font-mono text-[0.625rem]">1 row per calendar day</text>
        {["date  (key)", "year · quarter · month", "iso_week · week_start", "day_of_week · day_name", "is_weekend"].map((t, i) => (
          <text key={t} x="26" y={112 + i * 20} className="fill-[var(--ink-2)] font-mono text-[0.6875rem]">{t}</text>
        ))}

        {/* fact */}
        <rect x="240" y="20" width="160" height="220" rx="10" className="fill-[var(--surface-3)] stroke-[var(--accent)]" strokeOpacity="0.6" />
        <text x="256" y="46" className="fill-[var(--ink-1)] font-mono text-[0.8125rem] font-semibold">fact_daily_metric</text>
        <text x="256" y="64" className="fill-[var(--ink-3)] font-mono text-[0.625rem]">1 row per date × metric</text>
        {["date", "metric", "value"].map((t, i) => (
          <text key={t} x="256" y={98 + i * 22} className="fill-[var(--ink-2)] font-mono text-[0.6875rem]">{t}</text>
        ))}
        <text x="256" y="190" className="fill-[var(--ink-3)] font-mono text-[0.625rem]">value already follows</text>
        <text x="256" y="204" className="fill-[var(--ink-3)] font-mono text-[0.625rem]">the metric&apos;s daily rule</text>

        {/* dim_metric */}
        <rect x="440" y="40" width="190" height="180" rx="10" className={box} />
        <text x="456" y="66" className="fill-[var(--ink-1)] font-mono text-[0.8125rem] font-semibold">dim_metric</text>
        <text x="456" y="84" className="fill-[var(--ink-3)] font-mono text-[0.625rem]">1 row per metric</text>
        {["metric  (key)", "label · group · unit", "daily_aggregation", "hk_type"].map((t, i) => (
          <text key={t} x="456" y={112 + i * 20} className="fill-[var(--ink-2)] font-mono text-[0.6875rem]">{t}</text>
        ))}
      </svg>
    </figure>
  );
}

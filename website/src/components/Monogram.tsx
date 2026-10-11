/** BZ monogram: three nodes joined into a small graph, the site's mark. */
export function Monogram({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" stroke="var(--line-strong)" />
      <path d="M9 22L16 9l7 13" stroke="var(--ink-2)" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M11.5 17.5h9" stroke="var(--ink-3)" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="16" cy="9" r="2.4" fill="var(--accent)" />
      <circle cx="9" cy="22" r="2" fill="var(--ink-1)" />
      <circle cx="23" cy="22" r="2" fill="var(--accent-2)" />
    </svg>
  );
}

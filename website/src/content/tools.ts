/**
 * Every tool named on the home page. The Skills slicer, the tool chips and the page filter read from here.
 *
 * Logos are the official files, copied byte for byte into public/logos/ and never edited
 * (sources and licenses in docs/logo-sources.md). Tools without an official logo show their name only.
 */

export type Tool = {
  slug: string;
  name: string;
  /** Official logo under public/. */
  logo?: string;
  /** The logo is dark, so it sits on a light plate to stay visible on the dark site. The file itself is unchanged. */
  plate?: boolean;
  /** Highlight color while this tool filters the page. Used for outlines and glows, never applied to the logo. */
  color?: string;
  /** How the tool is written in page copy. */
  match: RegExp;
};

export const tools: Tool[] = [
  { slug: "power-bi", name: "Power BI", logo: "/logos/power-bi.svg", color: "#f2c811", match: /\bPower BI\b/ },
  { slug: "dax", name: "DAX", match: /\bDAX\b/ },
  { slug: "power-query", name: "Power Query (M)", match: /\bPower Query\b/ },
  { slug: "rls", name: "Row-Level Security", match: /\bRow-Level Security\b|\bsecurity\b/ },
  { slug: "excel", name: "Excel", logo: "/logos/excel.svg", color: "#33c481", match: /\bExcel\b/ },
  { slug: "sql", name: "SQL", match: /\bSQL\b(?! Server)/ },
  { slug: "snowflake", name: "Snowflake", logo: "/logos/snowflake.svg", color: "#29b5e8", match: /\bSnowflake\b/ },
  { slug: "fabric", name: "Microsoft Fabric", logo: "/logos/microsoft-fabric.svg", color: "#3fc7a9", match: /\b(?:Microsoft )?Fabric\b/ },
  { slug: "sql-server", name: "SQL Server", logo: "/logos/sql-server.svg", color: "#e5484d", match: /\bSQL Server\b/ },
  { slug: "python", name: "Python", logo: "/logos/python.svg", color: "#ffd43b", match: /\bPython\b/ },
  { slug: "etl", name: "ETL/ELT", match: /\bETL\b|\bELT\b/ },
  { slug: "data-modeling", name: "Data modeling", match: /\bdata model(?:s|ing)?\b/i },
  { slug: "star-schema", name: "Star schema", match: /\bstar schema\b/i },
  { slug: "power-automate", name: "Power Automate", logo: "/logos/power-automate.svg", color: "#4d9bff", match: /\bPower Automate\b/ },
  { slug: "power-apps", name: "Power Apps", logo: "/logos/power-apps.svg", color: "#e37fd8", match: /\bPower Apps\b/ },
  { slug: "git", name: "Git", logo: "/logos/git.svg", color: "#f05032", match: /\bGit\b(?!Hub)/ },
  { slug: "github", name: "GitHub", logo: "/logos/github.svg", color: "#e9edff", match: /\bGitHub\b/ },
  { slug: "azure-devops", name: "Azure DevOps", logo: "/logos/azure-devops.svg", color: "#3ca0f0", match: /\bAzure DevOps\b/ },
  { slug: "pandas", name: "pandas", logo: "/logos/pandas.svg", plate: true, color: "#e70488", match: /\bpandas\b/ },
  { slug: "pytest", name: "pytest", logo: "/logos/pytest.svg", color: "#0a9edc", match: /\bpytest\b/ },
  { slug: "elementtree", name: "ElementTree", match: /\bElementTree\b/ },
  { slug: "recharts", name: "Recharts", match: /\bRecharts\b/ },
  { slug: "documentation", name: "Documentation", match: /\bdocumentation\b(?! page)/i },
  { slug: "reconciliation", name: "Reconciliation", match: /\breconcil\w*/i },
];

export const toolBySlug = Object.fromEntries(tools.map((t) => [t.slug, t])) as Record<string, Tool>;

/** Slugs of every tool mentioned in a piece of text, in registry order. */
export function toolsIn(text: string): string[] {
  return tools.filter((t) => t.match.test(text)).map((t) => t.slug);
}

/** The tool a chip label refers to, e.g. "SQL checks" → SQL. Throws on a label no tool matches, so typos fail the build. */
export function toolFor(label: string): Tool {
  const exact = tools.find((t) => t.name === label);
  if (exact) return exact;
  const slug = toolsIn(label)[0];
  if (!slug) throw new Error(`No tool matches "${label}"`);
  return toolBySlug[slug];
}

/** Splits text into plain runs and tool mentions, so mentions can light up while the page is filtered. */
export function splitMentions(text: string): { text: string; slug?: string }[] {
  const hits = tools
    .flatMap((t) =>
      [...text.matchAll(new RegExp(t.match.source, `${t.match.flags}g`))].map((m) => ({ at: m.index ?? 0, end: (m.index ?? 0) + m[0].length, slug: t.slug })),
    )
    .sort((a, b) => a.at - b.at || b.end - a.end);
  const parts: { text: string; slug?: string }[] = [];
  let last = 0;
  for (const h of hits) {
    if (h.at < last) continue; // overlaps an earlier, longer mention
    if (h.at > last) parts.push({ text: text.slice(last, h.at) });
    parts.push({ text: text.slice(h.at, h.end), slug: h.slug });
    last = h.end;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Space-separated slugs for a data-xf attribute. */
export const xf = (slugs: Iterable<string>) => [...new Set(slugs)].join(" ");

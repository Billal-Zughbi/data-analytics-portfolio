/**
 * Typed project registry. The homepage gallery, sitemap and case-study headers
 * read from here. To add a project: add an entry, create
 * src/app/projects/<slug>/page.tsx, and export its generated data under
 * src/data/generated/<slug>/.
 */

export type ProjectStatus = "published";

export type Project = {
  slug: string;
  title: string;
  /** One sentence for cards and meta descriptions. Avoid personal health detail. */
  summary: string;
  question: string;
  role: string;
  period: string;
  stack: string[];
  /** Tools the project also uses beyond its stack, for the home page filter (slugs from content/tools.ts). */
  alsoUses: string[];
  /** Short labels for what the case study demonstrates. */
  demonstrates: string[];
  dataNote: string;
  status: ProjectStatus;
};

export const projects: Project[] = [
  {
    slug: "apple-health-analytics",
    title: "Closing My Rings: Twelve Years of Apple Health Data",
    summary:
      "Twelve years of my Apple Health data rebuilt from the raw XML export: my original Power BI report recreated for the web, every number on it checked, and a closer look at steps, workouts and heart rate.",
    question:
      "Were the numbers in my first Power BI report right, and what do 4.4 million health records say once each one is counted properly?",
    role: "Independent project · pipeline, data model, report",
    period: "Built March 2025 · rebuilt with data through October 2026",
    stack: ["Python", "pandas", "ElementTree", "Power BI", "Power Query", "DAX", "pytest", "Recharts"],
    // The pipeline writes a star schema (data/model/) and the code lives in Git on GitHub.
    alsoUses: ["data-modeling", "star-schema", "git", "github"],
    demonstrates: [
      "Streaming XML extraction",
      "Reverse-engineering a Power BI model",
      "Multi-device de-duplication",
      "Daily aggregation rules",
      "Data-quality checks",
      "Interactive web report",
    ],
    dataNote: "My own data, published as daily values only. Device names, workout routes and times of day stay private.",
    status: "published",
  },
];

export const getProject = (slug: string) => {
  const project = projects.find((p) => p.slug === slug);
  if (!project) throw new Error(`Unknown project: ${slug}`);
  return project;
};

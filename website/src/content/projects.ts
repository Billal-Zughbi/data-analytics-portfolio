/**
 * Typed project registry. The homepage gallery, sitemap and case-study headers
 * read from here. To add a project: add an entry, create
 * src/app/projects/<slug>/page.tsx, and export its generated data under
 * src/data/generated/<slug>/.
 */

import { profile } from "./profile";

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
  /** Short labels for what the case study demonstrates. */
  demonstrates: string[];
  dataNote: string;
  repoPath: string;
  status: ProjectStatus;
};

export const projects: Project[] = [
  {
    slug: "apple-health-analytics",
    title: "Apple Health Analytics",
    summary:
      "A Python pipeline and Power BI report that turn a raw Apple Health XML export into validated daily activity, cardio, mobility and environment metrics.",
    question:
      "How do you get accurate daily numbers out of an Apple Health export that mixes records from a watch and a phone?",
    role: "Independent project · design, pipeline, model, report",
    period: "Built March 2025 · rebuilt for this portfolio October 2026",
    stack: ["Python", "pandas", "ElementTree", "Power BI", "DAX", "pytest"],
    demonstrates: [
      "Streaming XML extraction",
      "Explicit aggregation rules",
      "Multi-device de-duplication",
      "Data-quality checks",
      "Star-schema model",
      "Personal data kept private",
    ],
    dataNote: "Public charts use a synthetic export. The original personal data stays private.",
    repoPath: "projects/apple-health-analytics",
    status: "published",
  },
];

export const repoUrl = (path = "") =>
  `${profile.links.repository}${path ? `/tree/main/${path}` : ""}`;

export const repoFileUrl = (path: string) => `${profile.links.repository}/blob/main/${path}`;

export const getProject = (slug: string) => {
  const project = projects.find((p) => p.slug === slug);
  if (!project) throw new Error(`Unknown project: ${slug}`);
  return project;
};

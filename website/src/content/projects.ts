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
  {
    slug: "olist-delivery-experience",
    title: "Late Deliveries and Customer Reviews",
    summary:
      "SQL and Python analysis of about 100,000 real orders from Olist, a Brazilian online marketplace, measuring how late deliveries line up with review scores and where the late orders come from.",
    question:
      "How much does late delivery cost in review scores, and which routes, months and categories produce the late orders?",
    role: "Independent project · question, SQL, Python, model, write-up",
    period: "October 2026",
    stack: ["SQL (DuckDB)", "Python", "pandas", "pytest", "Power BI model", "DAX"],
    demonstrates: [
      "Multi-table SQL modeling",
      "Join fan-out checks",
      "SQL vs pandas reconciliation",
      "Delivery KPI definitions",
      "Route and cohort analysis",
      "Honest statistics",
    ],
    dataNote: "Real public data: Olist, CC BY-NC-SA 4.0. Only aggregates are published.",
    repoPath: "projects/olist-delivery-experience",
    status: "published",
  },  {
    slug: "known-exploited-vulnerabilities",
    title: "How Fast Vulnerabilities Get Exploited",
    summary:
      "SQL and Python analysis of CISA's Known Exploited Vulnerabilities catalog joined to the official CVE records, measuring how long it takes for a published vulnerability to be confirmed as exploited and how that compares with sorting patches by severity.",
    question:
      "Once a vulnerability is made public, how quickly is it confirmed as exploited, how has that changed, and does a severity score alone point patching at the right things?",
    role: "Independent project · question, SQL, Python, model, write-up",
    period: "October 2026",
    stack: ["SQL (DuckDB)", "Python", "pandas", "pytest", "Power BI model", "DAX"],
    demonstrates: [
      "Joining two public sources",
      "Bridge tables",
      "Random-sample baseline",
      "Sensitivity checks",
      "SQL vs pandas reconciliation",
      "Security domain metrics",
    ],
    dataNote: "Real public data: CISA KEV (CC0) and CVE records (CVE Program Terms of Use).",
    repoPath: "projects/known-exploited-vulnerabilities",
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

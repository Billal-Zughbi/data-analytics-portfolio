/**
 * Shared shape of `summary.json` for the public-data case studies
 * (written by each project's export step; see projects/<slug>/outputs/website-data/README.md).
 */

export type Source = {
  name: string;
  publisher: string;
  url: string;
  license: string;
  retrieved: string;
  mirror_url?: string;
  catalog_version?: string;
  coverage?: { start: string; end: string };
  rows?: Record<string, number>;
};

export type CaseKpi = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  display: string;
  definition: string;
};

export type Finding = { id: string; title: string; summary: string; metric: string; caveat: string };

export type QualityCheck = { name: string; result: string; detail: string };

export type Reconciliation = { metric: string; sql: number | string | null; python: number | string | null; match: boolean };

export type CaseSummary = {
  generated_at: string;
  source: Source;
  secondary_sources?: Source[];
  question: string;
  kpis: CaseKpi[];
  findings: Finding[];
  quality: { checks: QualityCheck[] };
  reconciliation: Reconciliation[];
  next_steps: string[];
};

export const kpiMap = (s: CaseSummary) => Object.fromEntries(s.kpis.map((k) => [k.key, k])) as Record<string, CaseKpi>;

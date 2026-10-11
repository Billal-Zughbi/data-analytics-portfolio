/**
 * Typed access to the outputs written by `python -m kev_analytics export`
 * (projects/known-exploited-vulnerabilities). Components never type a metric by hand.
 */

import type { CaseSummary, Source } from "./case-study";
import summaryJson from "./generated/known-exploited-vulnerabilities/summary.json";
import lagByYearJson from "./generated/known-exploited-vulnerabilities/lag_by_year.json";
import lagDistJson from "./generated/known-exploited-vulnerabilities/lag_distribution.json";
import monthlyJson from "./generated/known-exploited-vulnerabilities/additions_monthly.json";
import vendorsJson from "./generated/known-exploited-vulnerabilities/vendors.json";
import severityJson from "./generated/known-exploited-vulnerabilities/severity.json";
import cweJson from "./generated/known-exploited-vulnerabilities/cwe.json";

export type KevSummary = CaseSummary & {
  source: Source & { catalog_version: string; retrieved: string };
  secondary_sources: (Source & { retrieved: string })[];
};

export type AddedYearRow = {
  added_year: number;
  entries: number;
  launch_backlog_entries: number;
  median_age_days: number;
  p25_age_days: number;
  p75_age_days: number;
  share_within_7d: number;
  share_within_30d: number;
  share_over_1y: number;
  share_ransomware_known: number;
};

export type SensitivityRow = {
  rule: string;
  entries: number;
  median_lag_days: number;
  p25_lag_days: number;
  p75_lag_days: number;
  share_within_30d: number;
};

export type LagBucket = {
  cohort: "Added after launch" | "Launch backlog";
  lag_bucket: string;
  bucket_order: number;
  entries: number;
  share: number;
  cumulative_share: number;
};

export type MonthRow = {
  year_month: string;
  additions: number;
  ransomware_known_additions: number;
  launch_backlog_additions: number;
  fresh_additions_30d: number;
  cumulative_entries: number;
  rolling_12m_additions: number;
  rolling_window_complete: boolean;
};

export type VendorRow = {
  vendor: string;
  entries: number;
  share_of_entries: number;
  cumulative_share: number;
  ransomware_known: number;
  ransomware_share: number;
  recent_24m_entries: number;
  median_lag_post_launch: number | null;
  products: number;
};

export type BaselineRow = {
  band: string;
  kev_entries: number;
  kev_share: number;
  baseline_sampled: number;
  baseline_share: number;
  est_population: number;
  est_population_lo: number;
  est_population_hi: number;
  kev_rate: number;
  kev_rate_lo: number;
  kev_rate_hi: number;
};

export type MixRow = { basis: "cna_only" | "record_cvss"; band: string; band_order: number; entries: number; share: number };

export type FamilyRow = { cwe_family: string; entries: number; weighted_entries: number; ransomware_known: number; ransomware_share: number };
export type CweRow = FamilyRow & { cwe_id: string; cwe_name: string };

export const summary = summaryJson as unknown as KevSummary;
export const lagByYear = lagByYearJson as unknown as { by_added_year: AddedYearRow[]; sensitivity: SensitivityRow[] };
export const lagBuckets = (lagDistJson as unknown as { buckets: LagBucket[] }).buckets
  .slice()
  .sort((a, b) => a.bucket_order - b.bucket_order);
export const months = (monthlyJson as unknown as { months: MonthRow[] }).months;
export const vendors = vendorsJson as unknown as {
  recent_window: { start: string; end: string };
  top_by_entries: VendorRow[];
  other_vendors: { vendors: number; entries: number; ransomware_known: number; recent_24m_entries: number };
  top_by_recent_24m: { vendor: string; recent_24m_entries: number; entries: number; ransomware_share: number }[];
  top_products: { vendor: string; product: string; entries: number; ransomware_known: number }[];
};
export const severity = severityJson as unknown as {
  bases: Record<string, string>;
  kev_mix: MixRow[];
  vs_baseline: { scope: string; rows: BaselineRow[] };
  ransomware_by_band: { band: string; entries: number; ransomware_known: number; ransomware_share: number }[];
};
export const cwe = cweJson as unknown as { top_cwes: CweRow[]; families: FamilyRow[] };

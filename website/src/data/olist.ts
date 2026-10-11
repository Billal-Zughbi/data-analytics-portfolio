/**
 * Typed access to the outputs written by `python -m olist_delivery export`
 * (projects/olist-delivery-experience). Components never type a metric by hand.
 */

import type { CaseSummary } from "./case-study";
import summaryJson from "./generated/olist-delivery-experience/summary.json";
import monthlyJson from "./generated/olist-delivery-experience/monthly.json";
import reviewJson from "./generated/olist-delivery-experience/review_by_delay.json";
import routesJson from "./generated/olist-delivery-experience/routes.json";
import categoriesJson from "./generated/olist-delivery-experience/categories.json";
import estimateJson from "./generated/olist-delivery-experience/estimate_accuracy.json";

export type OlistSummary = CaseSummary & {
  source: CaseSummary["source"] & { attribution: string; version_note: string };
  statistics: {
    note: string;
    late_reviews: number;
    on_time_reviews: number;
    mean_score_diff: number;
    mean_score_diff_ci95: [number, number];
    pct_1star_diff: number;
    pct_1star_diff_ci95: [number, number];
    spearman_rho_days_vs_score: number;
  };
  quality: CaseSummary["quality"] & { summary: { error_checks: number; error_checks_failed: number; warnings: number } };
};

export type MonthRow = {
  month: string;
  orders_placed: number;
  delivered_orders: number;
  late_orders: number;
  late_rate: number;
  avg_days_vs_estimate: number;
  avg_promised_days: number;
  avg_actual_days: number;
  avg_seller_handling_days: number;
  avg_carrier_transit_days: number;
  avg_score: number;
  late_rate_3m: number;
};
export type DestRow = { month: string; destination: string; delivered_orders: number; late_orders: number; late_rate: number };

export type DelayRow = {
  delay_bucket: string;
  label: string;
  sort_order: number;
  orders: number;
  reviewed_orders: number;
  avg_score: number;
  pct_1star: number;
  pct_5star: number;
  pct_answered_before_delivery: number;
};

export type RouteRow = {
  route: string;
  delivered_orders: number;
  late_orders: number;
  late_rate: number;
  late_rate_low: number;
  late_rate_high: number;
  share_of_delivered: number;
  share_of_late: number;
  excess_late_orders: number;
  avg_score: number;
};

export type StateRow = Omit<RouteRow, "route" | "excess_late_orders"> & { customer_state: string; state_name: string; region: string };

export type CategoryLate = Omit<RouteRow, "route"> & { category: string };
export type CategoryRevenue = {
  category: string;
  items: number;
  orders: number;
  price: number;
  freight: number;
  revenue: number;
  revenue_share: number;
  cumulative_share: number;
  freight_share_of_revenue: number;
};

export const summary = summaryJson as unknown as OlistSummary;
export const monthly = monthlyJson as unknown as { window: { start: string; end: string }; rows: MonthRow[]; by_destination: DestRow[] };
export const reviewByDelay = (reviewJson as unknown as { rows: DelayRow[] }).rows.slice().sort((a, b) => a.sort_order - b.sort_order);
export const routes = routesJson as unknown as {
  overall_late_rate: number;
  min_orders_for_rate_ranking: number;
  routes_total: number;
  top_by_late_orders: RouteRow[];
  other_routes: { routes: number; delivered_orders: number; late_orders: number; late_rate: number; share_of_late: number };
  highest_rate_min_orders: RouteRow[];
  destination_states: StateRow[];
};
export const categories = categoriesJson as unknown as {
  min_orders_for_rate_ranking: number;
  late_by_category: CategoryLate[];
  categories_below_min_orders: number;
  revenue_by_category: CategoryRevenue[];
  revenue_total: number;
  revenue_currency: string;
};
export const estimate = estimateJson as unknown as {
  clamp: { min: number; max: number; note: string };
  summary: Record<string, number>;
  rows: { days_vs_estimate: number; orders: number; share: number; cumulative_share: number }[];
};

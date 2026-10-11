"""Write every published output from the DuckDB marts.

Published numbers come from the SQL marts. The pandas results are used to
reconcile them (reconcile.py) and for the statistical comparison, which only
exists in pandas. Nothing here contains review text or order-level rows.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from . import database
from .analyze import wilson_interval
from .config import (
    ATTRIBUTION,
    EXPECTED_ROWS_KAGGLE_V2,
    DELAY_BUCKETS,
    MIN_GROUP_ORDERS,
    MONTH_END,
    MONTH_START,
    SOURCE,
)

QUESTION = (
    "How much does late delivery cost in customer review scores, and where do the late orders come from "
    "(seller-to-customer routes, states, categories, time)?"
)

MART_TABLES = [
    "delivery_population", "estimate_accuracy", "review_by_delay", "monthly_delivery", "monthly_by_destination",
    "route_performance", "category_performance", "state_performance", "score_gap_within_groups",
    "category_revenue", "customer_repeat", "cohort_repeat", "repeat_by_first_delivery",
    "payment_reconciliation", "payment_type_summary", "fanout_check", "headline_metrics",
]

BR_STATES = {
    "AC": ("Acre", "North"), "AL": ("Alagoas", "Northeast"), "AP": ("Amapá", "North"),
    "AM": ("Amazonas", "North"), "BA": ("Bahia", "Northeast"), "CE": ("Ceará", "Northeast"),
    "DF": ("Distrito Federal", "Center-West"), "ES": ("Espírito Santo", "Southeast"),
    "GO": ("Goiás", "Center-West"), "MA": ("Maranhão", "Northeast"), "MT": ("Mato Grosso", "Center-West"),
    "MS": ("Mato Grosso do Sul", "Center-West"), "MG": ("Minas Gerais", "Southeast"), "PA": ("Pará", "North"),
    "PB": ("Paraíba", "Northeast"), "PR": ("Paraná", "South"), "PE": ("Pernambuco", "Northeast"),
    "PI": ("Piauí", "Northeast"), "RJ": ("Rio de Janeiro", "Southeast"), "RN": ("Rio Grande do Norte", "Northeast"),
    "RS": ("Rio Grande do Sul", "South"), "RO": ("Rondônia", "North"), "RR": ("Roraima", "North"),
    "SC": ("Santa Catarina", "South"), "SP": ("São Paulo", "Southeast"), "SE": ("Sergipe", "Northeast"),
    "TO": ("Tocantins", "North"),
}

# Column names that must never appear in a published file.
FORBIDDEN_FIELDS = ("review_comment_title", "review_comment_message", "customer_unique_id", "customer_id",
                    "review_id", "seller_id", "order_id", "product_id", "zip_code")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _r(x, nd: int = 4):
    if x is None:
        return None
    try:
        if pd.isna(x):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(x, (bool, np.bool_)):
        return bool(x)
    if isinstance(x, (int, np.integer)):
        return int(x)
    v = float(x)
    if math.isinf(v):
        return None
    return round(v, nd)


def _records(df: pd.DataFrame, rounding: dict[str, int] | None = None, default_nd: int = 4) -> list[dict]:
    rounding = rounding or {}
    out = []
    for row in df.to_dict(orient="records"):
        rec = {}
        for k, v in row.items():
            if isinstance(v, str) or v is None:
                rec[k] = v
            elif isinstance(v, (pd.Timestamp, datetime)):
                rec[k] = v.strftime("%Y-%m-%d")
            else:
                rec[k] = _r(v, rounding.get(k, default_nd))
        out.append(rec)
    return out


def pct(x: float, nd: int = 1) -> str:
    return f"{x * 100:.{nd}f}%"


def month_label(month: str) -> str:
    """'2018-03' -> 'Mar 2018'."""
    return pd.Period(month, freq="M").strftime("%b %Y")


def _write_json(path: Path, payload) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


# ---------------------------------------------------------------------------
# Marts and analysis CSVs
# ---------------------------------------------------------------------------

def load_marts(db_path: Path) -> dict[str, pd.DataFrame]:
    return {name: database.read_table(db_path, f"mart.{name}") for name in MART_TABLES}


def metric_dict(marts: dict[str, pd.DataFrame]) -> dict[str, float]:
    return dict(marts["headline_metrics"].itertuples(index=False, name=None))


def write_analysis_csvs(marts: dict[str, pd.DataFrame], out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, df in marts.items():
        if name == "route_performance":
            df = df.drop(columns=[c for c in df.columns if c.startswith("median_")])
        p = out_dir / f"{name}.csv"
        df.to_csv(p, index=False, float_format="%.10g")
        paths.append(p)
    return paths


def distribution_summary(db_path: Path) -> dict:
    q = database.query(db_path, """
        SELECT
            quantile_cont(days_vs_estimate, [0.05, 0.25, 0.5, 0.75, 0.95]) AS dve,
            quantile_cont(promised_days, [0.25, 0.5, 0.75]) AS promised,
            quantile_cont(actual_days, [0.25, 0.5, 0.75]) AS actual,
            count(*) FILTER (WHERE days_vs_estimate < -40) AS below_clamp,
            count(*) FILTER (WHERE days_vs_estimate > 30) AS above_clamp,
            min(days_vs_estimate) AS min_days, max(days_vs_estimate) AS max_days
        FROM core.fct_orders WHERE in_timing_population
    """).iloc[0]
    dve, pr, ac = list(q["dve"]), list(q["promised"]), list(q["actual"])
    return {
        "days_vs_estimate_p05": dve[0], "days_vs_estimate_p25": dve[1], "days_vs_estimate_median": dve[2],
        "days_vs_estimate_p75": dve[3], "days_vs_estimate_p95": dve[4],
        "promised_days_p25": pr[0], "promised_days_median": pr[1], "promised_days_p75": pr[2],
        "actual_days_p25": ac[0], "actual_days_median": ac[1], "actual_days_p75": ac[2],
        "orders_below_clamp": int(q["below_clamp"]), "orders_above_clamp": int(q["above_clamp"]),
        "min_days_vs_estimate": int(q["min_days"]), "max_days_vs_estimate": int(q["max_days"]),
    }


def coverage(db_path: Path) -> dict:
    q = database.query(db_path, """
        SELECT min(purchase_date) AS start, max(purchase_date) AS end_,
               max(purchase_date) FILTER (WHERE in_timing_population) AS last_delivered_purchase,
               max(delivered_customer_date) AS last_delivery
        FROM core.fct_orders
    """).iloc[0]
    return {
        "start": q["start"].strftime("%Y-%m-%d"),
        "end": q["end_"].strftime("%Y-%m-%d"),
        "last_purchase_with_delivery": q["last_delivered_purchase"].strftime("%Y-%m-%d"),
        "last_delivery": q["last_delivery"].strftime("%Y-%m-%d"),
        "analysis_months": {"start": MONTH_START, "end": MONTH_END},
    }


# ---------------------------------------------------------------------------
# Power BI star schema (aggregated; see powerbi/README.md for the grain choice)
# ---------------------------------------------------------------------------

POWERBI_QUERIES = {
    "fact_route_month": """
        SELECT
            strftime(purchase_month, '%Y-%m')                                       AS month,
            coalesce(primary_seller_state, '(none)')                                AS seller_state,
            customer_state,
            count(*)                                                                AS orders,
            count(*) FILTER (WHERE in_timing_population)                            AS delivered_orders,
            count(*) FILTER (WHERE is_late)                                         AS late_orders,
            count(*) FILTER (WHERE delivery_outcome = 'delivered_missing_date')     AS delivered_missing_date_orders,
            coalesce(sum(days_vs_estimate), 0)                                      AS days_vs_estimate_sum,
            coalesce(sum(promised_days) FILTER (WHERE in_timing_population), 0)     AS promised_days_sum,
            coalesce(sum(actual_days), 0)                                           AS actual_days_sum,
            count(review_score) FILTER (WHERE in_timing_population)                 AS reviewed_orders,
            coalesce(sum(review_score) FILTER (WHERE in_timing_population), 0)      AS review_score_sum,
            count(*) FILTER (WHERE in_timing_population AND review_score = 1)       AS one_star_reviews,
            count(review_score) FILTER (WHERE is_late)                              AS late_reviewed_orders,
            coalesce(sum(review_score) FILTER (WHERE is_late), 0)                   AS late_review_score_sum,
            count(*) FILTER (WHERE is_late AND review_score = 1)                    AS late_one_star_reviews,
            sum(item_revenue)                                                       AS item_revenue,
            sum(item_freight)                                                       AS item_freight,
            sum(payment_total)                                                      AS payment_total
        FROM core.fct_orders
        GROUP BY ALL
        ORDER BY month, seller_state, customer_state
    """,
    "fact_category_month": """
        SELECT
            strftime(purchase_month, '%Y-%m')                                       AS month,
            coalesce(primary_category, '(no items)')                                AS category,
            count(*)                                                                AS orders,
            count(*) FILTER (WHERE in_timing_population)                            AS delivered_orders,
            count(*) FILTER (WHERE is_late)                                         AS late_orders,
            count(review_score) FILTER (WHERE in_timing_population)                 AS reviewed_orders,
            coalesce(sum(review_score) FILTER (WHERE in_timing_population), 0)      AS review_score_sum,
            count(*) FILTER (WHERE in_timing_population AND review_score = 1)       AS one_star_reviews
        FROM core.fct_orders
        GROUP BY ALL
        ORDER BY month, category
    """,
    "fact_item_revenue_month": """
        SELECT
            strftime(purchase_month, '%Y-%m')   AS month,
            category,
            order_status = 'delivered'          AS is_delivered_order,
            count(*)                            AS items,
            sum(price)                          AS price,
            sum(freight_value)                  AS freight,
            sum(item_revenue)                   AS item_revenue
        FROM core.fct_order_items
        GROUP BY ALL
        ORDER BY month, category, is_delivered_order
    """,
    "fact_delay_review": """
        SELECT
            strftime(purchase_month, '%Y-%m')   AS month,
            delay_bucket,
            review_score,
            count(*)                            AS orders
        FROM core.fct_orders
        WHERE in_timing_population
        GROUP BY ALL
        ORDER BY month, delay_bucket, review_score
    """,
    "fact_customer_cohort": """
        SELECT cohort_month AS month, customers, returned_90d, returned_180d, returned_any, full_180d_followup
        FROM mart.cohort_repeat ORDER BY cohort_month
    """,
    "dim_category": """
        SELECT category,
               min(product_category_name) AS category_pt,
               min(category_source) AS category_source
        FROM stg.products GROUP BY category
        UNION ALL SELECT '(no items)', NULL, 'no_items'
        ORDER BY category
    """,
}


def powerbi_tables(db_path: Path) -> dict[str, pd.DataFrame]:
    tables = {name: database.query(db_path, sql) for name, sql in POWERBI_QUERIES.items()}
    months = pd.period_range("2016-09", "2018-10", freq="M")
    tables["dim_month"] = pd.DataFrame({
        "month": months.astype(str),
        "month_start": months.start_time.strftime("%Y-%m-%d"),
        "year": months.year,
        "quarter": months.quarter,
        "month_number": months.month,
        "month_name": months.strftime("%b"),
        "in_analysis_window": [(m >= MONTH_START) and (m <= MONTH_END) for m in months.astype(str)],
    })
    tables["dim_state"] = pd.DataFrame(
        [{"state": k, "state_name": v[0], "region": v[1]} for k, v in sorted(BR_STATES.items())]
        + [{"state": "(none)", "state_name": "No seller (order has no items)", "region": "(none)"}]
    )
    tables["dim_delay_bucket"] = pd.DataFrame([
        {"delay_bucket": k, "label": lab, "sort_order": i, "lower_days": lo, "upper_days": hi,
         "is_late": k.startswith("late")}
        for i, (k, lab, lo, hi) in enumerate(DELAY_BUCKETS, start=1)
    ])
    for c in ("lower_days", "upper_days"):
        tables["dim_delay_bucket"][c] = tables["dim_delay_bucket"][c].astype("Int64")
    tables["fact_delay_review"]["review_score"] = tables["fact_delay_review"]["review_score"].astype("Int64")
    money = {"item_revenue", "item_freight", "payment_total", "price", "freight"}
    for df in tables.values():
        for col in df.columns:
            if col not in money and pd.api.types.is_float_dtype(df[col]) and (df[col].dropna() % 1 == 0).all():
                df[col] = df[col].astype("Int64")  # DuckDB HUGEINT sums arrive as float
    return tables


def write_powerbi(tables: dict[str, pd.DataFrame], sample_dir: Path) -> list[Path]:
    sample_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, df in tables.items():
        p = sample_dir / f"{name}.csv"
        df.to_csv(p, index=False, float_format="%.2f")
        paths.append(p)
    return paths


def powerbi_expected_values(tables: dict[str, pd.DataFrame], metrics: dict[str, float]) -> pd.DataFrame:
    """Recompute headline measures from the star-schema CSV tables the way the DAX does."""
    r = tables["fact_route_month"]
    c = tables["fact_category_month"]
    rev = tables["fact_item_revenue_month"]
    d = tables["fact_delay_review"]
    cohort = tables["fact_customer_cohort"]
    on_time_reviewed = r["reviewed_orders"].sum() - r["late_reviewed_orders"].sum()
    rj = r[r["customer_state"] == "RJ"]
    sp_rj = r[(r["seller_state"] == "SP") & (r["customer_state"] == "RJ")]
    rows = [
        ("Orders", "orders_total", r["orders"].sum()),
        ("Delivered Orders (timed)", "timing_population_orders", r["delivered_orders"].sum()),
        ("Late Orders", "late_orders", r["late_orders"].sum()),
        ("Late Rate", "late_rate", r["late_orders"].sum() / r["delivered_orders"].sum()),
        ("Avg Days vs Estimate", "mean_days_vs_estimate", r["days_vs_estimate_sum"].sum() / r["delivered_orders"].sum()),
        ("Avg Review Score (late)", "avg_score_late", r["late_review_score_sum"].sum() / r["late_reviewed_orders"].sum()),
        ("Avg Review Score (on time)", "avg_score_on_time",
         (r["review_score_sum"].sum() - r["late_review_score_sum"].sum()) / on_time_reviewed),
        ("% 1-Star (late)", "pct_1star_late", r["late_one_star_reviews"].sum() / r["late_reviewed_orders"].sum()),
        ("% 1-Star (on time)", "pct_1star_on_time",
         (r["one_star_reviews"].sum() - r["late_one_star_reviews"].sum()) / on_time_reviewed),
        ("Late Share of 1-Star Reviews", "late_share_of_1star_reviews",
         r["late_one_star_reviews"].sum() / r["one_star_reviews"].sum()),
        ("Late Rate, customer state RJ", "state_rj_late_rate", rj["late_orders"].sum() / rj["delivered_orders"].sum()),
        ("Late Rate, route SP → RJ", "route_sp_rj_late_rate", sp_rj["late_orders"].sum() / sp_rj["delivered_orders"].sum()),
        ("Share of Late Orders, route SP → RJ", "route_sp_rj_share_of_late",
         sp_rj["late_orders"].sum() / r["late_orders"].sum()),
        ("Item Revenue (all orders)", "items_revenue_all_orders", r["item_revenue"].sum()),
        ("Payments (all orders)", "payments_total_all_orders", r["payment_total"].sum()),
        ("Item Revenue (delivered orders)", "items_revenue_delivered",
         rev.loc[rev["is_delivered_order"].astype(bool), "item_revenue"].sum()),
        ("Late Orders (category fact)", "late_orders", c["late_orders"].sum()),
        ("Delivered Orders (delay fact)", "timing_population_orders", d["orders"].sum()),
        ("Customers (cohort fact)", "customers_with_delivered_order", cohort["customers"].sum()),
        ("Repeat Customer Rate", "repeat_customer_rate", cohort["returned_any"].sum() / cohort["customers"].sum()),
        ("Avg Review Score (delay fact, late buckets)", "avg_score_late",
         (d.loc[d["delay_bucket"].str.startswith("late"), "review_score"].astype(float)
          * d.loc[d["delay_bucket"].str.startswith("late"), "orders"]).sum()
         / d.loc[d["delay_bucket"].str.startswith("late") & d["review_score"].notna(), "orders"].sum()),
    ]
    out = pd.DataFrame(rows, columns=["measure", "pipeline_metric", "from_csv"])
    out["pipeline_value"] = out["pipeline_metric"].map(metrics)
    money = out["pipeline_metric"].str.contains("revenue|payments")
    out["match"] = np.where(
        money,
        (out["from_csv"] - out["pipeline_value"]).abs() <= 0.01 * len(r),  # CSV money is rounded to cents per row
        (out["from_csv"] - out["pipeline_value"]).abs() <= 1e-9 * np.maximum(1, out["pipeline_value"].abs()),
    )
    return out


# ---------------------------------------------------------------------------
# Website JSON
# ---------------------------------------------------------------------------

def build_kpis(m: dict[str, float], monthly: pd.DataFrame) -> list[dict]:
    win = monthly[monthly["in_window"]]
    peak = win.loc[win["late_rate"].idxmax()]
    return [
        {"key": "late_rate", "label": "Delivered orders that arrived late", "value": _r(m["late_rate"]),
         "unit": "share", "display": pct(m["late_rate"]),
         "definition": "Share of delivered orders whose delivery date (calendar day) is after the estimated delivery date."},
        {"key": "median_days_vs_estimate", "label": "Median arrival vs estimate",
         "value": _r(m["median_days_vs_estimate"], 1), "unit": "days",
         "display": f"{abs(m['median_days_vs_estimate']):.0f} days early",
         "definition": "Median of delivered date minus estimated date over delivered orders. Negative means early."},
        {"key": "avg_score_on_time", "label": "Average review, on time or early",
         "value": _r(m["avg_score_on_time"], 2), "unit": "stars (1-5)", "display": f"{m['avg_score_on_time']:.2f}",
         "definition": "Mean review score of delivered orders that were not late, using the latest review per order."},
        {"key": "avg_score_late", "label": "Average review, late",
         "value": _r(m["avg_score_late"], 2), "unit": "stars (1-5)", "display": f"{m['avg_score_late']:.2f}",
         "definition": "Mean review score of late delivered orders, using the latest review per order."},
        {"key": "pct_1star_late", "label": "Late orders with a 1-star review", "value": _r(m["pct_1star_late"]),
         "unit": "share", "display": pct(m["pct_1star_late"]),
         "definition": f"Share of reviewed late orders scored 1, against {pct(m['pct_1star_on_time'])} for on-time orders."},
        {"key": "route_sp_rj_share_of_late", "label": "Late orders on the SP → RJ route",
         "value": _r(m["route_sp_rj_share_of_late"]), "unit": "share", "display": pct(m["route_sp_rj_share_of_late"]),
         "definition": (f"Share of all late orders whose primary seller is in São Paulo and customer in Rio de Janeiro. "
                        f"The route carries {pct(m['route_sp_rj_share_of_delivered'])} of delivered orders.")},
        {"key": "peak_month_late_rate", "label": "Worst month for late deliveries",
         "value": _r(peak["late_rate"]), "unit": "share", "display": f"{pct(peak['late_rate'])} ({month_label(peak['month'])})",
         "definition": f"Highest monthly late rate by purchase month, {MONTH_START} to {MONTH_END}."},
        {"key": "repeat_customer_rate", "label": "Customers who bought again", "value": _r(m["repeat_customer_rate"]),
         "unit": "share", "display": pct(m["repeat_customer_rate"]),
         "definition": "Share of customers (customer_unique_id) with delivered orders on two or more different purchase days."},
    ]


def build_findings(m: dict[str, float], marts: dict[str, pd.DataFrame], peak_periods: pd.DataFrame,
                   repeat_ci: dict) -> list[dict]:
    routes = marts["route_performance"].set_index("route")
    sp_rj = routes.loc["SP → RJ"]
    monthly = marts["monthly_delivery"]
    win = monthly[monthly["in_window"]]
    peak = win.loc[win["late_rate"].idxmax()]
    nov = monthly.set_index("month").loc["2017-11"]
    spikes = monthly[monthly["month"].isin(SPIKE_MONTHS)]
    spike_late_share = spikes["late_orders"].sum() / monthly["late_orders"].sum()
    spike_delivered_share = spikes["delivered_orders"].sum() / monthly["delivered_orders"].sum()
    cats = marts["category_performance"]
    cat_top_excess = float(cats["excess_late_orders"].max())
    pp = peak_periods.set_index("period")
    febmar = pp.loc["2018-02 to 2018-03"]
    after = pp.loc["2018-04 to 2018-05 (after)"]
    return [
        {
            "id": "score-gap",
            "title": "Late orders score about two stars lower",
            "summary": (f"Late orders averaged {m['avg_score_late']:.2f} stars against {m['avg_score_on_time']:.2f} for orders "
                        f"that arrived on time or early. {pct(m['pct_1star_late'])} of late orders got a 1-star review, "
                        f"compared with {pct(m['pct_1star_on_time'])} of on-time orders."),
            "metric": "Mean review score (1-5) and share of 1-star reviews; latest review per order; delivered orders.",
            "caveat": (f"This is an association. Comparing late and on-time orders inside the same customer state, category "
                       f"or seller gives almost the same gap ({m['score_gap_within_state']:.2f}, "
                       f"{m['score_gap_within_category']:.2f} and {m['score_gap_within_seller']:.2f} stars), but other "
                       "differences between late and on-time orders are not controlled."),
        },
        {
            "id": "estimates-padded",
            "title": "Estimates are generous, yet some orders still miss them",
            "summary": (f"The median delivered order arrived {abs(m['median_days_vs_estimate']):.0f} days before its estimate and "
                        f"{pct(m['pct_7plus_days_early'], 0)} arrived at least a week early. Even so, {pct(m['late_rate'])} "
                        "arrived after the estimated day."),
            "metric": "Delivered date minus estimated date in whole days; late = positive.",
            "caveat": (f"Comparing timestamps instead of dates would put the late rate at {pct(m['late_rate_timestamp_rule'])}, "
                       "because estimates are stored at midnight. I use calendar days."),
        },
        {
            "id": "sp-rj-route",
            "title": "One route accounts for about a sixth of late orders",
            "summary": (f"Orders shipped from São Paulo to Rio de Janeiro were {pct(m['route_sp_rj_share_of_delivered'])} of delivered "
                        f"orders but {pct(m['route_sp_rj_share_of_late'])} of late ones, with a late rate of "
                        f"{pct(sp_rj['late_rate'])} (95% interval {pct(sp_rj['late_rate_low'])} to {pct(sp_rj['late_rate_high'])}). "
                        f"No product category comes close: the largest excess over the average late rate for any category is "
                        f"{cat_top_excess:.0f} orders, against {sp_rj['excess_late_orders']:.0f} for this route."),
            "metric": "Late orders and late rate by route (primary seller state to customer state), Wilson 95% intervals.",
            "caveat": ("The dataset has no carrier or shipping-method fields, so route stands in for distance, carrier "
                       "network and local conditions together. I can't separate them here."),
        },
        {
            "id": "two-spikes",
            "title": "Four months produced over half of all late orders",
            "summary": (f"Purchases from November-December 2017 and February-March 2018 were {pct(spike_delivered_share, 0)} of "
                        f"delivered orders but {pct(spike_late_share, 0)} of late ones; the late rate reached "
                        f"{pct(nov['late_rate'])} in November 2017 and {pct(peak['late_rate'])} in {pd.Period(peak['month'], freq='M').strftime('%B %Y')}. "
                        f"In February and March 2018 carrier transit averaged "
                        f"{febmar['avg_carrier_transit_days']:.1f} days against {after['avg_carrier_transit_days']:.1f} in April and May, "
                        "while seller handling time barely changed."),
            "metric": "Late rate by purchase month; average days from purchase to carrier hand-off and from hand-off to delivery.",
            "caveat": ("November 2017 includes Black Friday volume. Nothing in the data names a cause for February and March "
                       "2018, and the last months are cut off by the end of the data, so they may look better than they were."),
        },
        {
            "id": "reviewed-before-arrival",
            "title": "Most late orders were reviewed before they arrived",
            "summary": (f"{pct(m['pct_late_answered_before_delivery'], 0)} of reviews on late orders were answered before the "
                        "recorded delivery time. For these orders the score was given while the customer was still waiting."),
            "metric": "Share of late orders whose review answer timestamp is earlier than the delivery timestamp.",
            "caveat": ("The dataset describes when surveys were sent but not what triggered them. What it does show is that "
                       f"{pct(m['pct_late_low_scores_answered_before_delivery'], 0)} of 1- and 2-star reviews on late "
                       "orders were given before the product arrived."),
        },
        {
            "id": "repeat-context",
            "title": "Very few customers come back, late or not",
            "summary": (f"Only {pct(m['repeat_customer_rate'])} of customers with a delivered order bought again on a later day. "
                        f"Customers whose first order was late came back within 180 days at {pct(repeat_ci['late_rate'])}, "
                        f"against {pct(repeat_ci['on_time_rate'])} after an on-time first order."),
            "metric": "Customers by customer_unique_id; repeat = delivered orders on two or more purchase days.",
            "caveat": (f"The intervals overlap ({pct(repeat_ci['late_low'])} to {pct(repeat_ci['late_high'])} vs "
                       f"{pct(repeat_ci['on_time_low'])} to {pct(repeat_ci['on_time_high'])}), so the data can't show whether "
                       "lateness changes repeat buying."),
        },
    ]


SPIKE_MONTHS = ["2017-11", "2017-12", "2018-02", "2018-03"]

NEXT_STEPS = [
    "Review how delivery estimates are set for routes into Rio de Janeiro and the Northeast, where late rates are well above the average, and test any change on a small share of orders first.",
    "Track the late rate weekly by route with a simple alert threshold, so a spike like February and March 2018 shows up within days.",
    "Test holding the review request until an order is delivered, or asking about delivery separately, so seller and product ratings are not mixed with delivery delays.",
    "Add carrier and shipping-method data to the model, since without it I can't tell carrier performance apart from distance.",
]


def repeat_intervals(marts: dict[str, pd.DataFrame]) -> dict:
    r = marts["repeat_by_first_delivery"].set_index("first_order_outcome")
    lo, hi = wilson_interval(r["returned_180d"].to_numpy(), r["customers"].to_numpy())
    r = r.assign(low=lo, high=hi)
    return {
        "late_customers": int(r.loc["late", "customers"]), "late_returned": int(r.loc["late", "returned_180d"]),
        "late_rate": float(r.loc["late", "return_rate_180d"]), "late_low": float(r.loc["late", "low"]),
        "late_high": float(r.loc["late", "high"]),
        "on_time_customers": int(r.loc["on_time", "customers"]), "on_time_returned": int(r.loc["on_time", "returned_180d"]),
        "on_time_rate": float(r.loc["on_time", "return_rate_180d"]), "on_time_low": float(r.loc["on_time", "low"]),
        "on_time_high": float(r.loc["on_time", "high"]),
    }


def quality_checks(validation: pd.DataFrame, source_check: dict) -> list[dict]:
    checks = []
    for key, rows in source_check["rows"].items():
        expected = EXPECTED_ROWS_KAGGLE_V2[key]
        if source_check["problems"]:
            result = "fail"
        else:
            result = "pass" if rows == expected else "warn"
        checks.append({"name": f"source_rows_{key}", "result": result,
                       "detail": f"{rows:,} rows parsed with a CSV reader (Kaggle v2: {expected:,})"})
    checks.append({"name": "source_version", "result": "info", "detail": source_check["version_note"]})
    for row in validation.itertuples(index=False):
        if row.severity == "info":
            result = "info"
        elif row.passed:
            result = "pass"
        else:
            result = "warn" if row.severity == "warn" else "fail"
        actual = "" if pd.isna(row.actual) else f"{row.actual:,.2f}".rstrip("0").rstrip(".")
        detail = f"{row.detail} (value {actual})" if actual else row.detail
        checks.append({"name": row.check_name, "result": result, "detail": detail})
    return checks


def chart_payloads(marts: dict[str, pd.DataFrame], m: dict[str, float], dist: dict, repeat_ci: dict) -> dict[str, dict]:
    license_note = ATTRIBUTION
    monthly = marts["monthly_delivery"]
    win = monthly[monthly["in_window"]]
    mcols = ["month", "orders_placed", "delivered_orders", "late_orders", "on_time_rate", "late_rate",
             "avg_days_vs_estimate", "avg_promised_days", "avg_actual_days", "avg_seller_handling_days",
             "avg_carrier_transit_days", "avg_score", "late_rate_3m"]
    by_dest = marts["monthly_by_destination"]

    rbd = marts["review_by_delay"][["delay_bucket", "label", "sort_order", "lower_days", "upper_days", "orders",
                                    "reviewed_orders", "avg_score", "pct_1star", "pct_5star",
                                    "pct_answered_before_delivery"]]

    routes = marts["route_performance"]
    rcols = ["route", "seller_state", "customer_state", "delivered_orders", "late_orders", "late_rate", "late_rate_low",
             "late_rate_high", "share_of_delivered", "share_of_late", "excess_late_orders", "avg_score"]
    top_routes = routes.sort_values(["late_orders", "route"], ascending=[False, True]).head(15)
    rest = routes.drop(top_routes.index)
    highest_rate = routes[routes["meets_min_orders"]].sort_values("late_rate", ascending=False).head(10)
    states = marts["state_performance"].assign(
        state_name=lambda d: d["customer_state"].map(lambda s: BR_STATES.get(s, (s, ""))[0]),
        region=lambda d: d["customer_state"].map(lambda s: BR_STATES.get(s, ("", "unknown"))[1]),
    )

    cats = marts["category_performance"]
    ccols = ["category", "delivered_orders", "late_orders", "late_rate", "late_rate_low", "late_rate_high",
             "share_of_delivered", "share_of_late", "excess_late_orders", "avg_score"]
    cats_eligible = cats[cats["meets_min_orders"]]
    rev = marts["category_revenue"]
    top_rev = rev.head(12)
    other = rev.iloc[12:]
    rev_rows = _records(top_rev[["category", "items", "orders", "price", "freight", "revenue", "revenue_share",
                                 "cumulative_share", "freight_share_of_revenue"]],
                        {"price": 2, "freight": 2, "revenue": 2})
    rev_rows.append({
        "category": f"other ({len(other)} categories)", "items": int(other["items"].sum()), "orders": None,
        "price": round(float(other["price"].sum()), 2), "freight": round(float(other["freight"].sum()), 2),
        "revenue": round(float(other["revenue"].sum()), 2), "revenue_share": _r(other["revenue_share"].sum()),
        "cumulative_share": 1.0, "freight_share_of_revenue": _r(other["freight"].sum() / other["revenue"].sum()),
    })

    ea = marts["estimate_accuracy"]
    return {
        "monthly.json": {
            "description": "Delivery performance by purchase month (delivered orders only for timing columns).",
            "license": license_note,
            "window": {"start": MONTH_START, "end": MONTH_END},
            "rows": _records(win[mcols], {"avg_days_vs_estimate": 2, "avg_promised_days": 2, "avg_actual_days": 2,
                                          "avg_seller_handling_days": 2, "avg_carrier_transit_days": 2, "avg_score": 3}),
            "by_destination": _records(by_dest),
        },
        "review_by_delay.json": {
            "description": "Review score by how far the delivery was from the estimated date.",
            "license": license_note,
            "rows": _records(rbd, {"avg_score": 3}),
        },
        "routes.json": {
            "description": "Late orders by route (primary seller state to customer state) and by customer state.",
            "license": license_note,
            "overall_late_rate": _r(m["late_rate"]),
            "min_orders_for_rate_ranking": MIN_GROUP_ORDERS,
            "routes_total": int(len(routes)),
            "top_by_late_orders": _records(top_routes[rcols], {"avg_score": 3, "excess_late_orders": 1}),
            "other_routes": {
                "routes": int(len(rest)), "delivered_orders": int(rest["delivered_orders"].sum()),
                "late_orders": int(rest["late_orders"].sum()),
                "late_rate": _r(rest["late_orders"].sum() / rest["delivered_orders"].sum()),
                "share_of_late": _r(rest["share_of_late"].sum()),
            },
            "highest_rate_min_orders": _records(highest_rate[rcols], {"avg_score": 3, "excess_late_orders": 1}),
            "destination_states": _records(states[["customer_state", "state_name", "region", "delivered_orders",
                                                   "late_orders", "late_rate", "late_rate_low", "late_rate_high",
                                                   "share_of_delivered", "share_of_late", "avg_score"]],
                                           {"avg_score": 3}),
        },
        "categories.json": {
            "description": ("Late orders by primary category (category with the most item revenue in the order), and "
                            "revenue composition by item category for delivered orders."),
            "license": license_note,
            "min_orders_for_rate_ranking": MIN_GROUP_ORDERS,
            "late_by_category": _records(
                cats_eligible.sort_values(["late_orders", "category"], ascending=[False, True]).head(15)[ccols],
                {"avg_score": 3, "excess_late_orders": 1}),
            "categories_below_min_orders": int((~cats["meets_min_orders"]).sum()),
            "revenue_by_category": rev_rows,
            "revenue_total": round(float(rev["revenue"].sum()), 2),
            "revenue_currency": "BRL",
        },
        "estimate_accuracy.json": {
            "description": "Distribution of delivered date minus estimated date, in days (negative = early).",
            "license": license_note,
            "clamp": {"min": -40, "max": 30,
                      "note": "The first row counts every order 40 or more days early; the last row every order 30 or more days late."},
            "summary": {k: _r(v, 2) for k, v in dist.items()},
            "rows": _records(ea, {"share": 5, "cumulative_share": 5}),
        },
    }


def build_summary(m: dict[str, float], marts: dict[str, pd.DataFrame], source_check: dict, cover: dict,
                  validation: pd.DataFrame, recon: pd.DataFrame, peak_periods: pd.DataFrame,
                  repeat_ci: dict, score_stats: dict) -> dict:
    rows = source_check["rows"]
    recon_rows = [
        {"metric": r.metric, "sql": _r(r.sql, 6), "python": _r(r.python, 6), "match": bool(r.match)}
        for r in recon.itertuples(index=False)
    ]
    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": {
            "name": SOURCE["name"],
            "publisher": SOURCE["publisher"],
            "url": SOURCE["url"],
            "license": SOURCE["license"],
            "attribution": ATTRIBUTION,
            "retrieved": SOURCE["retrieved"],
            "mirror_url": SOURCE["mirror_url"],
            "version_note": source_check["version_note"],
            "coverage": cover,
            "rows": {
                "orders": rows["orders"], "items": rows["order_items"], "payments": rows["order_payments"],
                "reviews": rows["order_reviews"], "customers": rows["customers"], "products": rows["products"],
                "sellers": rows["sellers"], "geolocation": rows["geolocation"],
                "category_translation": rows["category_translation"],
            },
        },
        "question": QUESTION,
        "kpis": build_kpis(m, marts["monthly_delivery"]),
        "findings": build_findings(m, marts, peak_periods, repeat_ci),
        "statistics": {
            "note": "Welch t-test and a normal-approximation interval for the 1-star gap. Descriptive; not causal.",
            "late_reviews": score_stats["late_n"], "on_time_reviews": score_stats["on_time_n"],
            "mean_score_diff": _r(score_stats["mean_diff"], 3),
            "mean_score_diff_ci95": [_r(x, 3) for x in score_stats["mean_diff_ci95"]],
            "pct_1star_diff": _r(score_stats["pct_1star_diff"]),
            "pct_1star_diff_ci95": [_r(x) for x in score_stats["pct_1star_diff_ci95"]],
            "spearman_rho_days_vs_score": _r(score_stats["spearman_rho_days_vs_score"], 3),
        },
        "quality": {
            "summary": {
                "error_checks": int((validation["severity"] == "error").sum()),
                "error_checks_failed": int(((validation["severity"] == "error") & ~validation["passed"]).sum()),
                "warnings": int(((validation["severity"] == "warn") & ~validation["passed"]).sum()),
            },
            "checks": quality_checks(validation, source_check),
        },
        "reconciliation": recon_rows,
        "next_steps": NEXT_STEPS,
    }


def assert_public_safe(paths: list[Path], max_total_bytes: int) -> int:
    """Fail if any published file carries identifiers or review text, or the set is too large."""
    total = 0
    for p in paths:
        text = p.read_text(encoding="utf-8")
        total += len(text.encode("utf-8"))
        header = text.splitlines()[0] if p.suffix == ".csv" else text
        for field in FORBIDDEN_FIELDS:
            if p.suffix == ".csv" and field in header.split(","):
                raise PermissionError(f"{p.name} has a forbidden column: {field}")
            if p.suffix == ".json" and f'"{field}"' in text:
                raise PermissionError(f"{p.name} has a forbidden field: {field}")
    if total > max_total_bytes:
        raise ValueError(f"published files total {total:,} bytes, limit {max_total_bytes:,}")
    return total

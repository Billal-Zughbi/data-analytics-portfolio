"""Metrics and analysis tables computed in pandas from the order fact.

Column names match the SQL marts so reconcile.py can compare them directly.
The statistical comparison at the end is pandas-only.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from .config import DELAY_BUCKETS, MIN_GROUP_ORDERS, MONTH_END, MONTH_START, WILSON_Z


def wilson_interval(k, n, z: float = WILSON_Z) -> tuple[np.ndarray, np.ndarray]:
    """95% Wilson score interval for k successes out of n (vectorised)."""
    k = np.asarray(k, dtype=float)
    n = np.asarray(n, dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        p = k / n
        denom = 1 + z * z / n
        centre = p + z * z / (2 * n)
        half = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
        return (centre - half) / denom, (centre + half) / denom


def timing(fact: pd.DataFrame) -> pd.DataFrame:
    return fact[fact["in_timing_population"]].copy()


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

def delivery_population(fact: pd.DataFrame) -> pd.DataFrame:
    return (fact.groupby(["delivery_outcome", "order_status"]).size().rename("orders").reset_index()
            .sort_values(["delivery_outcome", "orders"], ascending=[True, False]).reset_index(drop=True))


def estimate_accuracy(fact: pd.DataFrame) -> pd.DataFrame:
    d = timing(fact)["days_vs_estimate"].astype(int).clip(-40, 30)
    out = d.value_counts().sort_index().rename("orders").rename_axis("days_vs_estimate").reset_index()
    out["share"] = out["orders"] / out["orders"].sum()
    out["cumulative_share"] = out["orders"].cumsum() / out["orders"].sum()
    return out


def review_by_delay(fact: pd.DataFrame) -> pd.DataFrame:
    t = timing(fact)
    rows = []
    for i, (key, label, lo, hi) in enumerate(DELAY_BUCKETS, start=1):
        g = t[t["delay_bucket"] == key]
        scored = g["review_score"].dropna().astype(float)
        before = g["review_answered_before_delivery"].dropna()
        rows.append({
            "delay_bucket": key, "label": label, "sort_order": i, "lower_days": lo, "upper_days": hi,
            "orders": len(g), "reviewed_orders": len(scored),
            "avg_score": scored.mean() if len(scored) else np.nan,
            "pct_1star": (scored == 1).mean() if len(scored) else np.nan,
            "pct_5star": (scored == 5).mean() if len(scored) else np.nan,
            "pct_answered_before_delivery": before.astype(bool).mean() if len(before) else np.nan,
        })
    return pd.DataFrame(rows)


def monthly_delivery(fact: pd.DataFrame) -> pd.DataFrame:
    f = fact.copy()
    f["late_flag"] = f["is_late"].fillna(False).astype(bool)
    t = f[f["in_timing_population"]]
    placed = f.groupby("purchase_month").size().rename("orders_placed")
    g = t.groupby("purchase_month")
    m = pd.concat([
        placed,
        g.size().rename("delivered_orders"),
        g["late_flag"].sum().rename("late_orders"),
        g["days_vs_estimate"].apply(lambda s: s.astype(float).mean()).rename("avg_days_vs_estimate"),
        g["promised_days"].apply(lambda s: s.astype(float).mean()).rename("avg_promised_days"),
        g["actual_days"].apply(lambda s: s.astype(float).mean()).rename("avg_actual_days"),
        g["seller_handling_days"].apply(lambda s: s.astype(float).mean()).rename("avg_seller_handling_days"),
        g["carrier_transit_days"].apply(lambda s: s.astype(float).mean()).rename("avg_carrier_transit_days"),
        g["review_score"].apply(lambda s: s.notna().sum()).rename("reviewed_orders"),
        g["review_score"].apply(lambda s: s.astype(float).mean()).rename("avg_score"),
    ], axis=1).sort_index()
    m["delivered_orders"] = m["delivered_orders"].fillna(0).astype(int)
    m["late_orders"] = m["late_orders"].fillna(0).astype(int)
    m["reviewed_orders"] = m["reviewed_orders"].fillna(0).astype(int)
    m["late_rate"] = m["late_orders"] / m["delivered_orders"].replace(0, np.nan)
    m["on_time_rate"] = 1 - m["late_rate"]
    roll_late = m["late_orders"].rolling(3, min_periods=1).sum()
    roll_n = m["delivered_orders"].rolling(3, min_periods=1).sum()
    m["late_rate_3m"] = roll_late / roll_n.replace(0, np.nan)
    m["late_rate_change"] = m["late_rate"] - m["late_rate"].shift(1)
    m.index.name = "month"
    m = m.reset_index()
    m["in_window"] = m["month"].between(MONTH_START, MONTH_END)
    return m


def monthly_by_destination(fact: pd.DataFrame) -> pd.DataFrame:
    t = timing(fact)
    t = t[t["purchase_month"].between(MONTH_START, MONTH_END)]
    t = t.assign(destination=np.where(t["customer_state"].isin(["SP", "RJ", "MG"]), t["customer_state"], "Other"),
                 late_flag=t["is_late"].astype(bool))
    out = t.groupby(["purchase_month", "destination"]).agg(
        delivered_orders=("order_id", "size"), late_orders=("late_flag", "sum")).reset_index()
    out["late_rate"] = out["late_orders"] / out["delivered_orders"]
    return out.rename(columns={"purchase_month": "month"})


def group_performance(fact: pd.DataFrame, keys: list[str], min_orders: int | None = MIN_GROUP_ORDERS) -> pd.DataFrame:
    """Late volume and rate per group, with shares, Wilson interval and ranks."""
    t = timing(fact).assign(late_flag=lambda d: d["is_late"].astype(bool),
                            score=lambda d: d["review_score"].astype(float))
    n_all, late_all = len(t), int(t["late_flag"].sum())
    g = t.groupby(keys, dropna=False).agg(
        delivered_orders=("order_id", "size"),
        late_orders=("late_flag", "sum"),
        avg_score=("score", "mean"),
    ).reset_index()
    g["late_rate"] = g["late_orders"] / g["delivered_orders"]
    g["late_rate_low"], g["late_rate_high"] = wilson_interval(g["late_orders"], g["delivered_orders"])
    g["share_of_delivered"] = g["delivered_orders"] / n_all
    g["share_of_late"] = g["late_orders"] / late_all
    g["excess_late_orders"] = g["late_orders"] - g["delivered_orders"] * late_all / n_all
    g["rank_by_late_orders"] = g["late_orders"].rank(method="dense", ascending=False).astype(int)
    if min_orders is not None:
        g["meets_min_orders"] = g["delivered_orders"] >= min_orders
        g["rank_by_late_rate"] = g["late_rate"].where(g["meets_min_orders"]).rank(method="min", ascending=False)
    return g.sort_values(["late_orders"] + keys, ascending=[False] + [True] * len(keys)).reset_index(drop=True)


def route_performance(fact: pd.DataFrame) -> pd.DataFrame:
    out = group_performance(fact, ["route"])
    parts = out["route"].str.split(" → ", expand=True)
    out.insert(0, "seller_state", parts[0])
    out.insert(1, "customer_state", parts[1])
    return out


def category_performance(fact: pd.DataFrame) -> pd.DataFrame:
    return group_performance(fact, ["primary_category"]).rename(columns={"primary_category": "category"})


def state_performance(fact: pd.DataFrame) -> pd.DataFrame:
    return group_performance(fact, ["customer_state"], min_orders=None)


def score_gap_within_groups(fact: pd.DataFrame) -> pd.DataFrame:
    t = timing(fact)
    t = t[t["review_score"].notna()].assign(score=lambda d: d["review_score"].astype(float),
                                             late_flag=lambda d: d["is_late"].astype(bool))
    rows = []
    for name, key in [("customer_state", "customer_state"), ("primary_category", "primary_category"),
                      ("primary_seller", "primary_seller_id")]:
        late = t[t["late_flag"]].groupby(key)["score"].agg(["mean", "size"])
        on_time = t[~t["late_flag"]].groupby(key)["score"].mean()
        both = late.join(on_time.rename("on_time"), how="inner")
        rows.append({
            "grouping": name,
            "groups_compared": len(both),
            "late_reviews_covered": int(both["size"].sum()),
            "weighted_score_gap": float(((both["mean"] - both["on_time"]) * both["size"]).sum() / both["size"].sum()),
        })
    return pd.DataFrame(rows).sort_values("grouping").reset_index(drop=True)


def category_revenue(items_f: pd.DataFrame) -> pd.DataFrame:
    d = items_f[items_f["order_status"] == "delivered"]
    c = d.groupby("category").agg(
        items=("order_item_id", "size"), orders=("order_id", "nunique"),
        price=("price", "sum"), freight=("freight_value", "sum"), revenue=("item_revenue", "sum"),
    ).reset_index()
    c = c.sort_values(["revenue", "category"], ascending=[False, True]).reset_index(drop=True)
    c["revenue_share"] = c["revenue"] / c["revenue"].sum()
    c["cumulative_share"] = c["revenue"].cumsum() / c["revenue"].sum()
    c["freight_share_of_revenue"] = c["freight"] / c["revenue"]
    c["revenue_rank"] = np.arange(1, len(c) + 1)
    return c


def customer_repeat(fact: pd.DataFrame) -> dict:
    d = fact[fact["order_status"] == "delivered"]
    per = d.groupby("customer_unique_id").agg(delivered_orders=("order_id", "size"),
                                              purchase_days=("purchase_date", "nunique"))
    return {
        "customers": len(per),
        "repeat_customers": int((per["purchase_days"] >= 2).sum()),
        "repeat_rate": float((per["purchase_days"] >= 2).mean()),
        "customers_two_plus_orders": int((per["delivered_orders"] >= 2).sum()),
        "two_plus_orders_rate": float((per["delivered_orders"] >= 2).mean()),
        "max_orders_one_customer": int(per["delivered_orders"].max()),
    }


def _next_purchase(fact: pd.DataFrame) -> pd.DataFrame:
    d = fact[fact["order_status"] == "delivered"]
    days = d.groupby("customer_unique_id")["purchase_date"].apply(lambda s: sorted(s.unique()))
    return pd.DataFrame({
        "first_date": days.map(lambda v: v[0]),
        "next_date": days.map(lambda v: v[1] if len(v) > 1 else pd.NaT),
    })


def cohort_repeat(fact: pd.DataFrame) -> pd.DataFrame:
    np_ = _next_purchase(fact)
    last = fact.loc[fact["order_status"] == "delivered", "purchase_date"].max()
    np_["gap"] = (pd.to_datetime(np_["next_date"]) - pd.to_datetime(np_["first_date"])).dt.days
    np_["cohort_month"] = pd.to_datetime(np_["first_date"]).dt.to_period("M").astype(str)
    out = np_.groupby("cohort_month").agg(
        customers=("gap", "size"),
        returned_90d=("gap", lambda s: int((s <= 90).sum())),
        returned_180d=("gap", lambda s: int((s <= 180).sum())),
        returned_any=("gap", lambda s: int(s.notna().sum())),
    ).reset_index()
    out["return_rate_90d"] = out["returned_90d"] / out["customers"]
    out["return_rate_180d"] = out["returned_180d"] / out["customers"]
    month_end = pd.PeriodIndex(out["cohort_month"], freq="M").end_time.normalize()
    out["full_180d_followup"] = (month_end + pd.Timedelta(days=180)) <= last
    return out


def repeat_by_first_delivery(fact: pd.DataFrame) -> pd.DataFrame:
    last = fact.loc[fact["order_status"] == "delivered", "purchase_date"].max()
    firsts = fact[(fact["customer_delivered_order_seq"] == 1) & fact["in_timing_population"]]
    firsts = firsts[firsts["purchase_date"] + pd.Timedelta(days=180) <= last]
    nexts = (fact[(fact["order_status"] == "delivered") & (fact["customer_purchase_day_seq"] == 2)]
             .groupby("customer_unique_id")["purchase_date"].min().rename("next_date"))
    f = firsts.join(nexts, on="customer_unique_id")
    f["returned"] = (f["next_date"] - f["purchase_date"]).dt.days <= 180
    f["first_order_outcome"] = np.where(f["is_late"].astype(bool), "late", "on_time")
    out = f.groupby("first_order_outcome").agg(customers=("order_id", "size"), returned_180d=("returned", "sum")).reset_index()
    out["return_rate_180d"] = out["returned_180d"] / out["customers"]
    return out


def payment_reconciliation(fact: pd.DataFrame) -> pd.DataFrame:
    f = fact.assign(gap=fact["payment_total"] - fact["item_revenue"], has_voucher=fact["voucher_value"] > 0)
    out = f.groupby("reconciliation_class").agg(
        orders=("order_id", "size"), item_revenue=("item_revenue", "sum"), payment_total=("payment_total", "sum"),
        gap=("gap", "sum"), orders_with_voucher=("has_voucher", "sum"),
        statuses=("order_status", lambda s: ", ".join(sorted(s.unique()))),
    ).reset_index()
    return out.reindex(out["gap"].abs().sort_values(ascending=False).index).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Statistical comparison (pandas only)
# ---------------------------------------------------------------------------

def score_comparison(fact: pd.DataFrame) -> dict:
    """Late vs on-time review scores: Welch t-test and a 1-star proportion gap.

    Descriptive. Both tests assume orders are independent, which repeat
    customers and shared reviews slightly violate, and neither adjusts for
    confounders. They show the gap is far larger than sampling noise, nothing more.
    """
    t = timing(fact)
    t = t[t["review_score"].notna()]
    late = t.loc[t["is_late"].astype(bool), "review_score"].astype(float)
    ok = t.loc[~t["is_late"].astype(bool), "review_score"].astype(float)
    welch = stats.ttest_ind(late, ok, equal_var=False)
    diff = late.mean() - ok.mean()
    se = np.sqrt(late.var(ddof=1) / len(late) + ok.var(ddof=1) / len(ok))
    p1, p0 = (late == 1).mean(), (ok == 1).mean()
    se_p = np.sqrt(p1 * (1 - p1) / len(late) + p0 * (1 - p0) / len(ok))
    rho = stats.spearmanr(t["days_vs_estimate"].astype(float), t["review_score"].astype(float))
    return {
        "late_n": int(len(late)), "on_time_n": int(len(ok)),
        "mean_diff": float(diff), "mean_diff_ci95": [float(diff - 1.96 * se), float(diff + 1.96 * se)],
        "welch_t": float(welch.statistic), "welch_p": float(welch.pvalue),
        "pct_1star_diff": float(p1 - p0), "pct_1star_diff_ci95": [float(p1 - p0 - 1.96 * se_p), float(p1 - p0 + 1.96 * se_p)],
        "spearman_rho_days_vs_score": float(rho.statistic), "spearman_p": float(rho.pvalue),
    }


def peak_period_comparison(monthly: pd.DataFrame) -> pd.DataFrame:
    """Average delivery legs in the high-late months against neighbouring calm months."""
    periods = {
        "2017-10 (before)": ["2017-10"],
        "2017-11 to 2017-12": ["2017-11", "2017-12"],
        "2018-01 (between)": ["2018-01"],
        "2018-02 to 2018-03": ["2018-02", "2018-03"],
        "2018-04 to 2018-05 (after)": ["2018-04", "2018-05"],
    }
    rows = []
    m = monthly.set_index("month")
    for name, months in periods.items():
        g = m.loc[[x for x in months if x in m.index]]
        w = g["delivered_orders"]
        if w.sum() == 0:
            continue
        rows.append({
            "period": name,
            "delivered_orders": int(w.sum()),
            "late_rate": float(g["late_orders"].sum() / w.sum()),
            "avg_promised_days": float((g["avg_promised_days"] * w).sum() / w.sum()),
            "avg_actual_days": float((g["avg_actual_days"] * w).sum() / w.sum()),
            "avg_seller_handling_days": float((g["avg_seller_handling_days"] * w).sum() / w.sum()),
            "avg_carrier_transit_days": float((g["avg_carrier_transit_days"] * w).sum() / w.sum()),
        })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Headline metrics (same keys as mart.headline_metrics)
# ---------------------------------------------------------------------------

def headline_metrics(fact: pd.DataFrame, items_f: pd.DataFrame) -> dict[str, float]:
    t = timing(fact)
    late = t["is_late"].astype(bool)
    rv = t[t["review_score"].notna()]
    rv_late = rv["is_late"].astype(bool)
    score = rv["review_score"].astype(float)
    monthly = monthly_delivery(fact)
    win = monthly[monthly["in_window"]]
    routes = route_performance(fact).set_index("route")
    states = state_performance(fact).set_index("customer_state")
    rev = category_revenue(items_f)
    rep = customer_repeat(fact)
    gaps = score_gap_within_groups(fact).set_index("grouping")["weighted_score_gap"]
    sp_rj = routes.loc["SP → RJ"] if "SP → RJ" in routes.index else None
    return {
        "orders_total": len(fact),
        "timing_population_orders": len(t),
        "delivered_missing_date_orders": int((fact["delivery_outcome"] == "delivered_missing_date").sum()),
        "not_delivered_orders": int(fact["delivery_outcome"].isin(["not_delivered", "not_delivered_status_with_date"]).sum()),
        "late_orders": int(late.sum()),
        "late_rate": float(late.mean()),
        "late_rate_timestamp_rule": float(t["is_late_timestamp_rule"].astype(bool).mean()),
        "median_days_vs_estimate": float(t["days_vs_estimate"].astype(float).median()),
        "mean_days_vs_estimate": float(t["days_vs_estimate"].astype(float).mean()),
        "pct_7plus_days_early": float((t["days_vs_estimate"].astype(float) <= -7).mean()),
        "median_promised_days": float(t["promised_days"].astype(float).median()),
        "median_actual_days": float(t["actual_days"].astype(float).median()),
        "reviewed_delivered_orders": len(rv),
        "avg_score_on_time": float(score[~rv_late].mean()),
        "avg_score_late": float(score[rv_late].mean()),
        "score_gap_late_minus_on_time": float(score[rv_late].mean() - score[~rv_late].mean()),
        "pct_1star_on_time": float((score[~rv_late] == 1).mean()),
        "pct_1star_late": float((score[rv_late] == 1).mean()),
        "late_share_of_1star_reviews": float(((score == 1) & rv_late).sum() / (score == 1).sum()),
        "pct_late_answered_before_delivery": float(
            rv.loc[rv_late, "review_answered_before_delivery"].fillna(False).astype(bool).sum() / rv_late.sum()),
        "pct_late_low_scores_answered_before_delivery": float(
            rv.loc[rv_late & (score <= 2), "review_answered_before_delivery"].fillna(False).astype(bool).sum()
            / (rv_late & (score <= 2)).sum()) if (rv_late & (score <= 2)).any() else np.nan,
        "score_gap_within_state": float(gaps["customer_state"]),
        "score_gap_within_category": float(gaps["primary_category"]),
        "score_gap_within_seller": float(gaps["primary_seller"]),
        "orders_multi_seller": int((fact["n_sellers"] > 1).sum()),
        "route_sp_rj_share_of_delivered": float(sp_rj["share_of_delivered"]) if sp_rj is not None else np.nan,
        "route_sp_rj_share_of_late": float(sp_rj["share_of_late"]) if sp_rj is not None else np.nan,
        "route_sp_rj_late_rate": float(sp_rj["late_rate"]) if sp_rj is not None else np.nan,
        "state_rj_late_rate": float(states.loc["RJ", "late_rate"]) if "RJ" in states.index else np.nan,
        "peak_month_late_rate": float(win["late_rate"].max()),
        "min_month_late_rate": float(win["late_rate"].min()),
        "items_revenue_all_orders": float(fact["item_revenue"].sum()),
        "payments_total_all_orders": float(fact["payment_total"].sum()),
        "payments_minus_items": float(fact["payment_total"].sum() - fact["item_revenue"].sum()),
        "items_revenue_delivered": float(fact.loc[fact["order_status"] == "delivered", "item_revenue"].sum()),
        "top_category_revenue_share": float(rev["revenue_share"].max()),
        "top10_categories_revenue_share": float(rev.loc[rev["revenue_rank"] == 10, "cumulative_share"].max()),
        "customers_with_delivered_order": rep["customers"],
        "repeat_customer_rate": rep["repeat_rate"],
        "two_plus_orders_rate": rep["two_plus_orders_rate"],
    }


def all_tables(fact: pd.DataFrame, items_f: pd.DataFrame) -> dict[str, pd.DataFrame]:
    monthly = monthly_delivery(fact)
    return {
        "delivery_population": delivery_population(fact),
        "estimate_accuracy": estimate_accuracy(fact),
        "review_by_delay": review_by_delay(fact),
        "monthly_delivery": monthly,
        "monthly_by_destination": monthly_by_destination(fact),
        "route_performance": route_performance(fact),
        "category_performance": category_performance(fact),
        "state_performance": state_performance(fact),
        "score_gap_within_groups": score_gap_within_groups(fact),
        "category_revenue": category_revenue(items_f),
        "cohort_repeat": cohort_repeat(fact),
        "repeat_by_first_delivery": repeat_by_first_delivery(fact),
        "payment_reconciliation": payment_reconciliation(fact),
        "peak_period_comparison": peak_period_comparison(monthly),
    }

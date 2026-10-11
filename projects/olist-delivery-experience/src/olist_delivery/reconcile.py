"""Compare SQL (DuckDB) results with the independent pandas results.

Two kinds of comparison:
  * headline metrics, key by key (mart.headline_metrics vs analyze.headline_metrics)
  * whole tables, row by row on their keys, every shared numeric column
Counts must match exactly; rates and averages within 1e-9; money within one cent.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from . import database
from .config import MONEY_TOLERANCE

MONEY_METRICS = {"items_revenue_all_orders", "payments_total_all_orders", "payments_minus_items", "items_revenue_delivered"}
COUNT_SUFFIXES = ("_orders", "orders_total", "orders_multi_seller", "customers_with_delivered_order")

TABLE_KEYS = {
    "review_by_delay": ["delay_bucket"],
    "monthly_delivery": ["month"],
    "monthly_by_destination": ["month", "destination"],
    "route_performance": ["route"],
    "category_performance": ["category"],
    "state_performance": ["customer_state"],
    "score_gap_within_groups": ["grouping"],
    "category_revenue": ["category"],
    "cohort_repeat": ["cohort_month"],
    "repeat_by_first_delivery": ["first_order_outcome"],
    "payment_reconciliation": ["reconciliation_class"],
    "estimate_accuracy": ["days_vs_estimate"],
}
MONEY_COLUMNS = {"price", "freight", "revenue", "item_revenue", "payment_total", "gap"}


def _tolerance(name: str) -> float:
    if name in MONEY_METRICS or name in MONEY_COLUMNS:
        return MONEY_TOLERANCE
    return 1e-9


def _match(a, b, tol: float) -> bool:
    a = float("nan") if a is None else float(a)
    b = float("nan") if b is None else float(b)
    if math.isnan(a) or math.isnan(b):
        return math.isnan(a) and math.isnan(b)
    return abs(a - b) <= tol * max(1.0, abs(a)) if tol < 1e-6 else abs(a - b) <= tol


def compare_metrics(sql: dict[str, float], py: dict[str, float]) -> pd.DataFrame:
    rows = []
    for key in sorted(set(sql) | set(py)):
        s, p = sql.get(key), py.get(key)
        tol = _tolerance(key)
        rows.append({
            "metric": key,
            "sql": s,
            "python": p,
            # Rounded so float noise from parallel summation does not change the committed file.
            "abs_diff": round(abs(float(s) - float(p)), 12) if s is not None and p is not None else float("nan"),
            "tolerance": tol,
            "match": _match(s, p, tol),
        })
    return pd.DataFrame(rows)


def compare_table(name: str, sql_df: pd.DataFrame, py_df: pd.DataFrame) -> dict:
    keys = TABLE_KEYS[name]
    s = sql_df.copy()
    p = py_df.copy()
    for k in keys:
        s[k] = s[k].astype(str)
        p[k] = p[k].astype(str)
    merged = s.merge(p, on=keys, how="outer", suffixes=("_sql", "_py"), indicator=True)
    unmatched = int((merged["_merge"] != "both").sum())
    both = merged[merged["_merge"] == "both"]
    shared = [c for c in s.columns if c in p.columns and c not in keys
              and pd.api.types.is_numeric_dtype(s[c]) and pd.api.types.is_numeric_dtype(p[c])]
    worst, bad_cols = 0.0, []
    for c in shared:
        a = pd.to_numeric(both[f"{c}_sql"], errors="coerce").astype(float).to_numpy()
        b = pd.to_numeric(both[f"{c}_py"], errors="coerce").astype(float).to_numpy()
        nan_mismatch = np.isnan(a) != np.isnan(b)
        diff = np.where(np.isnan(a) | np.isnan(b), 0.0, np.abs(a - b))
        tol = _tolerance(c)
        limit = tol if c in MONEY_COLUMNS else tol * np.maximum(1.0, np.abs(np.nan_to_num(a)))
        if nan_mismatch.any() or (diff > limit).any():
            bad_cols.append(c)
        worst = max(worst, float(diff.max()) if len(diff) else 0.0)
    return {
        "metric": f"table:{name}",
        "sql": float(len(s)),
        "python": float(len(p)),
        "abs_diff": round(worst, 12),
        "tolerance": None,
        "match": unmatched == 0 and not bad_cols and len(s) == len(p),
        "detail": f"{len(both)} rows x {len(shared)} numeric columns compared"
                  + (f"; mismatched: {', '.join(bad_cols)}" if bad_cols else "")
                  + (f"; {unmatched} unmatched keys" if unmatched else ""),
    }


def reconcile(db_path, py_metrics: dict[str, float], py_tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    sql_metrics = dict(database.read_table(db_path, "mart.headline_metrics").itertuples(index=False, name=None))
    metric_rows = compare_metrics(sql_metrics, py_metrics)
    metric_rows["detail"] = ""
    table_rows = []
    for name in TABLE_KEYS:
        if name in py_tables:
            table_rows.append(compare_table(name, database.read_table(db_path, f"mart.{name}"), py_tables[name]))
    return pd.concat([metric_rows, pd.DataFrame(table_rows)], ignore_index=True)

"""Recompute every card on the original Power BI report from the daily tables.

Power BI applies a page's date slicer to the slicer's own table and then pushes
that filter along active relationships. In the original model the tables were
joined to each other on ``creation date`` with one-to-one, two-way relationships,
so a card only respected the slicer if an active chain of those joins connected
its table to the slicer's table, and then only on dates every table along the
chain had a row for. This module follows the same rules, so the reproduced card
values can be checked against what the report showed.
"""

from __future__ import annotations

import math
import re
from collections import deque

import pandas as pd

from .catalog import BY_TABLE

DATE = "creation date"


def _date_graph(relationships: list[dict]) -> dict[str, set[str]]:
    graph: dict[str, set[str]] = {}
    for r in relationships:
        if not r["active"] or r["from_column"] != DATE or r["to_column"] != DATE:
            continue
        a, b = r["from_table"], r["to_table"]
        graph.setdefault(a, set()).add(b)
        if r["cross_filter"] == "Both":
            graph.setdefault(b, set()).add(a)
    return graph


def filter_path(relationships: list[dict], source: str, target: str) -> list[str] | None:
    """Tables a filter crosses from ``source`` to ``target`` (both included), or None."""
    if source == target:
        return [source]
    graph = _date_graph(relationships)
    prev: dict[str, str | None] = {source: None}
    queue = deque([source])
    while queue:
        node = queue.popleft()
        for nxt in graph.get(node, ()):
            if nxt not in prev:
                prev[nxt] = node
                if nxt == target:
                    path = [nxt]
                    while prev[path[-1]] is not None:
                        path.append(prev[path[-1]])
                    return path[::-1]
                queue.append(nxt)
    return None


def _series(daily: pd.DataFrame, table: str) -> pd.Series:
    key = BY_TABLE[table].key
    return daily.set_index("date")[key].dropna()


def _window(s: pd.Series, window: dict | None) -> pd.Series:
    if not window:
        return s
    return s[(s.index >= window["start"]) & (s.index < window["end_exclusive"])]


AGGREGATE = {
    "sum": lambda s: s.sum(),
    "average": lambda s: s.mean(),
    "min": lambda s: s.min(),
    "max": lambda s: s.max(),
}


def parse_shown(text: str) -> tuple[float, float]:
    """Value and display precision of a card label such as ``72.26K``."""
    m = re.fullmatch(r"([\d.]+)([KM]?)", text.strip())
    if not m:
        raise ValueError(text)
    number, suffix = m.groups()
    scale = {"": 1, "K": 1e3, "M": 1e6}[suffix]
    decimals = len(number.split(".")[1]) if "." in number else 0
    return float(number) * scale, 0.5 * 10 ** -decimals * scale


def card_value(daily: pd.DataFrame, relationships: list[dict], page: dict, visual: dict) -> dict:
    table = visual["table"]
    values = _series(daily, table)
    slicer = page.get("slicer")
    path = filter_path(relationships, slicer["table"], table) if slicer else None
    reached = path is not None
    if reached:
        allowed = _window(_series(daily, slicer["table"]), slicer["window"]).index
        for hop in path[1:-1]:
            allowed = allowed.intersection(_series(daily, hop).index)
        values = values[values.index.isin(allowed)]
    values = _window(values, visual.get("visual_filter"))
    return {
        "value": float(AGGREGATE[visual["aggregation"]](values)) if len(values) else None,
        "days": int(len(values)),
        "slicer_reached": reached,
        "path": path,
    }


def reproduce_cards(daily: pd.DataFrame, model: dict, shown: pd.DataFrame) -> list[dict]:
    """One row per card: what the report showed, what the rebuild computes, and whether they agree."""
    rows = []
    rels = model["relationships"]
    for page in model["pages"]:
        for visual in page["visuals"]:
            if visual["type"] not in ("card", "multiRowCard", "gauge"):
                continue
            match = shown[(shown["page"] == page["name"]) & (shown["label"] == visual["label"])]
            if match.empty:
                raise KeyError(f"No displayed value recorded for {page['name']} / {visual['label']}")
            text = match["shown"].iloc[0]
            target, tolerance = parse_shown(text)
            result = card_value(daily, rels, page, visual)
            value = result["value"]
            agrees = value is not None and math.isclose(value, target, abs_tol=tolerance + 1e-9)
            rows.append(
                {
                    "page": page["name"],
                    "label": visual["label"],
                    "metric": BY_TABLE[visual["table"]].key,
                    "aggregation": visual["aggregation"],
                    "shown": text,
                    "rebuilt": value,
                    "days": result["days"],
                    "matches": bool(agrees),
                    "slicer_reached": result["slicer_reached"],
                    "filtered_through": result["path"][1:-1] if result["path"] else [],
                    "own_filter": visual.get("visual_filter") is not None,
                }
            )
    return rows

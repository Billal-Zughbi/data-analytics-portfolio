"""Read the original Power BI report file (``AppleHealthReport.pbix``).

This is the private ingest step. It runs only where the ``.pbix`` exists (it is
git-ignored) and writes two public-safe files:

``data/original/daily_metrics.csv``
    One row per date, one column per metric, exactly as the report's Power Query
    left each table: values are the daily rows the report charted. No device
    names, no times of day, no record-level data.
``data/original/report_model.json``
    How the report was built: each table's daily rule and filters from Power Query,
    the relationships, and every card, chart and slicer on the four pages, read
    from the report layout. File paths and device names are not copied.

Reading the data model needs ``pbixray`` (``pip install -r requirements-pbix.txt``).
"""

from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

import pandas as pd

from .catalog import BY_TABLE, CATALOG, SKIPPED_TABLES

# Power BI query aggregation codes used in the report layout.
AGG_FUNCTIONS = {0: "sum", 1: "average", 2: "count", 3: "min", 4: "max", 5: "count_non_null", 6: "median"}
DATE_COLUMN = "creation date"


def _model(pbix: Path):
    try:
        from pbixray import PBIXRay
    except ImportError as exc:  # pragma: no cover - only hit without the optional dependency
        raise SystemExit("Reading a .pbix needs pbixray: pip install -r requirements-pbix.txt") from exc
    return PBIXRay(str(pbix))


def read_daily(model) -> pd.DataFrame:
    """Wide daily table: ``date`` plus one column per catalog metric."""
    columns = {}
    for metric in CATALOG:
        if metric.table is None or metric.table not in model.tables:
            continue
        df = model.get_table(metric.table)
        dates = pd.to_datetime(df[DATE_COLUMN]).dt.normalize()
        values = pd.to_numeric(df["value"], errors="coerce").astype(float) * metric.scale
        series = pd.Series(values.to_numpy(), index=dates)
        if series.index.duplicated().any():
            raise ValueError(f"{metric.table} has more than one row per day; expected the grouped table")
        columns[metric.key] = series
    wide = pd.DataFrame(columns).sort_index()
    wide.index.name = "date"
    return wide.reset_index()


def _power_query_rule(expression: str) -> dict:
    """Summarise a table's M query without copying paths or device names."""
    group = re.search(r'Table\.Group\([^{]*\{"creation date"\}\s*,\s*\{\{"value",\s*each\s+List\.(\w+)', expression)
    device_filters = re.findall(r'\[sourceName\]\s*=\s*"[^"]*"', expression)
    value_filter = re.search(r"Table\.SelectRows\([^,]+,\s*each\s*\((\[value\][^)]*)\)", expression)
    return {
        "daily_rule": group.group(1).lower() if group else None,
        "device_filter": bool(device_filters),
        "devices_kept": len(set(device_filters)) or None,
        "hard_coded_value_exclusions": len(re.findall(r"\[value\]\s*<>", value_filter.group(1))) if value_filter else 0,
        "day_from": "creationDate" if "creationDate" in expression else None,
    }


def _filter_window(filter_json: dict) -> dict | None:
    """Date window of a slicer or visual filter, as ISO dates (inclusive start, exclusive end)."""
    text = json.dumps(filter_json)
    dates = re.findall(r"datetime'(\d{4}-\d{2}-\d{2})T", text)
    if len(dates) < 2:
        return None
    kinds = re.findall(r'"ComparisonKind": (\d)', text)
    start, end = dates[0], dates[1]
    # ComparisonKind 3 is "less than" (exclusive), 4 is "less than or equal".
    # DateSpan on a day means the whole day is included, so make it exclusive.
    if len(kinds) >= 2 and kinds[1] == "4":
        end = (pd.Timestamp(end) + pd.Timedelta(days=1)).date().isoformat()
    return {"start": start, "end_exclusive": end}


def read_layout(pbix: Path) -> list[dict]:
    """Pages with their slicer, cards and charts, from ``Report/Layout``."""
    with zipfile.ZipFile(pbix) as zf:
        layout = json.loads(zf.read("Report/Layout").decode("utf-16-le"))
    pages = []
    for section in layout["sections"]:
        page = {"name": re.sub(r"[^\w &]", "", section["displayName"]).strip(), "slicer": None, "visuals": []}
        for container in section["visualContainers"]:
            config = json.loads(container["config"])
            visual = config.get("singleVisual", {})
            vtype = visual.get("visualType")
            query = visual.get("prototypeQuery", {})
            if vtype == "slicer":
                general = visual["objects"]["general"][0]["properties"]["filter"]["filter"]
                page["slicer"] = {"table": query["From"][0]["Entity"], "window": _filter_window(general)}
                continue
            selects = [s for s in query.get("Select", []) if "Aggregation" in s]
            if not selects:
                continue
            entities = {f["Name"]: f["Entity"] for f in query.get("From", [])}
            axis = [s for s in query.get("Select", []) if "Column" in s]
            filters = json.loads(container.get("filters") or "[]")
            window = None
            for f in filters:
                if f.get("filter"):
                    window = _filter_window(f["filter"])
            props = visual.get("columnProperties") or {}
            for s in selects:
                agg = s["Aggregation"]
                source = agg["Expression"]["Column"]["Expression"]["SourceRef"]["Source"]
                page["visuals"].append(
                    {
                        "type": vtype,
                        "label": (props.get(s["Name"]) or {}).get("displayName") or s.get("NativeReferenceName"),
                        "table": entities[source],
                        "aggregation": AGG_FUNCTIONS.get(agg["Function"], str(agg["Function"])),
                        "axis_table": entities[axis[0]["Column"]["Expression"]["SourceRef"]["Source"]] if axis else None,
                        "visual_filter": window,
                    }
                )
        pages.append(page)
    return pages


def read_report_model(model, pbix: Path) -> dict:
    pq = model.power_query
    tables = []
    for _, row in pq.iterrows():
        name = row["TableName"]
        metric = BY_TABLE.get(name)
        df = model.get_table(name) if name in model.tables else None
        entry = {"table": name, "metric": metric.key if metric else None, **_power_query_rule(row["Expression"])}
        if df is not None and DATE_COLUMN in df:
            entry.update(rows=int(len(df)), first=str(pd.Timestamp(df[DATE_COLUMN].min()).date()),
                         last=str(pd.Timestamp(df[DATE_COLUMN].max()).date()))
        if name in SKIPPED_TABLES:
            entry["skipped"] = SKIPPED_TABLES[name]
        tables.append(entry)

    rel = model.relationships
    rel = rel[~rel["ToTableName"].astype(str).str.startswith(("LocalDateTable", "DateTableTemplate"))]
    relationships = [
        {
            "from_table": r.FromTableName, "from_column": r.FromColumnName,
            "to_table": r.ToTableName, "to_column": r.ToColumnName,
            "active": bool(r.IsActive), "cardinality": r.Cardinality, "cross_filter": r.CrossFilteringBehavior,
        }
        for r in rel.itertuples()
    ]
    measures = [
        {"table": r.TableName, "name": r.Name, "expression": r.Expression}
        for r in model.dax_measures.itertuples()
    ]
    return {
        "source": "AppleHealthReport.pbix (March 2025), read with pbixray. The file itself is not committed.",
        "tables": sorted(tables, key=lambda t: t["table"]),
        "relationships": relationships,
        "measures": measures,
        "pages": read_layout(pbix),
    }


def ingest(pbix: Path, out_dir: Path) -> list[Path]:
    model = _model(pbix)
    out_dir.mkdir(parents=True, exist_ok=True)
    daily = read_daily(model)
    daily_out = daily.copy()
    daily_out["date"] = daily_out["date"].dt.strftime("%Y-%m-%d")
    for m in CATALOG:
        if m.key in daily_out:
            daily_out[m.key] = daily_out[m.key].round(max(m.decimals + 2, 3))
    csv_path = out_dir / "daily_metrics.csv"
    daily_out.to_csv(csv_path, index=False)

    report = read_report_model(model, pbix)
    json_path = out_dir / "report_model.json"
    json_path.write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return [csv_path, json_path]

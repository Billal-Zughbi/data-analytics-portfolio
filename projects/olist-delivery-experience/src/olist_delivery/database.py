"""Build the DuckDB database from the SQL files and run the validations.

The database file lives in data/interim/ (git-ignored). Each SQL file is split
into statements with DuckDB's own parser so a failure names the file and the
statement that broke.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

import duckdb
import pandas as pd

from .config import MIN_GROUP_ORDERS, MONTH_END, MONTH_START, SQL_DIR, WILSON_Z
from .ingest import require_files

SQL_FILES = [
    "00_schema.sql",
    "01_staging.sql",
    "02_transformations.sql",
    "03_analytics.sql",
    "04_validation.sql",
]


class ValidationError(RuntimeError):
    """Raised when one or more 'error' validation checks fail."""


@dataclass
class BuildResult:
    db_path: Path
    validation: pd.DataFrame
    seconds: float

    @property
    def failed_errors(self) -> pd.DataFrame:
        v = self.validation
        return v[(v["severity"] == "error") & (~v["passed"])]

    @property
    def failed_warnings(self) -> pd.DataFrame:
        v = self.validation
        return v[(v["severity"] == "warn") & (~v["passed"])]


def _sql_literal(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def set_variables(con: duckdb.DuckDBPyConnection, data_dir: Path) -> None:
    con.execute(f"SET VARIABLE olist_data_dir = {_sql_literal(Path(data_dir).as_posix())}")
    con.execute(f"SET VARIABLE month_start = {_sql_literal(MONTH_START)}")
    con.execute(f"SET VARIABLE month_end = {_sql_literal(MONTH_END)}")
    con.execute(f"SET VARIABLE min_group_orders = {int(MIN_GROUP_ORDERS)}")
    con.execute(f"SET VARIABLE wilson_z = {float(WILSON_Z)}")


def run_sql_file(con: duckdb.DuckDBPyConnection, path: Path) -> int:
    statements = con.extract_statements(path.read_text(encoding="utf-8"))
    for i, stmt in enumerate(statements, start=1):
        try:
            con.execute(stmt.query)
        except duckdb.Error as exc:
            first_line = next((ln.strip() for ln in stmt.query.strip().splitlines() if ln.strip() and not ln.strip().startswith("--")), "")
            raise RuntimeError(f"{path.name}, statement {i} ({first_line[:80]}): {exc}") from exc
    return len(statements)


def build(data_dir: Path, db_path: Path, sql_dir: Path = SQL_DIR, verbose: bool = True) -> BuildResult:
    """Run 00-04 against the raw CSVs in data_dir into db_path."""
    require_files(data_dir)
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()
    start = time.perf_counter()
    con = duckdb.connect(str(db_path))
    try:
        set_variables(con, data_dir)
        for name in SQL_FILES:
            t0 = time.perf_counter()
            n = run_sql_file(con, sql_dir / name)
            if verbose:
                print(f"  {name:<24} {n:>3} statements  {time.perf_counter() - t0:5.1f}s")
        validation = con.execute(
            "SELECT * FROM qa.validation_results ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END, check_group, check_name"
        ).df()
    finally:
        con.close()
    validation["passed"] = validation["passed"].astype(bool)
    return BuildResult(db_path=db_path, validation=validation, seconds=time.perf_counter() - start)


def print_validation(result: BuildResult) -> None:
    v = result.validation
    for row in v.itertuples(index=False):
        status = "PASS" if row.passed else ("FAIL" if row.severity == "error" else "WARN")
        if row.severity == "info":
            status = "INFO"
        actual = f"{row.actual:,.2f}".rstrip("0").rstrip(".") if pd.notna(row.actual) else "NULL"
        print(f"  [{status}] {row.check_group:<22} {row.check_name:<48} actual={actual:<12} {row.detail or ''}")
    counts = v.groupby(["severity", "passed"]).size()
    print(f"  {len(v)} checks: " + ", ".join(f"{sev}/{'pass' if ok else 'fail'}={n}" for (sev, ok), n in counts.items()))


def assert_valid(result: BuildResult) -> None:
    failed = result.failed_errors
    if len(failed):
        names = ", ".join(failed["check_name"])
        raise ValidationError(f"{len(failed)} validation check(s) failed: {names}")


def read_table(db_path: Path, table: str) -> pd.DataFrame:
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        return con.execute(f"SELECT * FROM {table}").df()
    finally:
        con.close()


def query(db_path: Path, sql: str) -> pd.DataFrame:
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        return con.execute(sql).df()
    finally:
        con.close()

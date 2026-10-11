from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest

from olist_delivery import clean, database, ingest
from olist_delivery.config import DATA_DIR_ENV, DEFAULT_RAW_DIR, FILES

# The fixture files use neutral names (orders.csv, order_items.csv, ...) because the
# repository ignores the real Olist file names everywhere. They are copied into a
# temporary folder under the official names before each test session.
FIXTURE_SRC = Path(__file__).parent / "fixtures" / "mini"


def materialise_fixture(target: Path) -> Path:
    target.mkdir(parents=True, exist_ok=True)
    for key, name in FILES.items():
        shutil.copyfile(FIXTURE_SRC / f"{key}.csv", target / name)
    return target


def real_data_dir() -> Path | None:
    """The real raw folder if all nine files are there, else None."""
    candidates = [os.environ.get(DATA_DIR_ENV), DEFAULT_RAW_DIR]
    for c in candidates:
        if c and all((Path(c) / f).is_file() for f in FILES.values()):
            return Path(c)
    return None


@pytest.fixture(scope="session")
def fixture_dir(tmp_path_factory) -> Path:
    return materialise_fixture(tmp_path_factory.mktemp("mini_raw"))


@pytest.fixture(scope="session")
def fixture_frames(fixture_dir):
    return ingest.read_raw(fixture_dir)


@pytest.fixture(scope="session")
def fixture_fact(fixture_frames):
    fact, items = clean.order_fact(fixture_frames)
    return fact.set_index("order_id", drop=False), items


@pytest.fixture(scope="session")
def fixture_db(tmp_path_factory, fixture_dir):
    db = tmp_path_factory.mktemp("db") / "mini.duckdb"
    return database.build(fixture_dir, db, verbose=False)

# Data folders

| Folder | In git? | Contents |
|---|---|---|
| `raw/` | **No** (ignored) | The Apple Health export (`export.zip`, `apple_health_export/`, workout routes). Never commit. |
| `interim/`, `private/`, `personal/` | **No** (ignored) | Any record-level or personal scratch data. |
| `daily/` | Yes | Written by `ingest-xml` from the October 2026 export: one row per day per metric, workouts per month and activity (walks, runs and rides also split into indoor and outdoor, from the tag the Workout app saves), and a source profile with counts only. |
| `original/` | Yes | Written by `ingest-pbix` from the March 2025 report: its daily tables, Power Query rules, relationships and report layout, plus the card values the report displayed. |
| `model/` | Yes | Written by `build`: the Power BI star schema. |

Published files hold dates and daily values only: no device names, times of day, record-level rows or routes.
The tests in `tests/test_report.py` check this on every run. The owner agreed to publish these daily values.

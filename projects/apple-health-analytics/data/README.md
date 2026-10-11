# Data folders

| Folder | Tracked in git? | Contents |
|---|---|---|
| `raw/` | **No** (ignored) | Your Apple Health `export.zip` / `apple_health_export/`. Never commit. |
| `interim/`, `private/`, `personal/` | **No** (ignored) | Any scratch or row-level data. |
| `sanitized/` | Yes, after review | Daily aggregates produced by `python -m apple_health run`. |
| `sample/` | Yes | Outputs from **synthetic** data (`python -m apple_health demo`). |

Sanitized outputs contain only daily totals/means for 40 allowlisted metrics.
They contain no timestamps, time zones, device or app names, workout routes,
ECGs, clinical records, or reproductive/sexual health data.

Review `sanitized/` before committing it, and run
`python3 scripts/check_sensitive_files.py` from the repository root.

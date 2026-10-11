# Data folders

| Folder | In git? | Contents |
|---|---|---|
| `raw/` | **No** (ignored) | Your own Apple Health export (`export.zip`, `apple_health_export/`). Never commit. |
| `interim/`, `private/`, `personal/` | **No** (ignored) | Any record-level or personal scratch data. |
| `synthetic/` | **No** (ignored) | `export.xml` written by `python -m apple_health demo`. Synthetic, but ~20 MB and fully reproducible. |
| `sample/` | Yes | Small daily tables generated from the **synthetic** export: the wide daily table and the Power BI star schema. |

No real personal data, real daily aggregates, device names or timestamps are published from this project.
Daily aggregates of a real person's data can still be identifying, so they stay local too.

# Data folders

| Folder | In git? | Contents |
|---|---|---|
| `raw/` | **No** (ignored by `projects/**/data/raw/`) | The nine Olist CSVs, if you keep them inside the project. |
| `interim/` | **No** (ignored by `projects/**/data/interim/`) | `olist.duckdb`, the database built by `python -m olist_delivery build` (about 115 MB, rebuilt in under 10 seconds). |
| `sample/` | Yes | Small aggregate tables for the Power BI model, written by `python -m olist_delivery export`. |

## Getting the raw data

The raw files are not committed: they are about 126 MB and the reviews file contains customers' free-text
comments. Use one of these:

```bash
# Kaggle CLI (needs a Kaggle API token in ~/.kaggle/kaggle.json)
kaggle datasets download -d olistbr/brazilian-ecommerce -p data/raw --unzip

# Or download the zip from https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce
# and extract the nine CSVs into data/raw/
```

You can also keep the files anywhere else and point the pipeline at them:

```bash
export OLIST_DATA_DIR=/path/to/olist/csvs        # or pass --data-dir on each command
python -m olist_delivery check                   # row counts, checksums, detected version
```

The run published here used a GitHub mirror of the dataset because the build environment could not reach Kaggle.
Its reviews file is the earlier 100,000-row release; the other eight files match Kaggle version 2. See
[`docs/methodology.md`](../docs/methodology.md#source-and-version).

## What is in `sample/` and why it is safe to publish

Nine CSVs, about 450 KB in total: five aggregated fact tables and four small dimensions (grain and columns in
[`docs/data-dictionary.md`](../docs/data-dictionary.md#power-bi-tables-datasample)).

* No order, customer, seller, product or review identifiers, and no review text. `export.assert_public_safe`
  refuses to write a file that contains any of those columns, and `tests/test_outputs.py` checks again.
* They are derived from the Olist dataset, licensed **CC BY-NC-SA 4.0**. You may share and adapt them for
  non-commercial use with attribution to Olist, under the same licence.

An order-level fact was not published: at 99,441 rows it would be several megabytes even without identifiers,
so the model uses facts aggregated by month and route, month and category, and month, delay bucket and score.

# Tool logo sources

The tool logos in `website/public/logos/` are copied byte for byte from the official or open-source files listed
below. None of them is redrawn, recolored, cropped or otherwise edited; the SHA-256 column lets anyone check that.
Where a logo needs a light backing to stay visible on the dark site (pandas), the site draws a plate behind the
untouched image instead of changing the file.

Each logo is a trademark of its owner and is used only to name a tool I have worked with. Tools without an
official logo (DAX, Power Query, SQL and others) are shown by name only.

| Site file | Source | Original file | License of the source | SHA-256 (first 12) |
|---|---|---|---|---|
| `power-bi.svg` | [MicrosoftDocs/power-platform](https://github.com/MicrosoftDocs/power-platform), `power-platform/media/hub-page/` | `power-bi.svg` | CC BY 4.0 (repository docs) | `75b2e20358ee` |
| `power-apps.svg` | same folder | `power-apps.svg` | CC BY 4.0 (repository docs) | `c357907ad0a2` |
| `power-automate.svg` | same folder | `power-automate.svg` | CC BY 4.0 (repository docs) | `2025db7bb3fe` |
| `microsoft-fabric.svg` | npm [`@fabric-msft/svg-icons`](https://www.npmjs.com/package/@fabric-msft/svg-icons) 11.0.0 (Microsoft), `svg/` | `fabric_48_color.svg` | MIT | `ef80d2edbfc1` |
| `excel.svg` | npm [`@fabric-msft/visuals`](https://www.npmjs.com/package/@fabric-msft/visuals) 6.0.0 (Microsoft), `data/gsExcel64.js`, light variant (base64 decoded, no other change) | `gsExcel64` | MIT | `23b125bcb5c9` |
| `sql-server.svg` | same package, `data/gsSqlServer64.js`, light variant | `gsSqlServer64` | MIT | `599496ba3202` |
| `github.svg` | same package, `data/gsGithub64.js`, light variant | `gsGithub64` | MIT | `2ea37795aab5` |
| `snowflake.svg` | [gilbarbara/logos](https://github.com/gilbarbara/logos), `logos/` | `snowflake-icon.svg` | CC0 1.0 | `49ac685600ec` |
| `python.svg` | same folder | `python.svg` | CC0 1.0 | `8858ab3564ea` |
| `pandas.svg` | same folder | `pandas-icon.svg` | CC0 1.0 | `212cfe8b9bf0` |
| `git.svg` | same folder | `git-icon.svg` | CC0 1.0 | `d59a2cfd1583` |
| `pytest.svg` | [devicons/devicon](https://github.com/devicons/devicon), `icons/pytest/` | `pytest-original.svg` | MIT | `e3073e7f5208` |
| `azure-devops.svg` | same repository, `icons/azuredevops/` | `azuredevops-original.svg` | MIT | `49122a384572` |

Downloaded on 13 October 2026. To check a file: `sha256sum website/public/logos/*.svg`.

The Apple Fitness rings image (`website/public/images/apple-fitness.png`) is the file supplied for the site,
used as sent.

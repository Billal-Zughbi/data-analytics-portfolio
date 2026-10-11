# Dataset selection for the second wave of projects

Written 11 October 2026 while choosing data for the two projects added after Apple Health. Every access result
below was actually tried from the build environment on that date. That environment reaches only a short list of hosts
(GitHub raw content, package registries); most government and data-portal hosts returned HTTP 403 from its network
proxy. That constraint shaped the choices, and it is recorded here so nobody mistakes it for a judgement about
the sources themselves.

## Project A: e-commerce delivery and customer reviews

| Candidate | What it offers | Licence / terms | Access from the build environment | Decision |
|---|---|---|---|---|
| **Brazilian E-Commerce Public Dataset by Olist** (Kaggle, `olistbr/brazilian-ecommerce`) | ~100k real, anonymised marketplace orders 2016–2018 across 9 related tables: orders, items, payments, reviews, customers, sellers, products, geolocation, category names | **CC BY-NC-SA 4.0** (Kaggle API metadata, version 2, last updated 2021-10-01) | Kaggle blocked (403). The nine original CSVs were retrieved from a public GitHub copy (`dujiaying/olist`) and checked against Kaggle's published file sizes and row counts | **Selected** |
| Online Retail II (UCI Machine Learning Repository) | Two years of transactions for one UK gift retailer, one table | CC BY 4.0 | Blocked (403) | Not selected: one table, no fulfilment or review data, so it cannot support a delivery question |
| theLook eCommerce (Google BigQuery public data) | Multi-table, regularly refreshed | Public dataset terms | No Google Cloud credentials in the environment | Not selected: the data is **synthetic**, and the portfolio's real-data projects should use real data |
| Instacart Market Basket (Kaggle) | 3M grocery orders, basket contents | Released for a Kaggle competition; terms could not be checked from here | Blocked | Not selected: no prices, delivery or review fields, so it cannot support a fulfilment question |

**Why Olist.** It is the only candidate with real orders *and* the fields to connect fulfilment to customer
outcomes: promised date, actual delivery date, seller and customer locations, and a review score per order. That makes a
specific question possible (does late delivery hurt reviews, and where do late orders come from?) instead of a generic
sales dashboard.

**Licence consequences.** CC BY-NC-SA 4.0 allows sharing and adapting with attribution, for non-commercial
purposes, under the same licence. The portfolio is non-commercial. Derived aggregates are published with
attribution and labelled CC BY-NC-SA 4.0. The raw CSVs (126 MB) are not committed because of their size; the project
documents how to download them from Kaggle. Review text is never published.

**Provenance check of the GitHub copy.** The nine files total 126,144,332 bytes, against Kaggle's reported 126,186,995
for the same nine files (a 0.03% difference). Eight of the nine files match Kaggle version 2's row counts exactly.
The reviews file has 100,000 rows against 99,224 in version 2, which matches the dataset's earlier 100,000-review
release, so review figures could shift slightly on version 2. The pipeline detects which version it loaded and says so. SHA-256 hashes of the retrieved files are recorded in the project's `data/README.md`.

## Project B: originally housing affordability, replaced by exploited vulnerabilities

The first plan was regional housing affordability against labour-market data. It was dropped after checking access:

| Candidate | Licence / terms | Access | Notes |
|---|---|---|---|
| Census Bureau ACS API (`api.census.gov`) and bulk files (`www2.census.gov`) | Public domain (US federal work) | Blocked (403) | Would have been the housing-cost and income source |
| BLS OEWS and LAUS (`www.bls.gov`, `download.bls.gov`) | Public domain | Blocked (403) | Would have been the wage and unemployment source |
| Zillow research data, HUD Fair Market Rents | Zillow terms restrict redistribution; HUD is public domain | Blocked (403) | Considered as rent sources |

The owner was offered three options: allow those hosts, use unofficial GitHub copies of Census and BLS tables, or change the
topic. They chose to change the topic and asked for something that would interest employers, suggesting finance,
politics or cybersecurity. Finance (SEC EDGAR, FRED) and campaign-finance sources (FEC) were blocked as well. A
cybersecurity topic could be built entirely from official sources that *are* reachable:

| Candidate | What it offers | Licence / terms | Access | Decision |
|---|---|---|---|---|
| **CISA Known Exploited Vulnerabilities (KEV) catalog**, via CISA's own GitHub repository `cisagov/kev-data` (CISA states it is kept in sync with cisa.gov within minutes) | Every vulnerability the US Cybersecurity and Infrastructure Security Agency has confirmed as exploited in the wild, with the date added, the remediation due date, the vendor and product, ransomware use and CWE | **CC0 1.0** (repository LICENSE, identical to cisa.gov's licence text). No use of the CISA logo or DHS seal, and no implied endorsement | Reachable | **Selected** |
| **CVE Program records** (CVE JSON 5), via the CVE Program's repository `CVEProject/cvelistV5` | Publication and reservation dates, the assigning organisation, CVSS metrics, weakness types, and CISA's Vulnrichment additions | [CVE Program Terms of Use](https://www.cve.org/Legal/TermsOfUse) (permissive, with attribution) | Reachable | **Selected**, joined one record per KEV entry |
| NVD API (`services.nvd.nist.gov`) | NVD's own CVSS scoring for every CVE | Public domain | Blocked (403) | Not used. CVSS comes from the CVE record and CISA's Vulnrichment instead, and coverage gaps are reported |
| FIRST EPSS scores (`epss.cyentia.com`) | Daily exploitation probability per CVE | Free to use with attribution | Blocked (403) | Not used; this would be the natural next data source |

**Why KEV + CVE.** Together they answer a practical question a vulnerability-management team faces: once a flaw is
public, how long before it is confirmed exploited, and does CVSS severity tell you which ones those will be? Both sources are
official, openly licensed and refreshable from a script.

Retrieval dates, catalog version, row counts, field definitions, limitations and refresh instructions for both
projects are in each project's `data/README.md` and `docs/data-dictionary.md`.

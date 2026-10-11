"""Static PNG figures for the README, drawn from the SQL marts.

Palette and surfaces follow the portfolio site (website/src/app/globals.css):
series-1 #2B9FD0, series-2 #E0703A, ink tokens for text. One y-axis per panel;
volume and rates go in separate panels rather than on twin axes.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

BG = "#0A0F1C"
GRID = "#1A2240"
INK_1 = "#E9EDFF"
INK_2 = "#AAB3D3"
INK_3 = "#7A84A6"
S1 = "#2B9FD0"  # on time / volume
S2 = "#E0703A"  # late
S3 = "#9085E9"
FOOTER = "Source: Olist Brazilian E-Commerce Public Dataset (CC BY-NC-SA 4.0). Delivered orders, purchases Jan 2017 - Aug 2018."


def _style() -> None:
    plt.rcParams.update({
        "figure.facecolor": BG, "axes.facecolor": BG, "savefig.facecolor": BG,
        "axes.edgecolor": GRID, "axes.labelcolor": INK_2, "axes.titlecolor": INK_1,
        "xtick.color": INK_3, "ytick.color": INK_3, "text.color": INK_1,
        "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8,
        "axes.spines.top": False, "axes.spines.right": False,
        "font.size": 10, "axes.titlesize": 12, "axes.titleweight": "bold",
        "axes.titlelocation": "left", "legend.frameon": False, "legend.labelcolor": INK_2,
    })


def _save(fig, path: Path, footer: str = FOOTER) -> Path:
    fig.text(0.01, 0.01, footer, color=INK_3, fontsize=7.5, ha="left", va="bottom")
    fig.savefig(path, dpi=110, bbox_inches="tight")
    plt.close(fig)
    return path


def review_by_delay(df: pd.DataFrame, path: Path) -> Path:
    _style()
    d = df.sort_values("sort_order")
    colors = [S2 if k.startswith("late") else S1 for k in d["delay_bucket"]]
    labels = [lab.replace(" days", "d").replace("On the estimated day", "On day") for lab in d["label"]]
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2))
    ax = axes[0]
    ax.bar(labels, d["avg_score"], color=colors, width=0.7)
    for x, v in zip(labels, d["avg_score"]):
        ax.text(x, v + 0.06, f"{v:.2f}", ha="center", color=INK_2, fontsize=8.5)
    ax.set_ylim(0, 5)
    ax.set_ylabel("Average review score (1-5)")
    ax.set_title("Average review score by delivery vs estimate")
    ax = axes[1]
    ax.bar(labels, d["pct_1star"] * 100, color=colors, width=0.7)
    for x, v in zip(labels, d["pct_1star"] * 100):
        ax.text(x, v + 1, f"{v:.0f}%", ha="center", color=INK_2, fontsize=8.5)
    ax.set_ylim(0, 80)
    ax.set_ylabel("Share of reviews that are 1-star (%)")
    ax.set_title("1-star share by delivery vs estimate")
    for ax in axes:
        ax.tick_params(axis="x", rotation=35, labelsize=8.5)
        ax.grid(axis="x", visible=False)
    fig.text(0.01, 0.95, "Blue = on time or early, orange = late (delivered on a later calendar day than estimated)",
             color=INK_2, fontsize=8.5)
    fig.tight_layout(rect=(0, 0.04, 1, 0.94))
    return _save(fig, path)


def monthly(df: pd.DataFrame, path: Path) -> Path:
    _style()
    d = df[df["in_window"]].copy()
    x = pd.to_datetime(d["month"] + "-01")
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(11, 5.6), sharex=True, gridspec_kw={"height_ratios": [2.2, 1]})
    for start, end in [("2017-11-01", "2017-12-01"), ("2018-02-01", "2018-03-01")]:
        for ax in (ax1, ax2):
            ax.axvspan(pd.Timestamp(start) - pd.Timedelta(days=15), pd.Timestamp(end) + pd.Timedelta(days=15),
                       color=S2, alpha=0.10, lw=0)
    ax1.plot(x, d["late_rate"] * 100, color=S2, lw=2, marker="o", ms=4)
    peak = d.loc[d["late_rate"].idxmax()]
    ax1.annotate(f"{peak['late_rate'] * 100:.1f}% ({peak['month']})",
                 (pd.Timestamp(peak["month"] + "-01"), peak["late_rate"] * 100),
                 xytext=(10, 0), textcoords="offset points", color=INK_1, fontsize=9, va="center")
    ax1.set_ylabel("Late orders (% of delivered)")
    ax1.set_title("Late rate by purchase month")
    ax1.set_ylim(0, max(d["late_rate"] * 100) * 1.2)
    ax2.bar(x, d["delivered_orders"], width=20, color=S1)
    ax2.set_ylabel("Delivered orders")
    ax2.set_title("Delivered orders by purchase month", fontsize=10)
    ax2.grid(axis="x", visible=False)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    return _save(fig, path)


def delivery_legs(df: pd.DataFrame, path: Path) -> Path:
    _style()
    d = df[df["in_window"]].copy()
    x = pd.to_datetime(d["month"] + "-01")
    fig, ax = plt.subplots(figsize=(11, 4.2))
    for start, end in [("2017-11-01", "2017-12-01"), ("2018-02-01", "2018-03-01")]:
        ax.axvspan(pd.Timestamp(start) - pd.Timedelta(days=15), pd.Timestamp(end) + pd.Timedelta(days=15),
                   color=S2, alpha=0.10, lw=0)
    series = [("avg_promised_days", "Promised (purchase to estimate)", INK_3, "--"),
              ("avg_carrier_transit_days", "Carrier transit (hand-off to customer)", S2, "-"),
              ("avg_seller_handling_days", "Seller handling (purchase to carrier hand-off)", S1, "-")]
    for col, label, color, ls in series:
        ax.plot(x, d[col], color=color, lw=2, ls=ls)
        ax.text(x.iloc[-1] + pd.Timedelta(days=8), d[col].iloc[-1], label, color=color, fontsize=8.5, va="center")
    ax.set_ylabel("Average days")
    ax.set_title("Average days per leg, by purchase month (delivered orders)")
    ax.set_xlim(x.iloc[0] - pd.Timedelta(days=15), x.iloc[-1] + pd.Timedelta(days=200))
    ticks = [t for t in x if t.month in (1, 4, 7, 10)]
    ax.set_xticks(ticks)
    ax.set_xticklabels([t.strftime("%Y-%m") for t in ticks])
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    return _save(fig, path)


def estimate_accuracy(df: pd.DataFrame, path: Path) -> Path:
    _style()
    d = df.copy()
    colors = [S2 if v > 0 else S1 for v in d["days_vs_estimate"]]
    fig, ax = plt.subplots(figsize=(11, 4))
    ax.bar(d["days_vs_estimate"], d["orders"], color=colors, width=0.85)
    ax.axvline(0.5, color=INK_2, lw=1, ls=":")
    ax.text(1.5, ax.get_ylim()[1] * 0.9, "late", color=S2, fontsize=9)
    ax.text(-1.5, ax.get_ylim()[1] * 0.9, "on time or early", color=S1, fontsize=9, ha="right")
    ax.set_xlabel("Delivered date minus estimated date (days; ends clamped at -40 and +30)")
    ax.set_ylabel("Delivered orders")
    ax.set_title("How far from the estimate orders arrived")
    ax.grid(axis="x", visible=False)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    return _save(fig, path, FOOTER.replace("purchases Jan 2017 - Aug 2018", "all purchase months"))


def routes(df: pd.DataFrame, path: Path, overall_rate: float, top: int = 10) -> Path:
    _style()
    d = df.sort_values("late_orders", ascending=False).head(top).iloc[::-1]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.8), sharey=True)
    y = range(len(d))
    h = 0.38
    ax1.barh([i + h / 2 for i in y], d["share_of_delivered"] * 100, height=h, color=S1, label="Share of delivered orders")
    ax1.barh([i - h / 2 for i in y], d["share_of_late"] * 100, height=h, color=S2, label="Share of late orders")
    ax1.set_yticks(list(y))
    ax1.set_yticklabels(d["route"])
    ax1.set_xlabel("% of all delivered orders / of all late orders")
    ax1.set_title(f"Top {top} routes by late orders")
    ax1.legend(loc="lower right", fontsize=8.5)
    ax1.grid(axis="y", visible=False)
    ax2.errorbar(d["late_rate"] * 100, list(y),
                 xerr=[(d["late_rate"] - d["late_rate_low"]) * 100, (d["late_rate_high"] - d["late_rate"]) * 100],
                 fmt="o", color=S2, ecolor=INK_3, elinewidth=1.5, capsize=3, ms=6)
    ax2.axvline(overall_rate * 100, color=INK_3, lw=1, ls="--")
    ax2.text(overall_rate * 100, len(d) - 0.4, f" all routes {overall_rate * 100:.1f}%", color=INK_3, fontsize=8)
    ax2.set_xlabel("Late rate (%), 95% Wilson interval")
    ax2.set_title("Late rate on each route")
    ax2.grid(axis="y", visible=False)
    for i, (_, r) in zip(y, d.iterrows()):
        ax2.text(r["late_rate_high"] * 100 + 0.6, i, f"{int(r['late_orders']):,} late / {int(r['delivered_orders']):,}",
                 va="center", color=INK_2, fontsize=8)
    ax2.set_xlim(0, max(d["late_rate_high"] * 100) + 9)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    return _save(fig, path, FOOTER.replace("purchases Jan 2017 - Aug 2018", "all purchase months") +
                 " Route = primary seller state to customer state.")


def write_all(marts: dict[str, pd.DataFrame], out_dir: Path, overall_late_rate: float) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = [
        review_by_delay(marts["review_by_delay"], out_dir / "review_by_delay.png"),
        monthly(marts["monthly_delivery"], out_dir / "monthly_late_rate.png"),
        delivery_legs(marts["monthly_delivery"], out_dir / "delivery_legs.png"),
        estimate_accuracy(marts["estimate_accuracy"], out_dir / "estimate_accuracy.png"),
    ]
    paths.append(routes(marts["route_performance"], out_dir / "routes.png", overall_late_rate))
    return paths

"""Draw the Mount Rainier contour lines used behind the site's hero and case-study header.

Elevation comes from the open Terrain Tiles on AWS (Terrarium format, zoom 12), which for this
area are USGS 3DEP elevation data. Download the 5 x 5 block of tiles around the summit first:

    for x in 660 661 662 663 664; do for y in 1441 1442 1443 1444 1445; do
      curl -sSf -o "tiles/t_${x}_${y}.png" \
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/${x}/${y}.png"
    done; done

then run:

    python scripts/rainier_contours.py --tiles tiles --out website/public/images/rainier-contours.svg

The output is a mask: black lines on a transparent background. The site colors it with CSS.
Requires numpy, Pillow and matplotlib.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

X_TILES = range(660, 665)
Y_TILES = range(1441, 1446)
TILE = 256
INTERVAL_M = 100  # one line every 100 m of elevation
INDEX_EVERY = 5  # every fifth line (500 m) is drawn heavier, as on a printed topo map


def load(tiles: Path) -> np.ndarray:
    """Stitch the tiles and decode Terrarium RGB into meters."""
    rows = []
    for y in Y_TILES:
        row = []
        for x in X_TILES:
            rgb = np.asarray(Image.open(tiles / f"t_{x}_{y}.png").convert("RGB"), dtype=np.float64)
            row.append(rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768)
        rows.append(np.hstack(row))
    return np.vstack(rows)


def smooth(z: np.ndarray, sigma: float) -> np.ndarray:
    """Separable Gaussian blur, so the lines read as smooth curves at ~26 m per pixel."""
    r = int(3 * sigma)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    pad = np.pad(z, r, mode="edge")
    z = np.apply_along_axis(lambda v: np.convolve(v, k, mode="valid"), 1, pad)
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode="valid"), 0, z)


def simplify(pts: np.ndarray, tol: float) -> np.ndarray:
    """Ramer-Douglas-Peucker line simplification."""
    if len(pts) < 3:
        return pts
    keep = np.zeros(len(pts), dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        seg = pts[b] - pts[a]
        norm = np.hypot(*seg)
        d = pts[a + 1 : b] - pts[a]
        dist = np.abs(seg[0] * d[:, 1] - seg[1] * d[:, 0]) / norm if norm else np.hypot(d[:, 0], d[:, 1])
        i = int(np.argmax(dist))
        if dist[i] > tol:
            m = a + 1 + i
            keep[m] = True
            stack += [(a, m), (m, b)]
    return pts[keep]


def path_d(pts: np.ndarray) -> str:
    """Compact SVG path: absolute first point, then relative steps rounded to a pixel."""
    p = np.round(pts).astype(int)
    out = [f"M{p[0][0]} {p[0][1]}"]
    for (x0, y0), (x1, y1) in zip(p[:-1], p[1:]):
        if (x1, y1) != (x0, y0):
            out.append(f"l{x1 - x0} {y1 - y0}")
    return "".join(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tiles", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    z = smooth(load(args.tiles), sigma=2.2)
    # A 16:10 window around the summit, which sits near tile (662.63, 1443.37).
    cy = int((1443.37 - Y_TILES.start) * TILE)
    h, w = 800, 1280
    top = max(0, min(z.shape[0] - h, cy - h // 2))
    z = z[top : top + h, :w]

    levels = np.arange(np.ceil(z.min() / INTERVAL_M) * INTERVAL_M, z.max(), INTERVAL_M)
    cs = plt.contour(z, levels=levels)
    thin, heavy = [], []
    for level, segs in zip(cs.levels, cs.allsegs):
        for seg in segs:
            if len(seg) < 8:
                continue
            length = np.hypot(*np.diff(seg, axis=0).T).sum()
            if length < 40:
                continue
            d = path_d(simplify(seg, tol=0.9))
            (heavy if round(level / INTERVAL_M) % INDEX_EVERY == 0 else thin).append(d)

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="none" stroke="#000" '
        'stroke-linecap="round" stroke-linejoin="round">'
        f'<path stroke-opacity=".55" stroke-width="1" d="{"".join(thin)}"/>'
        f'<path stroke-width="1.6" d="{"".join(heavy)}"/>'
        "</svg>\n"
    )
    args.out.write_text(svg)
    print(f"{len(thin) + len(heavy)} lines, {len(levels)} levels from {levels[0]:.0f} m to {levels[-1]:.0f} m, {len(svg) / 1024:.0f} KB")


if __name__ == "__main__":
    main()

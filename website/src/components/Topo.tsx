const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The SVG is drawn 1:1 on 1280 x 800 elevation-tile pixels, each about 26.14 m across at Mount Rainier (zoom 12). */
const MAP = { width: 1280, height: 800, metersPerPixel: 26.14 };

/**
 * Contour lines of Mount Rainier (drawn by scripts/rainier_contours.py from USGS elevation data)
 * as a faint, still background, with a small map legend in the top corner. Decorative only:
 * hidden from assistive technology (the footer says what the lines are) and never in the way of clicks.
 */
export function Topo({ className = "", captionTop = "1rem" }: { className?: string; captionTop?: string }) {
  return (
    <div
      aria-hidden
      className={`topo pointer-events-none absolute inset-0 ${className}`}
      style={{
        ["--topo" as string]: `url("${base}/images/rainier-contours.svg")`,
        ["--map-w" as string]: MAP.width,
        ["--map-h" as string]: MAP.height,
        ["--km" as string]: 1000 / MAP.metersPerPixel,
      }}
    >
      <span className="topo-lines" />
      <div
        className="topo-caption absolute inset-x-0 mx-auto flex max-w-6xl flex-col items-end gap-1 px-4 font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-ink-3 sm:px-6 md:pr-9"
        style={{ top: captionTop }}
      >
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 10 9" className="h-[0.5625rem] w-2.5">
            <path d="M5 1 9 8H1Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          Mount Rainier, WA
        </span>
        <span>Contour lines every 100 m</span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="topo-scale" />1 km
        </span>
      </div>
    </div>
  );
}

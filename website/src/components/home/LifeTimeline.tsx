import { firstDay, lastDay } from "@/data/apple-health";
import { lifeEvents, monthlySteps, stairs, monthName } from "@/content/timeline";
import { toolsIn, xf } from "@/content/tools";
import { Mentions } from "@/components/tools/ToolBits";

/*
 * Billal's story on the step chart: average daily steps per month, rendered on the server,
 * with numbered markers for the moments listed underneath. The list carries all the content;
 * the markers only point at it.
 */

const W = 1000;
const H = 100;
const n = monthlySteps.length;
const top = Math.ceil((Math.max(...monthlySteps.map((m) => m.steps ?? 0)) * 1.08) / 1000) * 1000;
const xAt = (i: number) => (i / (n - 1)) * W;
const yAt = (v: number) => H - (v / top) * H;
const indexOfMonth = (ym: string) => Math.max(0, monthlySteps.findIndex((m) => m.month === ym));

function linePath() {
  let d = "";
  let pen = false;
  monthlySteps.forEach((m, i) => {
    if (m.steps === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(m.steps).toFixed(1)}`;
    pen = true;
  });
  return d;
}

const years = Array.from(new Set(monthlySteps.map((m) => m.month.slice(0, 4)))).filter((y) => indexOfMonth(`${y}-01`) > 0);
const ticks = Array.from({ length: Math.floor(top / 5000) + 1 }, (_, i) => i * 5000);

export function LifeTimeline() {
  const line = linePath();
  const area = `${line}L${W},${H}L0,${H}Z`;
  return (
    <div className="life mt-20 sm:mt-24">
      <style>
        {lifeEvents
          .map((_, i) => `.life:has([data-ev="${i + 1}"]:is(:hover,:focus-visible)) [data-ev="${i + 1}"]{--ev-on:1}`)
          .join("")}
      </style>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3">
            Average daily steps per month · {monthName(firstDay)} to {monthName(lastDay)}
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">I marked the story above on a chart of my own steps.</h3>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-ink-2">
          The line is my Apple Health data. The numbered points are moments from the story above.
        </p>
      </div>

      <figure className="mt-8 rounded-[var(--radius-lg)] border border-line bg-surface-1 p-4 pt-6 sm:p-6 sm:pt-8">
        <div className="relative h-56 sm:h-64">
          {/* y axis */}
          <div aria-hidden className="absolute bottom-6 left-0 top-16 w-9">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute right-2 -translate-y-1/2 font-mono text-[0.625rem] text-ink-3"
                style={{ top: `${100 - (t / top) * 100}%` }}
              >
                {t === 0 ? "0" : `${t / 1000}k`}
              </span>
            ))}
          </div>

          {/* plot */}
          <div className="absolute bottom-6 left-9 right-1 top-16">
            {ticks.map((t) => (
              <span key={t} aria-hidden className="absolute inset-x-0 h-px bg-[var(--grid)]" style={{ top: `${100 - (t / top) * 100}%` }} />
            ))}
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <linearGradient id="life-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#life-fill)" />
              <path d={line} fill="none" stroke="var(--series-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>

            {lifeEvents.map((e, i) => {
              const at = indexOfMonth(e.month);
              const v = monthlySteps[at].steps ?? 0;
              const x = (xAt(at) / W) * 100;
              const y = (yAt(v) / H) * 100;
              const row = i % 2 === 0 ? "3.5rem" : "2rem";
              return (
                <a
                  key={e.text}
                  href={`#life-${i + 1}`}
                  data-ev={i + 1}
                  aria-label={`${i + 1}: ${e.when}`}
                  className="life-marker absolute"
                  style={{ left: `${x}%`, top: 0, height: `${y}%`, ["--row" as string]: row }}
                >
                  <span aria-hidden className="life-stem" />
                  <span aria-hidden className="life-dot" />
                  <span aria-hidden className="life-badge">{i + 1}</span>
                </a>
              );
            })}
          </div>

          {/* x axis */}
          <div aria-hidden className="absolute bottom-0 left-9 right-1 h-5">
            {years.map((y, i) => (
              <span
                key={y}
                className={`absolute -translate-x-1/2 font-mono text-[0.625rem] text-ink-3 ${i % 2 ? "hidden sm:block" : ""}`}
                style={{ left: `${(xAt(indexOfMonth(`${y}-01`)) / W) * 100}%` }}
              >
                {y}
              </span>
            ))}
          </div>
        </div>
        <figcaption className="sr-only">
          Line chart of my average daily steps per month from {monthName(firstDay, "long")} to {monthName(lastDay, "long")}, with the moments
          listed below marked on it.
        </figcaption>
      </figure>

      <ol className="mt-6 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-5">
        {lifeEvents.map((e, i) => (
          <li
            key={e.text}
            id={`life-${i + 1}`}
            data-ev={i + 1}
            data-xf={xf(toolsIn(e.text))}
            className="life-item flex scroll-mt-28 gap-3 rounded-[var(--radius-sm)] px-2 py-2.5"
          >
            <span aria-hidden data-pin className="life-num">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-3">{e.when}</span>
              <span className="mt-1 block text-sm leading-snug text-ink-2">
                <Mentions text={e.text} />
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-8 max-w-3xl border-l-2 border-[var(--ring-exercise)]/60 pl-4 text-sm leading-relaxed text-ink-2 sm:text-base">
        Since {stairs.since} my phone and watch have counted {stairs.flights.toLocaleString("en-US")} flights of stairs. At about ten feet a
        flight, that&apos;s roughly {stairs.rainiers} times the height of Mount Rainier ({stairs.rainierFt.toLocaleString("en-US")} feet), the
        mountain behind me in the photo above.
      </p>
    </div>
  );
}

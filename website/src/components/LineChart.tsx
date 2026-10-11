"use client";

import { useState } from "react";

type Point = { month: string; value: number };

type Props = {
  title: string;
  subtitle: string;
  unit: string;
  data: Point[];
  digits?: number;
};

const W = 640;
const H = 240;
const PAD = { top: 12, right: 12, bottom: 28, left: 52 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  const step = 10 ** Math.floor(Math.log10(span / count));
  const nice = [1, 2, 2.5, 5, 10].map((s) => s * step).find((s) => span / s <= count) ?? step * 10;
  const lo = Math.floor(min / nice) * nice;
  const hi = Math.ceil(max / nice) * nice;
  const ticks = [];
  for (let t = lo; t <= hi + nice / 2; t += nice) ticks.push(Number(t.toFixed(6)));
  return ticks;
}

export default function LineChart({ title, subtitle, unit, data, digits = 0 }: Props) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const slot = innerW / Math.max(data.length - 1, 1);
  const shown = active ?? data.length - 1;

  return (
    <figure className="chart-card chart" style={{ margin: "0 0 20px" }}>
      <h3>{title}</h3>
      <p className="sub">{subtitle}</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: line chart by month`} onMouseLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="axis-label" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
              {fmt(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % 2 === 0 || data.length <= 6 ? (
            <text key={d.month} className="axis-label" x={x(i)} y={H - 8} textAnchor="middle">
              {MONTHS[Number(d.month.split("-")[1]) - 1]}
            </text>
          ) : null,
        )}
        <path className="series" d={path} strokeLinejoin="round" strokeLinecap="round" />
        {active !== null && (
          <line className="gridline" x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} strokeDasharray="3 3" />
        )}
        {data.map((d, i) => (
          <g key={d.month}>
            <rect
              className="hit"
              x={x(i) - slot / 2}
              y={PAD.top}
              width={slot}
              height={innerH}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              tabIndex={0}
              aria-label={`${monthLabel(d.month)}: ${fmt(d.value)} ${unit}`}
            />
            <circle className={`dot${i === shown ? " active" : ""}`} cx={x(i)} cy={y(d.value)} r={i === shown ? 6 : 4} pointerEvents="none" />
          </g>
        ))}
      </svg>
      <figcaption className="chart-tip" aria-live="polite">
        {monthLabel(data[shown].month)}: <strong>{fmt(data[shown].value)}</strong> {unit}
      </figcaption>
      <details className="table-view">
        <summary>View as table</summary>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>{unit}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month}>
                <td>{monthLabel(d.month)}</td>
                <td>{fmt(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

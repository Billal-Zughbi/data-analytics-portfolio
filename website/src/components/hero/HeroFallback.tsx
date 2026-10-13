import { daySlots, LAYOUT, project, stepRgb, VIEW } from "./dayLayout";

/**
 * Static SVG version of the hero scene, drawn on the server from the same day layout as the
 * WebGL scene. Shown before WebGL loads and kept for devices without WebGL. To stay light,
 * each week is one short line coloured by that week's average steps.
 */

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const hex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const fmt = (v: number) => v.toFixed(1);

export function HeroFallback({ start, steps, className = "" }: { start: string; steps: (number | null)[]; className?: string }) {
  const slots = daySlots(start, steps.length);

  // Average steps per week cell.
  const weeks = new Map<string, { col: number; row: number; sum: number; n: number }>();
  slots.forEach((s, i) => {
    const key = `${s.col}:${s.row}`;
    const w = weeks.get(key) ?? { col: s.col, row: s.row, sum: 0, n: 0 };
    const v = steps[i];
    if (v !== null) {
      w.sum += v;
      w.n += 1;
    }
    weeks.set(key, w);
  });

  // One path per colour bin keeps the markup small.
  const bins = new Map<string, string[]>();
  for (const w of weeks.values()) {
    const mean = w.n ? Math.round(w.sum / w.n / 1500) * 1500 : null;
    const color = hex(stepRgb(mean));
    const x0 = LAYOUT.colX0 + w.col * LAYOUT.colDx - 3 * LAYOUT.dayDx;
    const x1 = LAYOUT.colX0 + w.col * LAYOUT.colDx + 3 * LAYOUT.dayDx;
    const y = LAYOUT.baseY + w.row * LAYOUT.rowDy;
    const [ax, ay] = project([x0, y, 0]);
    const [bx, by] = project([x1, y, 0]);
    (bins.get(color) ?? bins.set(color, []).get(color)!).push(`M${fmt(ax)} ${fmt(ay)}L${fmt(bx)} ${fmt(by)}`);
  }

  const gate = Array.from({ length: 49 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return project([0, Math.sin(a) * 1.35, Math.cos(a) * 1.35]);
  });

  const cloud = Array.from({ length: 150 }, (_, i) => {
    const t = i / 150;
    const x = -6.2 + t * 6;
    const funnel = 1 - Math.max(0, (t - 0.55) / 0.45) * 0.9;
    const [px, py] = project([x, (rand(i + 500) - 0.5) * 3 * funnel, (rand(i + 700) - 0.5) * 2.4 * funnel]);
    return { x: px, y: py, r: 1.1 + rand(i + 900) * 1.2, o: 0.25 + rand(i + 1200) * 0.45 };
  });

  const lastCol = slots[slots.length - 1].col;
  const [b0x, b0y] = project([LAYOUT.colX0 - 0.3, LAYOUT.baseY - 0.12, 0]);
  const [b1x, b1y] = project([LAYOUT.colX0 + (lastCol + 1) * LAYOUT.colDx, LAYOUT.baseY - 0.12, 0]);

  const years = [0, lastCol].map((col) => {
    const [x, y] = project([LAYOUT.colX0 + col * LAYOUT.colDx, LAYOUT.baseY - 0.25, 0]);
    return { text: String(slots[0].year + col), x, y };
  });

  return (
    <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className={className} aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="hero-fade" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#4fd8ff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#4fd8ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={VIEW.width / 2 - 30} cy={VIEW.height / 2} rx="320" ry="180" fill="url(#hero-fade)" />
      {cloud.map((p, i) => (
        <circle key={i} cx={fmt(p.x)} cy={fmt(p.y)} r={fmt(p.r)} fill="#7a84a6" opacity={p.o.toFixed(2)} />
      ))}
      <path d={`M${gate.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}Z`} fill="none" stroke="#9d8cff" strokeOpacity="0.45" />
      <g strokeWidth="2.6" strokeOpacity="0.85">
        {[...bins.entries()].map(([color, segs]) => (
          <path key={color} d={segs.join("")} stroke={color} />
        ))}
      </g>
      <line x1={fmt(b0x)} y1={fmt(b0y)} x2={fmt(b1x)} y2={fmt(b1y)} stroke="#4fd8ff" strokeOpacity="0.25" />
      {years.map((l) => (
        <text
          key={l.text}
          x={fmt(l.x)}
          y={fmt(l.y)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fill="#7a84a6"
          className="font-mono"
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
}

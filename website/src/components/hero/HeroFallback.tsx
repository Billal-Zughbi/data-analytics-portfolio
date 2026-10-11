/**
 * Static SVG version of the hero scene. Rendered on the server, shown before
 * WebGL loads, and kept for devices without WebGL.
 */

const HEIGHTS = [0.32, 0.46, 0.4, 0.58, 0.52, 0.68, 0.62, 0.77, 0.7, 0.86, 0.8, 0.93, 0.88, 1.0];

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function HeroFallback({ className = "" }: { className?: string }) {
  const cloud = Array.from({ length: 150 }, (_, i) => {
    const t = i / 150;
    const x = 20 + t * 270 + (rand(i) - 0.5) * 40;
    const spread = 150 * (1 - Math.max(0, (t - 0.55) / 0.45) * 0.9);
    const y = 220 + (rand(i + 500) - 0.5) * spread * 1.6;
    return { x, y, r: 1.1 + rand(i + 900) * 1.2, o: 0.25 + rand(i + 1200) * 0.45 };
  });

  const bars = HEIGHTS.flatMap((h, c) => {
    const rows = Math.round(h * 26);
    return Array.from({ length: rows }, (_, r) => [
      { x: 390 + c * 22 - 4, y: 360 - r * 9 },
      { x: 390 + c * 22 + 4, y: 360 - r * 9 },
    ]).flat();
  });

  return (
    <svg viewBox="0 0 720 440" className={className} aria-hidden preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="hero-fade" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#4fd8ff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#4fd8ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="330" cy="220" rx="320" ry="180" fill="url(#hero-fade)" />
      {cloud.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#7a84a6" opacity={p.o} />
      ))}
      <ellipse cx="330" cy="220" rx="18" ry="92" fill="none" stroke="#9d8cff" strokeOpacity="0.45" />
      {bars.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.6} fill="#4fd8ff" opacity={0.55} />
      ))}
      <line x1="378" x2="700" y1="372" y2="372" stroke="#4fd8ff" strokeOpacity="0.25" />
    </svg>
  );
}

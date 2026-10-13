/**
 * Where each day sits in the hero, shared by the WebGL scene and its static SVG fallback.
 *
 * One column per calendar year, one row per week (January at the bottom), one dot per weekday.
 * Every day in the export gets a dot, coloured by that day's steps; days with no step data stay dim.
 */

export const LAYOUT = {
  colX0: 0.6,
  colDx: 0.26,
  dayDx: 0.027,
  baseY: -1.55,
  rowDy: 0.06,
  /** Scene camera and group transform (see DataFlowScene). */
  camera: { z: 9, fov: 42 },
  group: { rotation: [0.08, -0.16, 0] as const, position: [-1.2, 0.1, 0] as const },
};

/** The first and last year columns get a label under the baseline, about 10 px tall on screen. */
export const YEAR_LABEL_PX = 10;

/** Scene units visible from the bottom to the top of the canvas at the grid's depth. */
export const VISIBLE_H = 2 * LAYOUT.camera.z * Math.tan(((LAYOUT.camera.fov / 2) * Math.PI) / 180);

/**
 * The static fallback's viewBox. It is wider than any real figure and drawn with
 * preserveAspectRatio "slice", so like the WebGL camera it keeps the height and crops the sides.
 */
export const VIEW = { width: 1000, height: 440 };

/** Sequential ramp for steps, dim navy to near white, tuned for additive points on the dark hero. */
const STOPS: [number, [number, number, number]][] = [
  [0, [0x1b, 0x2a, 0x4e]],
  [3000, [0x1f, 0x4f, 0x8a]],
  [6000, [0x2b, 0x8f, 0xd0]],
  [9000, [0x4f, 0xd8, 0xff]],
  [12000, [0xb8, 0xf0, 0xff]],
  [16000, [0xff, 0xff, 0xff]],
];
const EMPTY: [number, number, number] = [0x2a, 0x30, 0x44];

/** RGB (0–255) for a day's steps. */
export function stepRgb(steps: number | null): [number, number, number] {
  if (steps === null) return EMPTY;
  if (steps <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [v1, c1] = STOPS[i];
    if (steps <= v1) {
      const [v0, c0] = STOPS[i - 1];
      const t = (steps - v0) / (v1 - v0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * t)) as [number, number, number];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

export type DaySlot = { iso: string; year: number; col: number; row: number; weekday: number; x: number; y: number; z: number };

const DAY_MS = 86_400_000;

/** Grid position of every day from `start`, `count` days long. */
export function daySlots(start: string, count: number): DaySlot[] {
  const t0 = Date.parse(`${start}T00:00:00Z`);
  const firstYear = new Date(t0).getUTCFullYear();
  const out: DaySlot[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(t0 + i * DAY_MS);
    const year = d.getUTCFullYear();
    const jan1 = Date.UTC(year, 0, 1);
    const jan1Weekday = (new Date(jan1).getUTCDay() + 6) % 7; // Monday = 0
    const doy = Math.round((d.getTime() - jan1) / DAY_MS);
    const weekday = (d.getUTCDay() + 6) % 7;
    const row = Math.floor((doy + jan1Weekday) / 7);
    const col = year - firstYear;
    out.push({
      iso: d.toISOString().slice(0, 10),
      year,
      col,
      row,
      weekday,
      x: LAYOUT.colX0 + col * LAYOUT.colDx + (weekday - 3) * LAYOUT.dayDx,
      y: LAYOUT.baseY + row * LAYOUT.rowDy,
      z: 0,
    });
  }
  return out;
}

/** Projects a scene point to the fallback SVG's viewBox, matching the WebGL camera. */
export function project([x, y, z]: [number, number, number], width = VIEW.width, height = VIEW.height): [number, number] {
  const [rx, ry] = LAYOUT.group.rotation;
  // Euler XYZ: rotate about Y, then X.
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const y2 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  const [px, py, pz] = LAYOUT.group.position;
  const vx = x1 + px;
  const vy = y2 + py;
  const vz = z2 + pz - LAYOUT.camera.z;
  const f = 1 / Math.tan(((LAYOUT.camera.fov / 2) * Math.PI) / 180);
  const aspect = width / height;
  const ndcX = (vx / -vz) * (f / aspect);
  const ndcY = (vy / -vz) * f;
  return [((ndcX + 1) / 2) * width, ((1 - ndcY) / 2) * height];
}

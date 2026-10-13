"use client";

/**
 * Hero centrepiece: raw records become a daily model.
 *
 * Unordered points drift in from the left, pass through a transform ring and settle onto a grid
 * where every dot is one real day of Billal's Apple Health data: one column per year, one row per
 * week (January at the bottom), coloured by that day's steps. Today's date glows in every year.
 * Pointing at a dot shows its date and step count. Motion is computed in the shaders from a time
 * uniform, so React never re-renders per frame.
 */

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { daySlots, LAYOUT, stepRgb, VISIBLE_H, YEAR_LABEL_PX } from "./dayLayout";

type Days = { positions: Float32Array; colors: Float32Array; index: Float32Array; today: Float32Array; count: number; iso: string[] };

function buildDays(start: string, steps: (number | null)[]): Days {
  const slots = daySlots(start, steps.length);
  const n = slots.length;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const index = new Float32Array(n);
  const today = new Float32Array(n);
  const now = new Date();
  const md = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  slots.forEach((s, i) => {
    positions.set([s.x, s.y, s.z], i * 3);
    const [r, g, b] = stepRgb(steps[i]);
    colors.set([r / 255, g / 255, b / 255], i * 3);
    index[i] = i;
    today[i] = s.iso.slice(5) === md ? 1 : 0;
  });
  return { positions, colors, index, today, count: n, iso: slots.map((s) => s.iso) };
}

const flowVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uScale;
  attribute float aSeed;
  attribute vec3 aTarget;
  attribute vec3 aColor;
  varying float vAlpha;
  varying float vSettled;
  varying vec3 vColor;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    float speed = 0.045 + 0.02 * hash(aSeed * 7.1);
    float p = fract(uTime * speed + aSeed);

    // Stage A: drift through the cloud toward the gate at x = 0.
    float a = clamp(p / 0.56, 0.0, 1.0);
    float x = mix(-6.4, -0.05, a);
    float funnel = mix(1.0, 0.08, smoothstep(0.35, 1.0, a));
    float t = uTime * 0.35 + aSeed * 40.0;
    float y = (sin(t + x * 0.8) * 0.9 + sin(t * 1.7 + aSeed * 13.0) * 0.6 + (hash(aSeed) - 0.5) * 1.6) * funnel;
    float z = (cos(t * 0.9 + x * 0.6) * 0.9 + (hash(aSeed * 3.3) - 0.5) * 1.4) * funnel;
    vec3 cloud = vec3(x, y, z);

    // Stage B: leave the gate and settle onto its day.
    float b = smoothstep(0.56, 0.74, p);
    vec3 arc = mix(vec3(0.0), aTarget, b) + vec3(0.0, sin(b * 3.14159) * 0.6, 0.0);
    vec3 pos = mix(cloud, arc, step(0.56, p));

    // Stage C: rest, then fade so the particle can re-enter on the left.
    vAlpha = smoothstep(0.0, 0.05, p) * (1.0 - smoothstep(0.86, 1.0, p));
    vSettled = b;
    vColor = aColor;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = mix(2.4, 3.0, b) * uScale * uPixelRatio * (9.0 / -mv.z);
  }
`;

const flowFragment = /* glsl */ `
  uniform vec3 uRaw;
  uniform vec3 uSettled;
  varying float vAlpha;
  varying float vSettled;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.1, d);
    vec3 col = mix(uRaw, mix(vColor, uSettled, 0.35), vSettled);
    gl_FragColor = vec4(col, soft * vAlpha * mix(0.7, 1.0, vSettled));
  }
`;

const dayVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uScale;
  uniform float uHover;
  attribute vec3 aColor;
  attribute float aIndex;
  attribute float aToday;
  varying vec3 vColor;
  varying float vGlow;
  varying float vToday;
  varying float vHover;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // A slow scan sweeps up through the year, January to December.
    float h = (position.y + 1.55) / 3.1;
    vGlow = smoothstep(0.07, 0.0, abs(h - fract(uTime * 0.07)));
    vToday = aToday * (0.65 + 0.35 * sin(uTime * 2.2));
    vHover = 1.0 - step(0.5, abs(aIndex - uHover));
    vColor = aColor;
    float size = 2.15 + vGlow * 0.9 + aToday * 2.4 + vHover * 4.5;
    gl_PointSize = size * uScale * uPixelRatio * (9.0 / -mv.z);
  }
`;

const dayFragment = /* glsl */ `
  uniform vec3 uGlow;
  uniform vec3 uToday;
  varying vec3 vColor;
  varying float vGlow;
  varying float vToday;
  varying float vHover;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.28, d);
    vec3 col = mix(vColor, uGlow, vGlow * 0.45);
    col = mix(col, uToday, step(0.01, vToday) * 0.9);
    col = mix(col, vec3(1.0), vHover);
    float alpha = (0.8 + vGlow * 0.2) * mix(1.0, 0.75 + vToday * 0.5, step(0.01, vToday));
    gl_FragColor = vec4(col, max(alpha, vHover) * soft);
  }
`;

type Tip = (info: { x: number; y: number; i: number } | null) => void;

type YearLabel = { text: string; x: number; tex: THREE.CanvasTexture; aspect: number };

/** "2014" and "2026" under the first and last columns, drawn to textures so they turn with the grid. */
function YearLabels({ years, fit }: { years: { text: string; x: number }[]; fit: number }) {
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);
  const [labels, setLabels] = useState<YearLabel[]>([]);

  useEffect(() => {
    let live = true;
    let made: YearLabel[] = [];
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || "monospace";
    const font = `500 40px ${family}`;
    document.fonts
      .load(font)
      .catch(() => [])
      .then(() => {
        if (!live) return;
        made = years.map(({ text, x }) => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d")!;
          ctx.font = font;
          canvas.width = Math.ceil(ctx.measureText(text).width) + 8;
          canvas.height = 56;
          ctx.font = font; // resizing the canvas resets its state
          ctx.fillStyle = "#7a84a6"; // --ink-3
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, canvas.width / 2, 29);
          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          return { text, x, tex, aspect: canvas.width / canvas.height };
        });
        setLabels(made);
        invalidate();
      });
    return () => {
      live = false;
      made.forEach((l) => l.tex.dispose());
    };
  }, [years, invalidate]);

  // Plane height in scene units for a 10 px font (the text fills 40 of the texture's 56 px).
  const h = (YEAR_LABEL_PX * 1.4 * VISIBLE_H) / (height * fit);
  return labels.map((l) => (
    <mesh key={l.text} position={[l.x, LAYOUT.baseY - 0.12 - h * 0.55, 0]} raycast={() => null}>
      <planeGeometry args={[h * l.aspect, h]} />
      <meshBasicMaterial map={l.tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  ));
}

const Scene = memo(function Scene({
  days,
  count,
  animate,
  pointer,
  onTip,
}: {
  days: Days;
  count: number;
  animate: boolean;
  pointer: React.RefObject<{ x: number; y: number }>;
  onTip: Tip;
}) {
  const group = useRef<THREE.Group>(null);
  const { gl, invalidate } = useThree();
  const height = useThree((s) => s.size.height);
  // On narrow figures, shrink the whole scene so all thirteen years stay in frame.
  const fit = useThree((s) => Math.min(1, s.size.width / s.size.height / 1.1));
  const flowMat = useRef<THREE.ShaderMaterial>(null);
  const dayMat = useRef<THREE.ShaderMaterial>(null);
  const daysObj = useRef<THREE.Points>(null);

  const flow = useMemo(() => {
    const seeds = new Float32Array(count);
    const targets = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      seeds[i] = (i * 0.6180339887) % 1;
      const j = (i * 7919) % days.count;
      targets.set(days.positions.subarray(j * 3, j * 3 + 3), i * 3);
      colors.set(days.colors.subarray(j * 3, j * 3 + 3), i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute("aTarget", new THREE.BufferAttribute(targets, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 12);
    return geo;
  }, [count, days]);

  const dayGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(days.positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(days.colors, 3));
    geo.setAttribute("aIndex", new THREE.BufferAttribute(days.index, 1));
    geo.setAttribute("aToday", new THREE.BufferAttribute(days.today, 1));
    return geo;
  }, [days]);

  const uniforms = useMemo(
    () => ({
      flow: {
        uTime: { value: 7.5 },
        uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
        uScale: { value: 1 },
        uRaw: { value: new THREE.Color("#93a0c8") },
        uSettled: { value: new THREE.Color("#4fd8ff") },
      },
      days: {
        uTime: { value: 7.5 },
        uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
        uScale: { value: 1 },
        uHover: { value: -1 },
        uGlow: { value: new THREE.Color("#9d8cff") },
        uToday: { value: new THREE.Color("#f2b84b") },
      },
    }),
    [gl],
  );

  // Dots keep the same size relative to the figure on small screens.
  useEffect(() => {
    const s = Math.min(1.15, Math.max(0.6, height / 500));
    for (const m of [flowMat.current, dayMat.current]) if (m) m.uniforms.uScale.value = s;
    invalidate();
  }, [height, invalidate]);

  const years = useMemo(() => {
    const first = Number(days.iso[0].slice(0, 4));
    const last = Number(days.iso[days.count - 1].slice(0, 4));
    return [first, last].map((y) => ({ text: String(y), x: LAYOUT.colX0 + (y - first) * LAYOUT.colDx }));
  }, [days]);

  const gate = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(0, Math.sin(a) * 1.35, Math.cos(a) * 1.35));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  const baseline = useMemo(() => {
    const columns = years[1].x - years[0].x + LAYOUT.colDx;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(LAYOUT.colX0 - 0.3, LAYOUT.baseY - 0.12, 0),
      new THREE.Vector3(LAYOUT.colX0 + columns, LAYOUT.baseY - 0.12, 0),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: "#4fd8ff", transparent: true, opacity: 0.25 });
    return new THREE.Line(geo, mat);
  }, [years]);

  useEffect(
    () => () => {
      flow.dispose();
      dayGeo.dispose();
      gate.dispose();
      baseline.geometry.dispose();
      (baseline.material as THREE.Material).dispose();
    },
    [flow, dayGeo, gate, baseline],
  );

  useFrame((_, delta) => {
    if (!animate) return;
    if (flowMat.current) flowMat.current.uniforms.uTime.value += delta;
    if (dayMat.current) dayMat.current.uniforms.uTime.value += delta;
    const g = group.current;
    if (g && pointer.current) {
      const targetY = LAYOUT.group.rotation[1] + pointer.current.x * 0.16;
      const targetX = LAYOUT.group.rotation[0] + pointer.current.y * 0.07;
      g.rotation.y += (targetY - g.rotation.y) * Math.min(1, delta * 2.5);
      g.rotation.x += (targetX - g.rotation.x) * Math.min(1, delta * 2.5);
    }
  });

  // The day under the pointer: the intersected dot closest to the ray.
  const pick = (e: ThreeEvent<PointerEvent>) => {
    let best: THREE.Intersection | null = null;
    for (const hit of e.intersections) {
      if (hit.object !== daysObj.current || hit.index === undefined) continue;
      if (!best || (hit.distanceToRay ?? 0) < (best.distanceToRay ?? 0)) best = hit;
    }
    const i = best?.index ?? -1;
    if (dayMat.current) dayMat.current.uniforms.uHover.value = i;
    invalidate();
    onTip(i >= 0 ? { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, i } : null);
  };
  const leave = () => {
    if (dayMat.current) dayMat.current.uniforms.uHover.value = -1;
    invalidate();
    onTip(null);
  };

  return (
    <group ref={group} rotation={[...LAYOUT.group.rotation]} position={[...LAYOUT.group.position]} scale={fit}>
      <points ref={daysObj} geometry={dayGeo} onPointerMove={pick} onPointerDown={pick} onPointerOut={leave}>
        <shaderMaterial
          ref={dayMat}
          vertexShader={dayVertex}
          fragmentShader={dayFragment}
          uniforms={uniforms.days}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points geometry={flow} raycast={() => null}>
        <shaderMaterial
          ref={flowMat}
          vertexShader={flowVertex}
          fragmentShader={flowFragment}
          uniforms={uniforms.flow}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <lineLoop geometry={gate} raycast={() => null}>
        <lineBasicMaterial color="#9d8cff" transparent opacity={0.45} />
      </lineLoop>
      <primitive object={baseline} raycast={() => null} />
      <YearLabels years={years} fit={fit} />
    </group>
  );
});

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export default function DataFlowScene({
  animate,
  onReady,
  dense,
  start,
  steps,
}: {
  animate: boolean;
  onReady: () => void;
  dense: boolean;
  start: string;
  steps: (number | null)[];
}) {
  const pointer = useRef({ x: 0, y: 0 });
  const tip = useRef<HTMLDivElement>(null);
  const days = useMemo(() => buildDays(start, steps), [start, steps]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const hideTip = () => {
      if (tip.current) tip.current.hidden = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", hideTip, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", hideTip);
    };
  }, []);

  // The tooltip is updated directly, so hovering never re-renders the scene.
  const onTip = useMemo<Tip>(
    () => (info) => {
      const el = tip.current;
      if (!el) return;
      if (!info) {
        el.hidden = true;
        return;
      }
      const v = steps[info.i];
      el.firstElementChild!.textContent = dateLabel(days.iso[info.i]);
      el.lastElementChild!.textContent = v === null ? "No step data" : `${v.toLocaleString("en-US")} steps`;
      el.hidden = false;
      const x = Math.min(window.innerWidth - 90, Math.max(90, info.x));
      el.style.transform = `translate(${x}px, ${info.y}px)`;
    },
    [days, steps],
  );

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, LAYOUT.camera.z], fov: LAYOUT.camera.fov }}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        frameloop={animate ? "always" : "demand"}
        onCreated={({ raycaster }) => {
          raycaster.params.Points.threshold = 0.05;
          onReady();
        }}
        aria-hidden
      >
        <Scene days={days} count={dense ? 4200 : 2000} animate={animate} pointer={pointer} onTip={onTip} />
      </Canvas>
      {createPortal(
        <div
          ref={tip}
          hidden
          aria-hidden
          className="hero-tip pointer-events-none fixed left-0 top-0 z-50 whitespace-nowrap rounded-md border border-line-strong bg-surface-2/95 px-2.5 py-1.5 font-mono text-[0.6875rem] leading-tight shadow-[0_10px_30px_-10px_rgb(0_0_0/0.9)]"
        >
          <span className="block text-ink-1" />
          <span className="mt-0.5 block text-accent" />
        </div>,
        document.body,
      )}
    </div>
  );
}

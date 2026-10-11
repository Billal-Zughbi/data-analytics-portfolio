"use client";

/**
 * Hero centrepiece: "from noise to structure".
 *
 * Unordered records drift in from the left, pass through a transform gate,
 * and settle into an ordered lattice of columns on the right. The columns are
 * a decorative shape, not data. All motion is computed in the vertex shader
 * from a single time uniform, so React never re-renders per frame.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const COLUMN_HEIGHTS = [0.32, 0.46, 0.4, 0.58, 0.52, 0.68, 0.62, 0.77, 0.7, 0.86, 0.8, 0.93, 0.88, 1.0];
const COL_X0 = 0.95;
const COL_DX = 0.33;
const BASE_Y = -1.55;
const MAX_H = 3.1;
const ROW_STEP = 0.1;

type Lattice = { positions: Float32Array; count: number };

function buildLattice(): Lattice {
  const pts: number[] = [];
  COLUMN_HEIGHTS.forEach((h, c) => {
    const rows = Math.max(2, Math.round((h * MAX_H) / ROW_STEP));
    for (let r = 0; r < rows; r++) {
      for (const dx of [-0.07, 0.07]) {
        for (const dz of [-0.12, 0.12]) {
          pts.push(COL_X0 + c * COL_DX + dx, BASE_Y + r * ROW_STEP, dz);
        }
      }
    }
  });
  return { positions: new Float32Array(pts), count: pts.length / 3 };
}

const flowVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  attribute vec3 aTarget;
  varying float vAlpha;
  varying float vSettled;

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

    // Stage B: leave the gate and settle onto a lattice point.
    float b = smoothstep(0.56, 0.74, p);
    vec3 gate = vec3(0.0, 0.0, 0.0);
    vec3 arc = mix(gate, aTarget, b) + vec3(0.0, sin(b * 3.14159) * 0.6, 0.0);
    vec3 pos = mix(cloud, arc, step(0.56, p));

    // Stage C: rest, then fade so the particle can re-enter on the left.
    float fadeIn = smoothstep(0.0, 0.05, p);
    float fadeOut = 1.0 - smoothstep(0.9, 1.0, p);
    vAlpha = fadeIn * fadeOut;
    vSettled = b;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = mix(2.4, 3.2, b);
    gl_PointSize = size * uPixelRatio * (9.0 / -mv.z);
  }
`;

const flowFragment = /* glsl */ `
  uniform vec3 uRaw;
  uniform vec3 uSettled;
  varying float vAlpha;
  varying float vSettled;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.1, d);
    vec3 col = mix(uRaw, uSettled, vSettled);
    gl_FragColor = vec4(col, soft * vAlpha * mix(0.7, 1.0, vSettled));
  }
`;

const latticeVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vGlow;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // A slow scan line sweeps up the columns.
    float scan = fract(uTime * 0.08);
    float h = (position.y + 1.55) / 3.1;
    vGlow = smoothstep(0.12, 0.0, abs(h - scan));
    gl_PointSize = (1.9 + vGlow * 1.2) * uPixelRatio * (9.0 / -mv.z);
  }
`;

const latticeFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uGlow;
  varying float vGlow;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (length(c) > 0.5) discard;
    gl_FragColor = vec4(mix(uColor, uGlow, vGlow), 0.38 + vGlow * 0.5);
  }
`;

function Particles({ count, animate, pointer }: { count: number; animate: boolean; pointer: React.RefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null);
  const { gl } = useThree();
  const lattice = useMemo(() => buildLattice(), []);
  const flowMat = useRef<THREE.ShaderMaterial>(null);
  const latticeMat = useRef<THREE.ShaderMaterial>(null);

  const flow = useMemo(() => {
    const seeds = new Float32Array(count);
    const targets = new Float32Array(count * 3);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      seeds[i] = (i * 0.6180339887) % 1;
      const j = Math.floor(((i * 7919) % lattice.count + lattice.count) % lattice.count);
      targets[i * 3] = lattice.positions[j * 3];
      targets[i * 3 + 1] = lattice.positions[j * 3 + 1];
      targets[i * 3 + 2] = lattice.positions[j * 3 + 2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute("aTarget", new THREE.BufferAttribute(targets, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 12);
    return geo;
  }, [count, lattice]);

  const latticeGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(lattice.positions, 3));
    return geo;
  }, [lattice]);

  const uniforms = useMemo(
    () => ({
      flow: {
        uTime: { value: 7.5 },
        uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
        uRaw: { value: new THREE.Color("#93a0c8") },
        uSettled: { value: new THREE.Color("#4fd8ff") },
      },
      lattice: {
        uTime: { value: 7.5 },
        uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
        uColor: { value: new THREE.Color("#4a62a8") },
        uGlow: { value: new THREE.Color("#9d8cff") },
      },
    }),
    [gl],
  );

  const gate = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(0, Math.sin(a) * 1.35, Math.cos(a) * 1.35));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  const baseline = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(COL_X0 - 0.3, BASE_Y - 0.12, 0),
      new THREE.Vector3(COL_X0 + COLUMN_HEIGHTS.length * COL_DX, BASE_Y - 0.12, 0),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: "#4fd8ff", transparent: true, opacity: 0.25 });
    return new THREE.Line(geo, mat);
  }, []);

  useEffect(
    () => () => {
      flow.dispose();
      latticeGeo.dispose();
      gate.dispose();
      baseline.geometry.dispose();
      (baseline.material as THREE.Material).dispose();
    },
    [flow, latticeGeo, gate, baseline],
  );

  useFrame((_, delta) => {
    if (!animate) return;
    if (flowMat.current) flowMat.current.uniforms.uTime.value += delta;
    if (latticeMat.current) latticeMat.current.uniforms.uTime.value += delta;
    const g = group.current;
    if (g && pointer.current) {
      const targetY = -0.32 + pointer.current.x * 0.18;
      const targetX = 0.08 + pointer.current.y * 0.08;
      g.rotation.y += (targetY - g.rotation.y) * Math.min(1, delta * 2.5);
      g.rotation.x += (targetX - g.rotation.x) * Math.min(1, delta * 2.5);
    }
  });

  return (
    <group ref={group} rotation={[0.08, -0.32, 0]} position={[0.2, 0.1, 0]}>
      <points geometry={latticeGeo}>
        <shaderMaterial
          ref={latticeMat}
          vertexShader={latticeVertex}
          fragmentShader={latticeFragment}
          uniforms={uniforms.lattice}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points geometry={flow}>
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
      <lineLoop geometry={gate}>
        <lineBasicMaterial color="#9d8cff" transparent opacity={0.45} />
      </lineLoop>
      <primitive object={baseline} />
    </group>
  );
}

export default function DataFlowScene({
  animate,
  onReady,
  dense,
}: {
  animate: boolean;
  onReady: () => void;
  dense: boolean;
}) {
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="h-full w-full">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 9], fov: 42 }}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        frameloop={animate ? "always" : "demand"}
        onCreated={() => onReady()}
        aria-hidden
      >
        <Particles count={dense ? 4200 : 2000} animate={animate} pointer={pointer} />
      </Canvas>
    </div>
  );
}

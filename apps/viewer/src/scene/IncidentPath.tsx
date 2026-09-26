import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { AdditiveBlending, Color, Group, InstancedMesh, Mesh, Object3D, TetrahedronGeometry, MeshBasicMaterial, Vector3 } from 'three';
import type { PathStep } from '@codeverse/schema';
import type { CityLayout, Vec3 } from '../layout/cityLayout';
import { hash, mulberry32 } from '../layout/cityLayout';
import { currentIncident, useStore } from '../store';
import { arcPoint, arcPoints } from './arcs';
import { PALETTE } from './palette';

const SHARDS = 42;

/** Anchor for an execution step; a leading "User" step sits outside the city at the nearest gateway. */
export function stepAnchors(steps: PathStep[], layout: CityLayout): Vec3[] {
  const out: Vec3[] = [];
  steps.forEach((s, i) => {
    let a = layout.anchor(s.file);
    if (i === 0 && /^(user|client|browser|customer request)/i.test(s.label)) {
      const next = steps[1] ? layout.anchor(steps[1].file) : a;
      const gw = [...layout.gateways].sort((g, h) => Math.hypot(g.x - (next?.x ?? 0), g.z - (next?.z ?? 0)) - Math.hypot(h.x - (next?.x ?? 0), h.z - (next?.z ?? 0)))[0];
      if (gw) {
        const len = Math.hypot(gw.x, gw.z) || 1;
        a = { x: gw.x + (gw.x / len) * 6, y: 1.2, z: gw.z + (gw.z / len) * 6 };
      }
    }
    const prev = out.filter((p) => a && Math.abs(p.x - a.x) < 0.01 && Math.abs(p.z - a.z) < 0.01).length;
    out.push(a ? { ...a, y: a.y + prev * 1.6 } : { x: 0, y: 1, z: 0 });
  });
  return out;
}

function Fracture({ at, healed }: { at: Vec3; healed: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const glow = useRef<Mesh>(null);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const shards = useMemo(() => {
    const r = mulberry32(hash('fracture'));
    return Array.from({ length: SHARDS }, () => {
      const th = r() * Math.PI * 2;
      const ph = r() * Math.PI - Math.PI / 2;
      return { dir: new Vector3(Math.cos(th) * Math.cos(ph), Math.abs(Math.sin(ph)) * 0.8 + 0.2, Math.sin(th) * Math.cos(ph)), dist: 0.8 + r() * 2.2, spin: r() * 4, size: 0.12 + r() * 0.2 };
    });
  }, []);
  const geometry = useMemo(() => new TetrahedronGeometry(1), []);
  const material = useMemo(() => new MeshBasicMaterial({ color: new Color(PALETTE.red).multiplyScalar(2.4), toneMapped: false, transparent: true }), []);
  const start = useRef(performance.now());
  const healStart = useRef<number | null>(null);
  const tmp = useMemo(() => new Object3D(), []);
  useEffect(() => {
    if (healed) healStart.current = performance.now();
    else start.current = performance.now();
  }, [healed]);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const now = performance.now();
    const burst = reducedMotion ? 1 : Math.min(1, (now - start.current) / 650);
    const heal = healStart.current === null || !healed ? 0 : reducedMotion ? 1 : Math.min(1, (now - healStart.current) / 1400);
    const e = 1 - Math.pow(1 - burst, 3);
    material.color.set(heal > 0 ? PALETTE.green : PALETTE.red).multiplyScalar(2.4);
    material.opacity = 1 - heal;
    shards.forEach((s, i) => {
      const d = s.dist * e * (1 - heal) + Math.sin(clock.elapsedTime * 2 + i) * 0.05;
      tmp.position.set(at.x + s.dir.x * d, at.y + 0.6 + s.dir.y * d, at.z + s.dir.z * d);
      tmp.rotation.set(clock.elapsedTime * s.spin, s.spin, clock.elapsedTime * s.spin * 0.5);
      tmp.scale.setScalar(s.size * (1 - heal * 0.8));
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (glow.current) {
      glow.current.scale.setScalar(1.6 + Math.sin(clock.elapsedTime * 5) * 0.25);
      (glow.current.material as MeshBasicMaterial).color.set(heal > 0.5 ? PALETTE.green : PALETTE.red);
    }
  });
  return (
    <group>
      <instancedMesh ref={ref} args={[geometry, material, SHARDS]} frustumCulled={false} />
      <mesh ref={glow} position={[at.x, 0.1, at.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.1, 1.6, 64]} />
        <meshBasicMaterial color={PALETTE.red} transparent opacity={0.7} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight position={[at.x, at.y + 1.5, at.z]} color={healed ? PALETTE.green : PALETTE.red} intensity={30} distance={14} />
    </group>
  );
}

function Packet({ anchors, from, to, color }: { anchors: Vec3[]; from: number; to: number; color: string }) {
  const ref = useRef<Group>(null);
  const started = useRef(performance.now());
  const reducedMotion = useStore((s) => s.reducedMotion);
  const p = useMemo(() => new Vector3(), []);
  useEffect(() => {
    started.current = performance.now();
  }, [from, to]);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const perStep = 850;
    const total = Math.max(1, to - from) * perStep;
    const u = reducedMotion ? 1 : Math.min(1, (performance.now() - started.current) / total);
    const pos = from + (to - from) * u;
    const i = Math.min(Math.floor(pos), anchors.length - 2);
    const f = pos - i;
    const a = anchors[Math.max(0, i)];
    const b = anchors[Math.max(0, i) + 1] ?? a;
    if (!a || !b) return;
    arcPoint(a, b, Math.min(1, f), 0.25, p);
    g.position.copy(p);
  });
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshBasicMaterial color={new Color(color).multiplyScalar(3)} toneMapped={false} />
      </mesh>
      <pointLight color={color} intensity={12} distance={8} />
    </group>
  );
}

export function IncidentPath({ layout }: { layout: CityLayout }) {
  const incident = useStore(currentIncident);
  const mode = useStore((s) => s.mode);
  const stage = useStore((s) => s.stage);
  const progress = useStore((s) => s.pathProgress);
  const healed = useStore((s) => s.healed);
  const steps = incident?.investigation.executionPath ?? [];
  const anchors = useMemo(() => stepAnchors(steps, layout), [steps, layout]);
  const failIdx = steps.findIndex((s) => s.status === 'failed');
  const prev = useRef(0);
  const from = useRef(0);
  if (progress !== prev.current) {
    from.current = Math.max(0, Math.min(prev.current, progress) - 1);
    prev.current = progress;
  }
  if (!incident || mode !== 'incident' || stage === 'investigate') return null;
  const revealed = healed ? steps.length : Math.min(progress, steps.length);
  const failureRevealed = failIdx >= 0 && failIdx < revealed && !healed;

  return (
    <group>
      {anchors.slice(0, Math.max(0, revealed)).map((a, i) => {
        const next = anchors[i + 1];
        const step = steps[i]!;
        const nextStep = steps[i + 1];
        const showSeg = next && i + 1 < revealed;
        const segColor = healed ? PALETTE.green : nextStep?.status === 'failed' ? PALETTE.red : nextStep?.status === 'not-reached' ? '#5b6470' : PALETTE.green;
        const notReached = step.status === 'not-reached' && !healed;
        return (
          <group key={step.id}>
            {showSeg && next && (Math.hypot(a.x - next.x, a.z - next.z) > 0.05 || Math.abs(a.y - next.y) > 0.05) && (
              <Line points={arcPoints(a, next, 28, 0.25)} color={segColor} lineWidth={notReached || nextStep?.status === 'not-reached' ? 1.5 : 3.2} dashed={nextStep?.status === 'not-reached' && !healed} dashSize={0.4} gapSize={0.3} toneMapped={false} transparent opacity={0.95} />
            )}
          </group>
        );
      })}
      {revealed > 0 && revealed <= steps.length && (
        <Packet anchors={anchors} from={healed ? 0 : from.current} to={healed ? steps.length - 1 : Math.max(0, revealed - 1)} color={healed ? PALETTE.green : failureRevealed && revealed - 1 === failIdx ? PALETTE.red : PALETTE.cyan} />
      )}
      {failIdx >= 0 && failIdx < revealed && anchors[failIdx] && (stage !== 'replay' || failIdx < revealed) && <Fracture at={anchors[failIdx]!} healed={healed} />}
    </group>
  );
}

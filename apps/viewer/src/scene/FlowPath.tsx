import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Color, Group, Vector3 } from 'three';
import type { CityLayout } from '../layout/cityLayout';
import { useStore } from '../store';
import { flowsFor } from '../story/flows';
import { arcPoint, arcPoints } from './arcs';
import { PALETTE } from './palette';

const HOP_MS = 1100;

/** "Follow a request": the hops travelled so far, and a packet moving along the current one. */
export function FlowPath({ layout }: { layout: CityLayout }) {
  const world = useStore((s) => s.world);
  const flow = useStore((s) => s.flow);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const f = flow && world ? flowsFor(world).find((x) => x.id === flow.id) : undefined;
  const hops = useMemo(
    () =>
      (f?.hops ?? []).map((h) => {
        const a = layout.anchor(h.from);
        const b = layout.anchor(h.to);
        return a && b ? { h, a: { ...a, y: a.y + 0.4 }, b: { ...b, y: b.y + 0.4 } } : undefined;
      }),
    [f, layout],
  );
  const packet = useRef<Group>(null);
  const started = useRef(performance.now());
  const p = useMemo(() => new Vector3(), []);
  useEffect(() => {
    started.current = performance.now();
  }, [flow?.id, flow?.step]);
  useFrame(() => {
    const g = packet.current;
    const cur = flow ? hops[flow.step] : undefined;
    if (!g || !cur) return;
    const u = reducedMotion ? 1 : Math.min(1, (performance.now() - started.current) / HOP_MS);
    const e = 1 - Math.pow(1 - u, 3);
    arcPoint(cur.a, cur.b, e, 0.3, p);
    g.position.copy(p);
  });
  if (!f || !flow) return null;
  const cur = hops[flow.step];
  const color = (s: string) => (s === 'failed' ? PALETTE.red : s === 'not-reached' ? '#5b6470' : f.incident ? PALETTE.green : PALETTE.cyan);
  return (
    <group>
      {hops.map((x, i) =>
        x && i <= flow.step && (Math.hypot(x.a.x - x.b.x, x.a.z - x.b.z) > 0.05 || Math.abs(x.a.y - x.b.y) > 0.05) ? (
          <Line key={i} points={arcPoints(x.a, x.b, 28, 0.3)} color={color(x.h.status)} lineWidth={i === flow.step ? 3.4 : 2.2} dashed={x.h.status === 'not-reached'} dashSize={0.4} gapSize={0.3} toneMapped={false} transparent opacity={i === flow.step ? 1 : 0.7} />
        ) : null,
      )}
      {cur && (
        <group ref={packet}>
          <mesh>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshBasicMaterial color={new Color(color(cur.h.status)).multiplyScalar(3)} toneMapped={false} />
          </mesh>
          <pointLight color={color(cur.h.status)} intensity={14} distance={9} />
        </group>
      )}
    </group>
  );
}

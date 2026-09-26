import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Trail } from '@react-three/drei';
import { AdditiveBlending, Color, Mesh, Vector3 } from 'three';
import type { CityLayout } from '../layout/cityLayout';
import { useStore } from '../store';
import { laneColor } from './palette';
import { usePlaybackState } from './useHighlights';

const HOVER = 2.2;

function Probe({ layout, at, color, label, index, active }: { layout: CityLayout; at?: string; color: string; label: string; index: number; active: boolean }) {
  const ref = useRef<Mesh>(null);
  const target = useMemo(() => new Vector3(), []);
  const home = useMemo(() => new Vector3(Math.cos(index * 1.7) * 3, 10 + index * 1.2, Math.sin(index * 1.7) * 3), [index]);
  const reducedMotion = useStore((s) => s.reducedMotion);
  useFrame(({ clock }, dt) => {
    const m = ref.current;
    if (!m) return;
    const a = at ? layout.anchor(at) : undefined;
    if (a) target.set(a.x, a.y + HOVER + Math.sin(clock.elapsedTime * 3 + index) * 0.15, a.z);
    else target.copy(home);
    if (reducedMotion) m.position.copy(target);
    else m.position.lerp(target, 1 - Math.pow(0.02, dt));
    const s = active ? 1 + Math.sin(clock.elapsedTime * 6) * 0.12 : 0.6;
    m.scale.setScalar(s);
  });
  const c = new Color(color).multiplyScalar(2.6);
  return (
    <Trail width={1.4} length={reducedMotion ? 0.01 : 7} color={new Color(color)} attenuation={(w) => w * w} decay={1.2}>
      <mesh ref={ref} position={home}>
        <sphereGeometry args={[0.32, 20, 20]} />
        <meshBasicMaterial color={c} toneMapped={false} />
        <mesh>
          <sphereGeometry args={[0.7, 20, 20]} />
          <meshBasicMaterial color={color} transparent opacity={0.18} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
        {index > 0 && active && (
          <Html position={[0, 0.9, 0]} center style={{ pointerEvents: 'none' }}>
            <div className="label-pill" style={{ color, fontSize: 10.5, maxWidth: 200 }}>
              <span className="truncate" style={{ display: 'inline-block', maxWidth: 190, verticalAlign: 'bottom' }}>
                ⤷ {label}
              </span>
            </div>
          </Html>
        )}
      </mesh>
    </Trail>
  );
}

/** Expanding scan rings over buildings matched by Bob's latest search. */
function ScanRings({ layout, ids }: { layout: CityLayout; ids: string[] }) {
  const refs = useRef<Array<Mesh | null>>([]);
  const items = useMemo(() => ids.map((id) => ({ id, a: layout.anchor(id) })).filter((x) => x.a).slice(0, 60), [ids, layout]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const t = (clock.elapsedTime * 0.9 + i * 0.13) % 1;
      m.scale.setScalar(0.6 + t * 2.2);
      (m.material as { opacity: number }).opacity = (1 - t) * 0.8;
    });
  });
  return (
    <group>
      {items.map((x, i) => (
        <mesh key={x.id} ref={(el) => void (refs.current[i] = el)} position={[x.a!.x, 0.08, x.a!.z]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.9, 1.05, 48]} />
          <meshBasicMaterial color={new Color('#64d2ff').multiplyScalar(2)} transparent toneMapped={false} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Bob's live investigation: one probe per agent lane, trails, and search sweeps. */
export function BobProbes({ layout }: { layout: CityLayout }) {
  const pb = usePlaybackState();
  const mode = useStore((s) => s.mode);
  const stage = useStore((s) => s.stage);
  if (!pb || (mode === 'incident' && stage !== 'investigate')) return null;
  return (
    <group>
      {pb.lanes.map((l, i) =>
        l.kind === 'main' || l.active || l.at ? <Probe key={l.id} layout={layout} at={l.active || l.kind === 'main' ? l.at : undefined} color={laneColor(i)} label={l.label} index={i} active={l.active || (l.kind === 'main' && !pb.done)} /> : null,
      )}
      <ScanRings layout={layout} ids={pb.matched} />
    </group>
  );
}

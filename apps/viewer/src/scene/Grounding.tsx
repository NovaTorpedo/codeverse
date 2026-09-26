import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, MeshBasicMaterial } from 'three';
import type { Claim, GroundingReport } from '@codeverse/grounding';
import type { CityLayout, Vec3 } from '../layout/cityLayout';
import { useStore } from '../store';
import { PALETTE } from './palette';

/** Where to put a phantom: next to the district whose files share the longest path prefix with the claim. */
export function phantomSpot(layout: CityLayout, file: string, index: number): Vec3 {
  let best: { x: number; z: number; r: number } | undefined;
  let bestLen = 0;
  for (const b of layout.buildings) {
    const pa = b.id.split('/');
    const pb = file.split('/');
    let k = 0;
    while (k < pa.length && k < pb.length && pa[k] === pb[k]) k++;
    if (k > bestLen) {
      bestLen = k;
      const d = layout.districts.find((x) => x.id === b.district);
      if (d) best = d;
    }
  }
  const base = best ?? { x: layout.bounds.radius, z: 0, r: 2 };
  const ang = 0.9 + index * 0.8;
  return { x: base.x + Math.cos(ang) * (base.r + 1.8), y: 0, z: base.z + Math.sin(ang) * (base.r + 1.8) };
}

/** Unverified claims that cite files missing from the code, one phantom per file. */
export function phantomSpots(layout: CityLayout, report?: GroundingReport): Array<{ claim: Claim; at: Vec3 }> {
  if (!report) return [];
  const seen = new Set<string>();
  return report.claims
    .filter((c) => c.status === 'unverified' && c.nodes.length === 0 && c.citation)
    .filter((c) => (seen.has(c.citation!.file) ? false : (seen.add(c.citation!.file), true)))
    .slice(0, 8)
    .map((c, i) => ({ claim: c, at: phantomSpot(layout, c.citation!.file, i) }));
}

function Phantom({ at }: { at: Vec3 }) {
  const ref = useRef<Group>(null);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const material = useMemo(() => new MeshBasicMaterial({ color: new Color(PALETTE.amber).multiplyScalar(1.6), wireframe: true, transparent: true, opacity: 0.5, toneMapped: false }), []);
  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    const t = clock.elapsedTime;
    material.opacity = Math.sin(t * 17) * Math.sin(t * 5.3) > 0.55 ? 0.08 : 0.5;
    ref.current.position.y = Math.sin(t * 1.5) * 0.1;
  });
  return (
    <group position={[at.x, 0, at.z]}>
      <group ref={ref}>
        <mesh position-y={1.4} material={material}>
          <boxGeometry args={[1.3, 2.8, 1.3]} />
        </mesh>
      </group>
    </group>
  );
}

/** Flickering phantom constructs for claims that don't match the code. Labels live in SceneLabels. */
export function Phantoms({ layout, report }: { layout: CityLayout; report?: GroundingReport }) {
  const phantoms = useMemo(() => phantomSpots(layout, report), [layout, report]);
  return (
    <group>
      {phantoms.map((p) => (
        <Phantom key={p.claim.id} at={p.at} />
      ))}
    </group>
  );
}

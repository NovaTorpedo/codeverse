import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Color, Group } from 'three';
import type { Claim, GroundingReport } from '@codeverse/grounding';
import type { CityLayout, Vec3 } from '../layout/cityLayout';
import { currentIncident, useStore } from '../store';
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

function Phantom({ at, claim }: { at: Vec3; claim: Claim }) {
  const ref = useRef<Group>(null);
  const reducedMotion = useStore((s) => s.reducedMotion);
  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    const t = clock.elapsedTime;
    const flicker = Math.sin(t * 17) * Math.sin(t * 5.3) > 0.55 ? 0.15 : 1;
    ref.current.children.forEach((c) => ((c as unknown as { material?: { opacity: number } }).material ? ((c as unknown as { material: { opacity: number } }).material.opacity = 0.5 * flicker) : null));
    ref.current.position.y = Math.sin(t * 1.5) * 0.1;
  });
  const name = claim.citation?.file.split('/').pop() ?? claim.label;
  return (
    <group position={[at.x, 0, at.z]}>
      <group ref={ref}>
        <mesh position-y={1.4}>
          <boxGeometry args={[1.3, 2.8, 1.3]} />
          <meshBasicMaterial color={new Color(PALETTE.amber).multiplyScalar(1.6)} wireframe transparent opacity={0.5} toneMapped={false} />
        </mesh>
      </group>
      <Html position={[0, 3.4, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="label-pill phantom" title={claim.reason}>
          ⚠ {name} <span className="tertiary">unverified</span>
        </div>
      </Html>
    </group>
  );
}

/** Flickering phantom constructs for claims that don't match the code. */
export function Phantoms({ layout, report }: { layout: CityLayout; report?: GroundingReport }) {
  const phantoms = useMemo(() => {
    if (!report) return [];
    const seen = new Set<string>();
    return report.claims
      .filter((c) => c.status === 'unverified' && c.nodes.length === 0 && c.citation)
      .filter((c) => (seen.has(c.citation!.file) ? false : (seen.add(c.citation!.file), true)))
      .slice(0, 8)
      .map((c, i) => ({ claim: c, at: phantomSpot(layout, c.citation!.file, i) }));
  }, [layout, report]);
  return (
    <group>
      {phantoms.map((p) => (
        <Phantom key={p.claim.id} at={p.at} claim={p.claim} />
      ))}
    </group>
  );
}

/** Bob's conclusions pinned to the buildings they cite, with grounding badges. */
export function Annotations({ layout }: { layout: CityLayout }) {
  const incident = useStore(currentIncident);
  const stage = useStore((s) => s.stage);
  const mode = useStore((s) => s.mode);
  const openCode = useStore((s) => s.openCode);
  const pins = useMemo(() => {
    if (!incident) return [];
    const byFile = new Map<string, { claim: Claim; count: number }>();
    for (const c of incident.grounding.claims) {
      if (!c.citation || !c.where.startsWith('rootCause') || c.nodes.length === 0) continue;
      const cur = byFile.get(c.citation.file);
      byFile.set(c.citation.file, { claim: cur?.claim ?? c, count: (cur?.count ?? 0) + 1 });
    }
    return [...byFile.values()];
  }, [incident]);
  if (mode !== 'incident' || !incident || (stage !== 'explain' && stage !== 'fix')) return null;
  return (
    <group>
      {pins.map(({ claim }) => {
        const a = layout.anchor(claim.citation!.file);
        if (!a) return null;
        const ok = claim.status === 'grounded';
        return (
          <Html key={claim.id} position={[a.x, a.y + 3.2, a.z]} center zIndexRange={[60, 40]}>
            <button
              className="label-pill"
              style={{ pointerEvents: 'auto', cursor: 'pointer', color: ok ? PALETTE.green : PALETTE.yellow, border: 0 }}
              onClick={() => openCode({ file: claim.citation!.file, line: claim.citation!.line, endLine: claim.citation!.endLine, tone: 'yellow', title: claim.citation!.symbol })}
            >
              {ok ? '✓' : '~'} {claim.citation!.file.split('/').pop()}
              {claim.citation!.line ? `:${claim.citation!.line}` : ''}
            </button>
          </Html>
        );
      })}
    </group>
  );
}

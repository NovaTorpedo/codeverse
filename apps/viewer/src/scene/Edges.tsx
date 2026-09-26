import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, InstancedMesh, Object3D, SphereGeometry, MeshBasicMaterial, Vector3 } from 'three';
import type { AnalysisGraph } from '@codeverse/schema';
import type { CityLayout, Vec3 } from '../layout/cityLayout';
import { useStore } from '../store';
import { arcPoint, arcPoints } from './arcs';
import { PALETTE } from './palette';

const EDGE_COLORS: Record<string, string> = { imports: '#2a5a78', calls: PALETTE.cyan, handles: PALETTE.teal, 'uses-db': PALETTE.indigo };
const SEG = 14;

interface Arc {
  id: string;
  a: Vec3;
  b: Vec3;
  kind: string;
  source: string;
  target: string;
}

export function useArcs(graph: AnalysisGraph, layout: CityLayout): Arc[] {
  return useMemo(() => {
    const out: Arc[] = [];
    for (const e of graph.edges) {
      const a = layout.anchor(e.source);
      const b = layout.anchor(e.target);
      if (!a || !b) continue;
      out.push({ id: e.id, a, b, kind: e.kind, source: e.source, target: e.target });
    }
    return out;
  }, [graph, layout]);
}

/** All dependency arcs merged into one draw call. */
export function EdgeLines({ arcs, dim }: { arcs: Arc[]; dim: boolean }) {
  const geometry = useMemo(() => {
    const pos: number[] = [];
    const colors: number[] = [];
    const c = new Color();
    const p = new Vector3();
    const q = new Vector3();
    for (const arc of arcs) {
      if (arc.kind === 'imports' && arcs.some((x) => x.kind === 'calls' && x.source === arc.source && x.target === arc.target)) continue;
      c.set(EDGE_COLORS[arc.kind] ?? '#335');
      const strength = arc.kind === 'calls' ? 0.55 : arc.kind === 'imports' ? 0.5 : 0.7;
      for (let i = 0; i < SEG; i++) {
        arcPoint(arc.a, arc.b, i / SEG, 0.32, p);
        arcPoint(arc.a, arc.b, (i + 1) / SEG, 0.32, q);
        const fade = 0.35 + 0.65 * Math.sin((i / SEG) * Math.PI);
        pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
        colors.push(c.r * strength * fade, c.g * strength * fade, c.b * strength * fade, c.r * strength * fade, c.g * strength * fade, c.b * strength * fade);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(colors, 3));
    return g;
  }, [arcs]);
  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={dim ? 0.18 : 0.75} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </lineSegments>
  );
}

/** Requests as light particles flowing along real call and route edges. */
export function Particles({ arcs, enabled }: { arcs: Arc[]; enabled: boolean }) {
  const flows = useMemo(() => {
    const live = arcs.filter((a) => a.kind === 'calls' || a.kind === 'handles');
    const list: Array<{ arc: Arc; offset: number; speed: number }> = [];
    live.forEach((arc, i) => {
      const n = arc.kind === 'handles' ? 2 : 1;
      for (let k = 0; k < n; k++) list.push({ arc, offset: ((i * 0.37 + k * 0.5) % 1) as number, speed: 0.18 + ((i * 7) % 5) * 0.03 });
    });
    return list.slice(0, 400);
  }, [arcs]);
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new SphereGeometry(0.09, 8, 8), []);
  const material = useMemo(() => new MeshBasicMaterial({ color: new Color(PALETTE.white).multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0.9 }), []);
  const tmp = useMemo(() => new Object3D(), []);
  const p = useMemo(() => new Vector3(), []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    flows.forEach((f, i) => {
      const u = (f.offset + t * f.speed) % 1;
      arcPoint(f.arc.a, f.arc.b, u, 0.32, p);
      tmp.position.copy(p);
      const s = Math.sin(u * Math.PI);
      tmp.scale.setScalar(0.4 + s);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  if (!enabled || flows.length === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, flows.length]} frustumCulled={false} />;
}

/** Bright arcs for the selected node's dependencies. */
export function SelectedEdges({ arcs }: { arcs: Arc[] }) {
  const selected = useStore((s) => s.selected);
  const lines = useMemo(() => (selected ? arcs.filter((a) => a.source === selected || a.target === selected).slice(0, 60) : []), [arcs, selected]);
  return (
    <group>
      {lines.map((a) => (
        <Line key={a.id} points={arcPoints(a.a, a.b, 24)} color={a.source === selected ? PALETTE.cyan : PALETTE.amber} lineWidth={2} transparent opacity={0.95} toneMapped={false} />
      ))}
    </group>
  );
}

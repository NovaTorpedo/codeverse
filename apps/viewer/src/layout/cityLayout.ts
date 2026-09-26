import type { AnalysisGraph, GraphNode } from '@codeverse/schema';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Building {
  id: string;
  node: GraphNode;
  district: string;
  /** Ground-center position. */
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  hue: number;
}

export interface District {
  id: string;
  label: string;
  x: number;
  z: number;
  r: number;
  hue: number;
  fileCount: number;
  loc: number;
  isTest: boolean;
}

export interface Gateway {
  id: string;
  label: string;
  district: string;
  x: number;
  z: number;
  angle: number;
  handler: string;
}

export interface Core {
  id: string;
  label: string;
  district: string;
  x: number;
  y: number;
  z: number;
}

export interface CityLayout {
  buildings: Building[];
  districts: District[];
  gateways: Gateway[];
  cores: Core[];
  byId: Map<string, Building>;
  /** Anchor point (top of building / gateway / core) for any node id. */
  anchor: (id: string) => Vec3 | undefined;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; radius: number };
}

/** Stable 32-bit hash for seeding. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CELL = 2.7;
const GAP = 3.2;

export function buildingHeight(loc: number): number {
  return 0.9 + Math.sqrt(Math.max(loc, 1)) * 0.62;
}

/** Spiral grid slots around a center, ordered by distance. */
function spiralSlots(n: number): Array<[number, number]> {
  const slots: Array<[number, number]> = [];
  const ring = Math.ceil(Math.sqrt(n)) + 2;
  for (let i = -ring; i <= ring; i++) for (let j = -ring; j <= ring; j++) slots.push([i, j]);
  slots.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]) || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  return slots.slice(0, n);
}

export function layoutCity(graph: AnalysisGraph): CityLayout {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const services = graph.nodes.filter((n) => n.kind === 'service').sort((a, b) => a.id.localeCompare(b.id));
  const filesBy = new Map<string, GraphNode[]>();
  for (const n of graph.nodes) {
    if (n.kind !== 'file') continue;
    filesBy.set(n.service, [...(filesBy.get(n.service) ?? []), n]);
  }

  // Service-to-service affinity from file-level edges.
  const affinity = new Map<string, number>();
  for (const e of graph.edges) {
    const a = nodes.get(e.source)?.service;
    const b = nodes.get(e.target)?.service;
    if (!a || !b || a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    affinity.set(key, (affinity.get(key) ?? 0) + (e.kind === 'calls' ? 2 : 1));
  }

  const rng = mulberry32(hash(graph.project.name + graph.nodes.length));
  const sim = services.map((s, i) => {
    const files = filesBy.get(s.id) ?? [];
    const side = Math.ceil(Math.sqrt(Math.max(files.length, 1)));
    const r = (side * CELL) / 2 + 2.4;
    const angle = i * 2.399963 + rng() * 0.3;
    const dist = 6 + Math.sqrt(i) * 9;
    return { id: s.id, x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, vx: 0, vz: 0, r, files: files.length };
  });

  // Force-directed placement: springs along affinity, repulsion between all, gentle gravity.
  for (let iter = 0; iter < 420; iter++) {
    const cool = 1 - iter / 420;
    for (let i = 0; i < sim.length; i++) {
      const a = sim[i]!;
      let fx = -a.x * 0.012;
      let fz = -a.z * 0.012;
      for (let j = 0; j < sim.length; j++) {
        if (i === j) continue;
        const b = sim[j]!;
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const d2 = Math.max(dx * dx + dz * dz, 0.01);
        const d = Math.sqrt(d2);
        const rep = (60 * (a.r + b.r)) / d2;
        fx += (dx / d) * rep;
        fz += (dz / d) * rep;
        const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        const w = affinity.get(key);
        if (w) {
          const ideal = a.r + b.r + GAP;
          const pull = Math.min(w, 8) * 0.018 * (d - ideal);
          fx -= (dx / d) * pull;
          fz -= (dz / d) * pull;
        }
      }
      a.vx = (a.vx + fx) * 0.6;
      a.vz = (a.vz + fz) * 0.6;
    }
    for (const a of sim) {
      a.x += a.vx * cool;
      a.z += a.vz * cool;
    }
  }
  // Relax: resolve any remaining overlap exactly.
  for (let pass = 0; pass < 200; pass++) {
    let moved = false;
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i]!;
        const b = sim[j]!;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 0.001;
        const min = a.r + b.r + GAP;
        if (d < min) {
          const push = (min - d) / 2 + 0.01;
          a.x -= (dx / d) * push;
          a.z -= (dz / d) * push;
          b.x += (dx / d) * push;
          b.z += (dz / d) * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  // Center the city.
  const cx = sim.reduce((s, a) => s + a.x, 0) / Math.max(sim.length, 1);
  const cz = sim.reduce((s, a) => s + a.z, 0) / Math.max(sim.length, 1);
  for (const a of sim) {
    a.x -= cx;
    a.z -= cz;
  }

  const districts: District[] = [];
  const buildings: Building[] = [];
  const gateways: Gateway[] = [];
  const cores: Core[] = [];

  sim.forEach((s, i) => {
    const svc = nodes.get(s.id)!;
    const hue = svc.isTest ? 230 : 188 + ((hash(s.id) % 70) - 20) * (i % 2 ? 1 : -1) * 0.6;
    districts.push({ id: s.id, label: svc.label, x: s.x, z: s.z, r: s.r, hue, fileCount: s.files, loc: svc.loc, isTest: svc.isTest });
    const files = [...(filesBy.get(s.id) ?? [])].sort((a, b) => b.loc - a.loc || a.id.localeCompare(b.id));
    const slots = spiralSlots(files.length);
    files.forEach((f, k) => {
      const [gx, gz] = slots[k]!;
      const foot = 1.05 + Math.min(1, f.loc / 160) * 0.75;
      buildings.push({
        id: f.id,
        node: f,
        district: s.id,
        x: s.x + gx * CELL,
        z: s.z + gz * CELL,
        w: foot,
        d: foot,
        h: f.isTest ? buildingHeight(f.loc) * 0.55 : buildingHeight(f.loc),
        hue,
      });
    });
  });

  const byId = new Map(buildings.map((b) => [b.id, b]));
  const districtById = new Map(districts.map((d) => [d.id, d]));

  const routes = graph.nodes.filter((n) => n.kind === 'route').sort((a, b) => a.id.localeCompare(b.id));
  const routesByDistrict = new Map<string, GraphNode[]>();
  for (const r of routes) routesByDistrict.set(r.service, [...(routesByDistrict.get(r.service) ?? []), r]);
  for (const [sid, list] of routesByDistrict) {
    const d = districtById.get(sid);
    if (!d) continue;
    const outward = Math.atan2(d.z, d.x) || 0;
    list.forEach((r, k) => {
      const angle = outward + (k - (list.length - 1) / 2) * 0.42;
      const handler = graph.edges.find((e) => e.kind === 'handles' && e.source === r.id)?.target ?? '';
      gateways.push({ id: r.id, label: r.label, district: sid, x: d.x + Math.cos(angle) * (d.r + 1.4), z: d.z + Math.sin(angle) * (d.r + 1.4), angle, handler });
    });
  }

  for (const n of graph.nodes.filter((x) => x.kind === 'database')) {
    const d = districtById.get(n.service);
    if (!d) continue;
    const tallest = Math.max(1, ...buildings.filter((b) => b.district === d.id).map((b) => b.h));
    cores.push({ id: n.id, label: n.label, district: d.id, x: d.x, y: tallest + 4.2, z: d.z });
  }

  const gwById = new Map(gateways.map((g) => [g.id, g]));
  const coreById = new Map(cores.map((c) => [c.id, c]));
  const anchor = (id: string): Vec3 | undefined => {
    const b = byId.get(id);
    if (b) return { x: b.x, y: b.h, z: b.z };
    const g = gwById.get(id);
    if (g) return { x: g.x, y: 1.6, z: g.z };
    const c = coreById.get(id);
    if (c) return { x: c.x, y: c.y, z: c.z };
    const d = districtById.get(id);
    if (d) return { x: d.x, y: 0.4, z: d.z };
    return undefined;
  };

  const xs = districts.flatMap((d) => [d.x - d.r, d.x + d.r]);
  const zs = districts.flatMap((d) => [d.z - d.r, d.z + d.r]);
  const minX = Math.min(0, ...xs);
  const maxX = Math.max(0, ...xs);
  const minZ = Math.min(0, ...zs);
  const maxZ = Math.max(0, ...zs);
  const radius = Math.max(12, ...districts.map((d) => Math.hypot(d.x, d.z) + d.r));
  return { buildings, districts, gateways, cores, byId, anchor, bounds: { minX, maxX, minZ, maxZ, radius } };
}

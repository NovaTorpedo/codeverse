import { citationStatus } from '@codeverse/grounding';
import type { Citation, GraphNode, PathStep } from '@codeverse/schema';
import type { LoadedWorld } from '../store';

/** Where a sentence comes from, so the panel can say so. */
export type Source = 'bob-scan' | 'bob-tour' | 'bob-investigation' | 'analyzer';

export interface Link {
  id: string;
  name: string;
  dir: 'out' | 'in';
  kind: string;
}

export interface Explanation {
  id: string;
  kind: 'district' | 'file' | 'route' | 'datastore';
  title: string;
  subtitle: string;
  summary?: { text: string; source: Source; verified?: boolean };
  /** Bob's note about this node in the incident investigation. */
  incident?: { label: string; note: string; failed: boolean };
  facts: string[];
  links: Link[];
  files?: Array<{ id: string; label: string; loc: number }>;
  code?: { file: string; line?: number; title?: string };
}

const base = (p: string) => p.split('/').pop() ?? p;

/** Bob's district name (from the semantic scan) or the analyzer's folder name. */
export function districtName(world: LoadedWorld, serviceId: string): string {
  return world.semantic?.services.find((s) => s.id === serviceId)?.name ?? serviceId.replace(/^svc:/, '');
}

/** Human name for any node: "payment.service.ts", "Payment", "POST /checkout", "Datastore". */
export function nodeName(world: LoadedWorld, id: string): string {
  const n = world.graph.nodes.find((x) => x.id === id);
  if (!n) return base(id);
  if (n.kind === 'service') return districtName(world, n.id);
  if (n.kind === 'database') return 'Datastore';
  return n.label;
}

function allVerified(world: LoadedWorld, citations: Citation[]): boolean | undefined {
  const r = world.semanticGrounding;
  if (!r || citations.length === 0) return undefined;
  return citations.every((c) => citationStatus(r, c) === 'grounded');
}

function incidentNote(world: LoadedWorld, file: string): Explanation['incident'] {
  for (const inc of world.incidents) {
    const steps = inc.investigation.executionPath.filter((s: PathStep) => s.file === file && s.note);
    const step = steps.find((s) => s.status === 'failed') ?? steps[0];
    if (step?.note) return { label: step.label, note: step.note, failed: step.status === 'failed' };
  }
  return undefined;
}

function linksOf(world: LoadedWorld, ids: Set<string>, level: 'file' | 'service'): Link[] {
  const nodes = new Map(world.graph.nodes.map((n) => [n.id, n]));
  const key = (id: string) => (level === 'service' ? nodes.get(id)?.service ?? id : id);
  const out = new Map<string, Link>();
  for (const e of world.graph.edges) {
    if (e.kind !== 'calls' && e.kind !== 'imports' && e.kind !== 'uses-db' && e.kind !== 'handles') continue;
    const src = ids.has(e.source);
    const dst = ids.has(e.target);
    if (src === dst) continue;
    const other = key(src ? e.target : e.source);
    if (ids.has(other)) continue;
    const dir = src ? 'out' : 'in';
    const k = `${dir}:${other}`;
    const prev = out.get(k);
    if (!prev || (prev.kind !== 'calls' && e.kind === 'calls')) out.set(k, { id: other, name: nodeName(world, other), dir, kind: e.kind });
  }
  const rank = (l: Link) => (l.kind === 'calls' ? 0 : l.kind === 'uses-db' ? 1 : 2);
  return [...out.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

function explainDistrict(world: LoadedWorld, n: GraphNode): Explanation {
  const sem = world.semantic?.services.find((s) => s.id === n.id);
  const files = world.graph.nodes.filter((f) => f.kind === 'file' && f.service === n.id).sort((a, b) => b.loc - a.loc);
  return {
    id: n.id,
    kind: 'district',
    title: districtName(world, n.id),
    subtitle: `${n.isTest ? 'Test district' : 'Service'} · ${files.length} file${files.length === 1 ? '' : 's'} · ${n.loc} lines`,
    summary: sem ? { text: sem.responsibility, source: 'bob-scan', verified: allVerified(world, sem.citations) } : undefined,
    facts: [],
    links: linksOf(world, new Set([n.id, ...files.map((f) => f.id)]), 'service').filter((l) => l.id.startsWith('svc:') || l.id.startsWith('db:')),
    files: files.map((f) => ({ id: f.id, label: f.label, loc: f.loc })),
    code: files[0]?.path ? { file: files[0].path } : undefined,
  };
}

function explainFile(world: LoadedWorld, n: GraphNode): Explanation {
  const waypoint = world.tour?.waypoints.find((w) => w.node === n.id);
  const entry = world.semantic?.entryPoints.find((e) => e.file === n.id);
  const sem = world.semantic?.services.find((s) => s.id === n.service);
  const summary: Explanation['summary'] = waypoint
    ? { text: waypoint.narration, source: 'bob-tour' }
    : entry
      ? { text: entry.description, source: 'bob-scan' }
      : sem
        ? { text: `Part of ${sem.name}. ${sem.responsibility}`, source: 'bob-scan', verified: allVerified(world, sem.citations) }
        : undefined;
  const exported = n.symbols.filter((s) => s.exported && s.kind !== 'type' && s.kind !== 'interface').map((s) => s.name);
  const methods = n.symbols.filter((s) => s.kind === 'method').map((s) => s.name);
  const defines = [...new Set([...exported, ...methods])];
  const facts: string[] = [];
  if (defines.length) facts.push(`Defines ${defines.slice(0, 4).join(', ')}${defines.length > 4 ? ` and ${defines.length - 4} more` : ''}`);
  if (n.routes.length) facts.push(`Serves ${n.routes.map((r) => `${r.method} ${r.path}`).join(', ')}`);
  if (n.isEntry) facts.push('Entry point');
  if (n.isTest) facts.push('Test file');
  const firstSymbol = [...n.symbols].sort((a, b) => a.line - b.line)[0];
  return {
    id: n.id,
    kind: 'file',
    title: n.label,
    subtitle: `${districtName(world, n.service)} · ${n.loc} lines`,
    summary,
    incident: incidentNote(world, n.id),
    facts,
    links: linksOf(world, new Set([n.id]), 'file'),
    code: n.path ? { file: n.path, line: firstSymbol?.line, title: firstSymbol?.name } : undefined,
  };
}

function explainRoute(world: LoadedWorld, n: GraphNode): Explanation {
  const route = n.routes[0];
  const handler = world.graph.edges.find((e) => e.kind === 'handles' && e.source === n.id)?.target;
  const desc = world.semantic?.entryPoints.find((e) => route && e.description.includes(`${route.method} ${route.path}`));
  return {
    id: n.id,
    kind: 'route',
    title: n.label,
    subtitle: `API route · handled in ${handler ? base(handler) : 'the gateway'}${route ? `:${route.line}` : ''}`,
    summary: desc ? { text: desc.description, source: 'bob-scan' } : { text: `The front door for ${n.label} requests. The analyzer found this route registered in ${handler ? base(handler) : 'the gateway'}.`, source: 'analyzer' },
    facts: [],
    links: handler ? [{ id: handler, name: nodeName(world, handler), dir: 'out', kind: 'handles' }] : [],
    code: n.path ? { file: n.path, line: route?.line, title: n.label } : undefined,
  };
}

function explainDatastore(world: LoadedWorld, n: GraphNode): Explanation {
  const sem = world.semantic?.services.find((s) => s.id === n.service);
  const users = world.graph.edges.filter((e) => e.kind === 'uses-db' && e.target === n.id).map((e) => e.source);
  return {
    id: n.id,
    kind: 'datastore',
    title: 'Datastore',
    subtitle: `${n.label} · used by ${users.length} file${users.length === 1 ? '' : 's'}`,
    summary: sem ? { text: sem.responsibility, source: 'bob-scan', verified: allVerified(world, sem.citations) } : undefined,
    facts: [],
    links: users.map((u) => ({ id: u, name: nodeName(world, u), dir: 'in' as const, kind: 'uses-db' })),
    code: n.path ? { file: n.path } : undefined,
  };
}

/** Plain-language explanation of any clickable thing in the city, from Bob's real data where it exists. */
export function explainNode(world: LoadedWorld, id: string): Explanation | undefined {
  const n = world.graph.nodes.find((x) => x.id === id);
  if (!n) return undefined;
  if (n.kind === 'service') return explainDistrict(world, n);
  if (n.kind === 'route') return explainRoute(world, n);
  if (n.kind === 'database') return explainDatastore(world, n);
  return explainFile(world, n);
}

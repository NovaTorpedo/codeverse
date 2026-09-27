import type { Citation } from '@codeverse/schema';
import type { LoadedWorld } from '../store';
import { districtName, nodeName } from './explain';

export interface FlowHop {
  from: string;
  to: string;
  /** One sentence explaining the hop. */
  sentence: string;
  via?: string;
  citation?: Citation;
  status: 'ok' | 'failed' | 'not-reached';
}

export interface RequestFlow {
  id: string;
  name: string;
  /** Where the flow comes from, shown under its name. */
  origin: string;
  description: string;
  hops: FlowHop[];
  /** True for the incident's failing request. */
  incident: boolean;
}

const serviceOf = (world: LoadedWorld, id: string) => world.graph.nodes.find((n) => n.id === id)?.service ?? id;

function hopSentence(world: LoadedWorld, from: string, to: string, via?: string): string {
  const a = districtName(world, serviceOf(world, from));
  const b = districtName(world, serviceOf(world, to));
  const call = via ? (via.endsWith(')') ? via : `${via}()`) : undefined;
  if (a === b) return call ? `Inside ${a}, ${nodeName(world, from)} calls ${call} in ${nodeName(world, to)}.` : `Inside ${a}, ${nodeName(world, from)} hands over to ${nodeName(world, to)}.`;
  return call ? `${a} calls ${b}: ${call}.` : `${a} hands over to ${b}.`;
}

const FRIENDLY: Record<string, string> = { checkout: 'Checkout', 'password-login': 'Password sign-in', 'sso-login': 'SSO sign-in' };

/**
 * Requests a visitor can follow through the city: every data flow from Bob's semantic scan, plus the failing
 * request Bob reconstructed in the incident investigation. Only real, cited steps; nothing invented.
 */
export function requestFlows(world: LoadedWorld): RequestFlow[] {
  const known = new Set(world.graph.nodes.map((n) => n.id));
  const flows: RequestFlow[] = [];
  for (const f of world.semantic?.dataFlows ?? []) {
    const hops = f.steps
      .filter((s) => known.has(s.from) && known.has(s.to))
      .map<FlowHop>((s) => ({ from: s.from, to: s.to, via: s.via, citation: s.citation, sentence: hopSentence(world, s.from, s.to, s.via), status: 'ok' }));
    if (hops.length) flows.push({ id: f.id, name: FRIENDLY[f.id] ?? f.name, origin: `From Bob's scan · ${f.name}`, description: f.description, hops, incident: false });
  }
  for (const inc of world.incidents) {
    const steps = inc.investigation.executionPath.filter((s) => known.has(s.file));
    const hops: FlowHop[] = [];
    for (let i = 1; i < steps.length; i++) {
      const s = steps[i]!;
      hops.push({
        from: steps[i - 1]!.file,
        to: s.file,
        via: s.symbol,
        citation: { file: s.file, line: s.line, symbol: s.symbol },
        sentence: s.note ?? `${s.label}.`,
        status: s.status,
      });
    }
    if (hops.length) {
      flows.push({
        id: `incident:${inc.id}`,
        name: 'Checkout after SSO sign-in',
        origin: `The failing request, reconstructed by Bob (${inc.title})`,
        description: inc.investigation.summary,
        hops,
        incident: true,
      });
    }
  }
  return flows;
}

const cache = new WeakMap<LoadedWorld, RequestFlow[]>();

/** requestFlows, computed once per loaded world. */
export function flowsFor(world: LoadedWorld): RequestFlow[] {
  let f = cache.get(world);
  if (!f) {
    f = requestFlows(world);
    cache.set(world, f);
  }
  return f;
}

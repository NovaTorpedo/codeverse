import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '@codeverse/analyzer';
import { ground } from '@codeverse/grounding';
import { AnalysisGraph, Investigation, Recording, SemanticLayer, Tour } from '@codeverse/schema';
import { layoutCity } from '../layout/cityLayout';
import type { LoadedWorld } from '../store';
import { linkSearch, parseLink } from './deeplink';
import { explainNode, nodeName } from './explain';
import { requestFlows } from './flows';
import { impactFacts } from './impact';

const repoRoot = path.resolve(__dirname, '../../../..');
const json = (p: string) => JSON.parse(readFileSync(path.join(repoRoot, p), 'utf8'));
const graph = AnalysisGraph.parse(analyze({ repoRoot, target: 'demo/shopfloor', name: 'Shopfloor' }));
const semantic = SemanticLayer.parse(json('worlds/shopfloor/semantic.json'));
const tour = Tour.parse(json('worlds/shopfloor/tour.json'));
const investigation = Investigation.parse(json('worlds/shopfloor/incidents/payment-failed.investigation.json'));
const recording = Recording.parse(json('worlds/shopfloor/recordings/payment-failed.recording.json'));
const incident = { id: 'payment-failed', title: 'Payment failed during checkout', investigation, recording, grounding: ground(investigation, graph) };
const world: LoadedWorld = {
  entry: { id: 'shopfloor', title: 'Shopfloor', description: '', graph: 'g.json', incidents: [], recordings: [], synthetic: false },
  graph,
  layout: layoutCity(graph),
  semantic,
  semanticGrounding: ground(semantic, graph),
  tour,
  tourGrounding: ground(tour, graph),
  incidents: [incident],
  recordings: [],
};
const F = (p: string) => `demo/shopfloor/${p}`;

describe('click anything, understand it', () => {
  it("explains a district in Bob's words, with its files and neighbours", () => {
    const e = explainNode(world, 'svc:payment')!;
    expect(e.title).toBe('Payment');
    expect(e.summary?.source).toBe('bob-scan');
    expect(e.summary?.text).toMatch(/card token/);
    expect(e.files?.map((f) => f.label)).toContain('payment.service.ts');
    expect(e.links.some((l) => l.name === 'Customer' && l.dir === 'out')).toBe(true);
  });

  it("explains a file with Bob's incident note and what it calls", () => {
    const e = explainNode(world, F('src/payment/payment.service.ts'))!;
    expect(e.subtitle).toMatch(/^Payment · \d+ lines$/);
    expect(e.incident?.failed).toBe(true);
    expect(e.incident?.note).toMatch(/billing is null/);
    expect(e.links.some((l) => l.id === F('src/customer/customer.service.ts'))).toBe(true);
    expect(e.code?.file).toBe(F('src/payment/payment.service.ts'));
  });

  it('explains routes and the datastore', () => {
    const r = explainNode(world, 'route:POST /checkout')!;
    expect(r.kind).toBe('route');
    expect(r.summary?.text).toMatch(/checkout/i);
    const d = explainNode(world, graph.nodes.find((n) => n.kind === 'database')!.id)!;
    expect(d.title).toBe('Datastore');
    expect(d.links.length).toBeGreaterThan(0);
    expect(nodeName(world, 'svc:customer')).toBe('Customer');
  });
});

describe('follow a request', () => {
  const flows = requestFlows(world);
  it("offers Bob's scanned flows and the incident's failing request", () => {
    expect(flows.map((f) => f.id)).toEqual(['checkout', 'password-login', 'incident:payment-failed']);
    const checkout = flows[0]!;
    expect(checkout.hops.length).toBe(8);
    expect(checkout.hops[0]!.sentence).toBe('Inside Gateway, server.ts calls authenticate() in middleware.ts.');
    expect(checkout.hops.find((h) => h.via === 'CustomerService.getBillingProfile')?.sentence).toBe('Payment calls Customer: CustomerService.getBillingProfile().');
  });
  it("marks where the incident's request fails, in Bob's words", () => {
    const inc = flows[2]!;
    expect(inc.incident).toBe(true);
    const fail = inc.hops.find((h) => h.status === 'failed')!;
    expect(fail.sentence).toMatch(/TypeError/);
  });
});

describe('impact numbers', () => {
  it('uses only real values from the data', () => {
    const f = impactFacts(world, incident, { ref: 'main', testsPassed: 6, testsFailed: 1 });
    expect(f.filesInCodebase).toBe(graph.project.fileCount);
    expect(f.filesBobRead).toBeGreaterThan(3);
    expect(f.filesBobRead).toBeLessThan(f.filesInCodebase);
    expect(f.subagents).toBe(6);
    expect(f.hypothesesRuledOut).toBe(investigation.ruledOut.length);
    expect(f.rootCauseAtMs).toBe(68_686);
    expect(f.runMs).toBe(490_111);
    expect(f.toolCalls).toBe(38);
    expect(f.bobcoins).toBeCloseTo(2.8, 2);
    expect(f.fixLinesChanged).toBe(1);
    expect(f.testsBefore).toEqual({ passed: 6, failed: 1, ref: 'main' });
    expect(f.testsAfter).toEqual({ passed: 7, failed: 0 });
  });
});

describe('deep links', () => {
  it('round-trips chapter, moment, node and flow', () => {
    const s = { chapter: 'investigate' as const, moment: 'rootcause' as const, node: F('src/payment/payment.service.ts') };
    expect(parseLink(linkSearch(s))).toEqual(s);
    expect(parseLink(linkSearch({ chapter: 'explore', flow: 'checkout', step: 3 }))).toEqual({ chapter: 'explore', flow: 'checkout', step: 3 });
    expect(parseLink('?story=1')).toEqual({ story: true });
  });
  it('rejects unknown values and keeps old links working', () => {
    expect(parseLink('?c=admin&m=x&n=<script>')).toEqual({});
    expect(parseLink('?c=explore&m=rootcause')).toEqual({ chapter: 'explore' });
    expect(parseLink('?mode=incident').chapter).toBe('investigate');
  });
});

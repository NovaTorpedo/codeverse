import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '@codeverse/analyzer';
import { Investigation, SemanticLayer, Tour } from '@codeverse/schema';
import { citationStatus, ground } from '../src';

const repoRoot = path.resolve(__dirname, '../../..');
const graph = analyze({ repoRoot, target: 'demo/shopfloor' });
const load = (f: string) => JSON.parse(readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'));

describe('ground(investigation)', () => {
  const doc = Investigation.parse(load('shopfloor.investigation.synthetic.json'));
  const r = ground(doc, graph);

  it('verifies real citations and flags the phantom one', () => {
    const phantom = r.claims.find((c) => c.citation?.file.endsWith('billing.cache.ts'));
    expect(phantom?.status).toBe('unverified');
    expect(phantom?.nodes).toEqual([]);
    expect(citationStatus(r, { file: 'demo/shopfloor/src/auth/session.store.ts', line: 16, symbol: 'SessionStore.create' })).toBe('grounded');
  });

  it('checks the execution path against static edges', () => {
    const edge = r.claims.find((c) => c.kind === 'edge' && c.label === 'Payment → Customer');
    expect(edge?.status).toBe('grounded');
  });

  it('verifies the proposed diff against the current source', () => {
    const diffs = r.claims.filter((c) => c.kind === 'diff');
    expect(diffs.length).toBe(2);
    expect(diffs.every((d) => d.status === 'grounded')).toBe(true);
  });

  it('accepts citations to log assets', () => {
    expect(r.claims.find((c) => c.citation?.file.endsWith('.ndjson'))?.status).toBe('grounded');
  });

  it('scores between 0 and 1 and counts every claim', () => {
    expect(r.total).toBe(r.grounded + r.weak + r.unverified);
    expect(r.score).toBeGreaterThan(0.8);
    expect(r.score).toBeLessThan(1);
  });

  it('flags out-of-range lines and mismatched symbols', () => {
    const bad = ground({ ...doc, rootCause: { ...doc.rootCause, citations: [{ file: 'demo/shopfloor/src/auth/auth.service.ts', line: 999 }, { file: 'demo/shopfloor/src/auth/auth.service.ts', symbol: 'AuthService.nope' }] } }, graph);
    const [a, b] = bad.claims;
    expect(a?.status).toBe('unverified');
    expect(b?.status).toBe('weak');
  });
});

describe('ground(semantic, tour)', () => {
  it('flags phantom services', () => {
    const r = ground(SemanticLayer.parse(load('shopfloor.semantic.synthetic.json')), graph);
    expect(r.claims.find((c) => c.label === 'Service Ledger')?.status).toBe('unverified');
    expect(r.claims.find((c) => c.label === 'Service Payment')?.status).toBe('grounded');
  });
  it('resolves tour stops to nodes', () => {
    const r = ground(Tour.parse(load('shopfloor.tour.synthetic.json')), graph);
    expect(r.claims.filter((c) => c.kind === 'node').every((c) => c.status === 'grounded')).toBe(true);
  });
});

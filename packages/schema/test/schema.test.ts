import { describe, expect, it } from 'vitest';
import { Citation, Investigation, parseDocument, RelPath } from '../src';

const baseInvestigation = {
  schemaVersion: 1,
  kind: 'codeverse.investigation',
  synthetic: true,
  generatedBy: { tool: 'codeverse-synthetic', client: 'fixture' },
  target: 'demo/shopfloor',
  symptom: 'Payment failed during checkout',
  summary: 'x',
  rootCause: { title: 't', explanation: 'e', citations: [{ file: 'demo/shopfloor/src/a.ts', line: 3 }] },
  executionPath: [
    { id: 's1', label: 'Cart', file: 'demo/shopfloor/src/cart.ts', status: 'ok' },
    { id: 's2', label: 'Payment', file: 'demo/shopfloor/src/payment.ts', status: 'failed' },
  ],
  failure: { stepId: 's2', errorType: 'TypeError', message: 'null', citations: [{ file: 'demo/shopfloor/src/payment.ts' }] },
};

describe('RelPath', () => {
  it.each(['/etc/passwd', 'C:/Users/x/file.ts', 'a/../../b', 'a\\b.ts'])('rejects %s', (p) => {
    expect(RelPath.safeParse(p).success).toBe(false);
  });
  it('accepts repo-relative paths', () => {
    expect(RelPath.safeParse('demo/shopfloor/src/services/payment/charge.ts').success).toBe(true);
  });
});

describe('Citation', () => {
  it('requires positive lines', () => {
    expect(Citation.safeParse({ file: 'a.ts', line: 0 }).success).toBe(false);
    expect(Citation.safeParse({ file: 'a.ts', line: 12, symbol: 'charge' }).success).toBe(true);
  });
});

describe('Investigation', () => {
  it('parses a minimal document and applies defaults', () => {
    const doc = Investigation.parse(baseInvestigation);
    expect(doc.evidence).toEqual([]);
    expect(doc.ruledOut).toEqual([]);
  });
  it('rejects a path with fewer than two steps', () => {
    expect(Investigation.safeParse({ ...baseInvestigation, executionPath: [baseInvestigation.executionPath[0]] }).success).toBe(false);
  });
});

describe('parseDocument', () => {
  it('dispatches on kind', () => {
    const res = parseDocument(JSON.stringify(baseInvestigation));
    expect(res.ok && res.value.kind).toBe('codeverse.investigation');
  });
  it('rejects oversized input before parsing', () => {
    const res = parseDocument('x'.repeat(2000), 1000);
    expect(res.ok).toBe(false);
  });
  it('rejects non-JSON and unknown kinds', () => {
    expect(parseDocument('{nope').ok).toBe(false);
    expect(parseDocument(JSON.stringify({ kind: 'evil' })).ok).toBe(false);
  });
  it('does not execute prototype-polluting keys', () => {
    const res = parseDocument('{"__proto__":{"polluted":true},"kind":"codeverse.tour"}');
    expect(res.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

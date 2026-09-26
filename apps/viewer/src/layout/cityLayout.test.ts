import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '@codeverse/analyzer';
import { layoutCity } from './cityLayout';

const repoRoot = path.resolve(__dirname, '../../../..');
const graph = analyze({ repoRoot, target: 'demo/shopfloor', includeSources: false });

describe('layoutCity', () => {
  const a = layoutCity(graph);

  it('is deterministic', () => {
    const b = layoutCity(graph);
    expect(b.districts.map((d) => [d.id, d.x.toFixed(4), d.z.toFixed(4)])).toEqual(a.districts.map((d) => [d.id, d.x.toFixed(4), d.z.toFixed(4)]));
  });

  it('places every file building inside its district', () => {
    for (const b of a.buildings) {
      const d = a.districts.find((x) => x.id === b.district)!;
      expect(Math.hypot(b.x - d.x, b.z - d.z)).toBeLessThanOrEqual(d.r + 0.01);
    }
    expect(a.buildings.length).toBe(graph.nodes.filter((n) => n.kind === 'file').length);
  });

  it('keeps districts from overlapping', () => {
    for (let i = 0; i < a.districts.length; i++) {
      for (let j = i + 1; j < a.districts.length; j++) {
        const p = a.districts[i]!;
        const q = a.districts[j]!;
        expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(p.r + q.r);
      }
    }
  });

  it('anchors routes, datastores and files', () => {
    expect(a.gateways.length).toBe(5);
    expect(a.cores.length).toBe(1);
    expect(a.anchor('demo/shopfloor/src/payment/payment.service.ts')?.y).toBeGreaterThan(0);
    expect(a.anchor('route:POST /checkout')).toBeDefined();
    expect(a.anchor('nope')).toBeUndefined();
  });

  it('scales to ~500 nodes quickly', () => {
    const big = structuredClone(graph);
    for (let i = 0; i < 480; i++) {
      big.nodes.push({ ...big.nodes.find((n) => n.kind === 'file')!, id: `synthetic/f${i}.ts`, path: `synthetic/f${i}.ts`, service: `svc:${['cart', 'payment', 'auth', 'gateway'][i % 4]}` });
    }
    const t0 = performance.now();
    const l = layoutCity(big);
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(l.buildings.length).toBeGreaterThan(490);
  });
});

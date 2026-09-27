import { describe, expect, it } from 'vitest';
import { resolveNodeId } from './nodeIds';

const ids = new Set(['svc:gateway', 'svc:packages/schema', 'demo/shopfloor/src/gateway/server.ts']);

describe('resolveNodeId', () => {
  it('keeps ids that exist', () => {
    expect(resolveNodeId(ids, 'svc:gateway')).toBe('svc:gateway');
    expect(resolveNodeId(ids, 'demo/shopfloor/src/gateway/server.ts')).toBe('demo/shopfloor/src/gateway/server.ts');
  });

  it('maps a service id written as a path to its district', () => {
    expect(resolveNodeId(ids, 'svc:demo/shopfloor/src/gateway')).toBe('svc:gateway');
    expect(resolveNodeId(ids, 'svc:demo/shopfloor/src/gateway/')).toBe('svc:gateway');
    expect(resolveNodeId(ids, 'svc:repo/packages/schema')).toBe('svc:packages/schema');
  });

  it('leaves unknown ids unchanged', () => {
    expect(resolveNodeId(ids, 'svc:nowhere')).toBe('svc:nowhere');
    expect(resolveNodeId(ids, 'missing.ts')).toBe('missing.ts');
  });
});

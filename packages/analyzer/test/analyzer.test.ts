import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AnalysisGraph } from '@codeverse/schema';
import { analyze, countLoc, parseSource, serviceOf } from '../src';

const repoRoot = path.resolve(__dirname, '../../..');
const shop = () => analyze({ repoRoot, target: 'demo/shopfloor', name: 'shopfloor' });
const P = (p: string) => `demo/shopfloor/${p}`;

describe('analyze(demo/shopfloor)', () => {
  const g = shop();

  it('produces a schema-valid graph', () => {
    expect(AnalysisGraph.safeParse(g).success).toBe(true);
  });

  it('is deterministic across runs', () => {
    expect(JSON.stringify(shop())).toBe(JSON.stringify(g));
  });

  it('groups files into service districts', () => {
    const services = g.nodes.filter((n) => n.kind === 'service').map((n) => n.id);
    expect(services).toEqual(expect.arrayContaining(['svc:auth', 'svc:cart', 'svc:checkout', 'svc:customer', 'svc:payment', 'svc:gateway', 'svc:db']));
    expect(g.nodes.find((n) => n.id === P('src/payment/payment.service.ts'))?.service).toBe('svc:payment');
  });

  it('detects HTTP routes as gateway nodes', () => {
    const routes = g.nodes.filter((n) => n.kind === 'route').map((n) => n.label);
    expect(routes).toEqual(['GET /cart', 'POST /auth/login', 'POST /auth/sso/callback', 'POST /cart/items', 'POST /checkout']);
  });

  it('proves call edges through typed instance properties', () => {
    const e = g.edges.find((x) => x.kind === 'calls' && x.source === P('src/payment/payment.service.ts') && x.target === P('src/customer/customer.service.ts'));
    expect(e?.symbols).toContain('CustomerService.getBillingProfile');
  });

  it('proves call edges through typed function parameters', () => {
    const e = g.edges.find((x) => x.kind === 'calls' && x.source === P('src/gateway/middleware.ts') && x.target === P('src/customer/customer.service.ts'));
    expect(e?.symbols).toContain('CustomerService.loadProfile');
  });

  it('finds the datastore and its users', () => {
    const db = g.nodes.find((n) => n.kind === 'database');
    expect(db?.id).toBe(`db:${P('src/db/client.ts')}`);
    const users = g.edges.filter((e) => e.kind === 'uses-db').map((e) => e.source);
    expect(users).toContain(P('src/customer/profile.repository.ts'));
  });

  it('records symbols with line ranges', () => {
    const f = g.nodes.find((n) => n.id === P('src/customer/customer.service.ts'));
    const sym = f?.symbols.find((s) => s.name === 'CustomerService.getBillingProfile');
    expect(sym?.line).toBeGreaterThan(1);
    expect(sym!.endLine).toBeGreaterThan(sym!.line);
    expect(g.sources?.[P('src/customer/customer.service.ts')]).toContain('getBillingProfile');
  });

  it('never analyses local-only folders', () => {
    const self = analyze({ repoRoot, target: '.', includeSources: false });
    expect(self.nodes.some((n) => n.path?.startsWith('private/') || n.path?.startsWith('node_modules/'))).toBe(false);
  });
});

describe('serviceOf', () => {
  it.each([
    ['src/payment/payment.service.ts', 'payment'],
    ['packages/schema/src/index.ts', 'packages/schema'],
    ['test/checkout.test.ts', 'tests'],
    ['packages/bridge/test/guards.test.ts', 'packages/bridge'],
    ['vitest.config.ts', 'root'],
  ])('%s -> %s', (p, s) => expect(serviceOf(p)).toBe(s));
});

describe('parseSource', () => {
  it('extracts imports, re-exports, requires and dynamic imports', () => {
    const p = parseSource('x.ts', "import a, { b as c } from './a';\nexport * from './b';\nconst d = require('./d');\nconst e = await import('./e');\n");
    expect(p.imports.map((i) => i.specifier)).toEqual(['./a', './b', './d', './e']);
    expect(p.imports[0]?.bindings).toEqual([{ local: 'a', imported: 'default' }, { local: 'c', imported: 'b' }]);
  });
  it('counts code lines, not comments or blanks', () => {
    expect(countLoc('// c\n\n/* a\n b */\nconst x = 1;\n')).toBe(1);
  });
});

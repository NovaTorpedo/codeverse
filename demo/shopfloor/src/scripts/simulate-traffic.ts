import { createShopfloor } from '../gateway/server';
import { setLogClock, setLogSink } from '../shared/logger';

// Replays a short burst of storefront traffic and prints structured logs as NDJSON.
const start = Date.parse('2026-09-24T14:02:11.000Z');
let tick = 0;
setLogClock(() => new Date(start + (tick += 37)));
const toDeployPath = (text: string) => text.split(JSON.stringify(process.cwd()).slice(1, -1)).join('/app').split('\\\\').join('/');
setLogSink((r) => process.stdout.write(toDeployPath(JSON.stringify(r)) + '\n'));

const shop = await createShopfloor({
  pspLatencyMs: (attempt) => (tick < 900 && attempt === 1 ? 1840 : 150),
  smtpHealthy: () => tick < 700,
});

async function session(kind: 'password' | 'sso', id: string): Promise<Record<string, string>> {
  const res =
    kind === 'password'
      ? await shop.handle({ method: 'POST', path: '/auth/login', headers: { 'x-request-id': `${id}-login` }, body: { email: 'ada@example.test', password: 'correct horse' } })
      : await shop.handle({ method: 'POST', path: '/auth/sso/callback', headers: { 'x-request-id': `${id}-login` }, body: { issuer: 'https://acme.example.test', subject: 'grace', email: 'grace@example.test' } });
  return { cookie: `sid=${(res.body as { sessionId: string }).sessionId}` };
}

const ada = await session('password', 'a1f09c2e');
await shop.handle({ method: 'POST', path: '/cart/items', headers: { ...ada, 'x-request-id': 'a1f09c2e-add' }, body: { sku: 'sku_mse_02', quantity: 1 } });
await shop.handle({ method: 'POST', path: '/checkout', headers: { ...ada, 'x-request-id': 'a1f09c2e-checkout' } });

const grace = await session('sso', '7c4be913');
await shop.handle({ method: 'GET', path: '/cart', headers: { ...grace, 'x-request-id': '7c4be913-cart' } });
await shop.handle({ method: 'POST', path: '/cart/items', headers: { ...grace, 'x-request-id': '7c4be913-add' }, body: { sku: 'sku_kbd_01', quantity: 1 } });
await shop.handle({ method: 'POST', path: '/checkout', headers: { ...grace, 'x-request-id': '7c4be913-checkout' } });

import { beforeEach, describe, expect, it } from 'vitest';
import { createShopfloor } from '../src/gateway/server';
import { toMinorUnits } from '../src/payment/payment.service';
import { setLogSink, type LogRecord } from '../src/shared/logger';

let logs: LogRecord[] = [];
beforeEach(() => {
  logs = [];
  setLogSink((r) => logs.push(r));
});

async function signIn(shop: Awaited<ReturnType<typeof createShopfloor>>, method: 'password' | 'sso'): Promise<string> {
  const res =
    method === 'password'
      ? await shop.handle({ method: 'POST', path: '/auth/login', headers: {}, body: { email: 'ada@example.test', password: 'correct horse' } })
      : await shop.handle({ method: 'POST', path: '/auth/sso/callback', headers: {}, body: { issuer: 'https://acme.example.test', subject: 'grace', email: 'grace@example.test' } });
  expect(res.status).toBe(200);
  return (res.body as { sessionId: string }).sessionId;
}

async function addAndCheckout(shop: Awaited<ReturnType<typeof createShopfloor>>, sid: string) {
  const headers = { cookie: `sid=${sid}` };
  const add = await shop.handle({ method: 'POST', path: '/cart/items', headers, body: { sku: 'sku_kbd_01', quantity: 1 } });
  expect(add.status).toBe(201);
  return shop.handle({ method: 'POST', path: '/checkout', headers });
}

describe('checkout', () => {
  it('confirms an order for a password-authenticated customer', async () => {
    const shop = await createShopfloor();
    const res = await addAndCheckout(shop, await signIn(shop, 'password'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'confirmed', total: 129 });
  });

  it('confirms an order for an SSO-authenticated customer', async () => {
    const shop = await createShopfloor();
    const res = await addAndCheckout(shop, await signIn(shop, 'sso'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'confirmed', customerId: 'cus_2002' });
  });

  it('rejects checkout without a session', async () => {
    const shop = await createShopfloor();
    const res = await shop.handle({ method: 'POST', path: '/checkout', headers: {} });
    expect(res.status).toBe(401);
  });

  it('returns 409 when stock runs out', async () => {
    const shop = await createShopfloor();
    const headers = { cookie: `sid=${await signIn(shop, 'password')}` };
    await shop.handle({ method: 'POST', path: '/cart/items', headers, body: { sku: 'sku_mse_02', quantity: 4 } });
    const res = await shop.handle({ method: 'POST', path: '/checkout', headers });
    expect(res.status).toBe(409);
  });

  it('recovers from a single processor timeout', async () => {
    const shop = await createShopfloor({ pspLatencyMs: (attempt) => (attempt === 1 ? 1800 : 140) });
    const res = await addAndCheckout(shop, await signIn(shop, 'password'));
    expect(res.status).toBe(201);
    expect(logs.some((l) => l.event === 'psp.timeout')).toBe(true);
  });
});

describe('toMinorUnits', () => {
  it('converts decimal currencies to cents', () => {
    expect(toMinorUnits(129, 'EUR')).toBe(12900);
    expect(toMinorUnits(12.99, 'GBP')).toBe(1299);
  });
  it('keeps zero-decimal currencies whole', () => {
    expect(toMinorUnits(1500, 'JPY')).toBe(1500);
  });
});

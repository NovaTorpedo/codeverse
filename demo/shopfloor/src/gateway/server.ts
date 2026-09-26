import { AuthService } from '../auth/auth.service';
import { SessionStore } from '../auth/session.store';
import { CartService } from '../cart/cart.service';
import { CheckoutService } from '../checkout/checkout.service';
import { CustomerService } from '../customer/customer.service';
import { ProfileRepository } from '../customer/profile.repository';
import { DbClient } from '../db/client';
import { seed } from '../db/seed';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationService } from '../notifications/notification.service';
import { CardGatewayClient } from '../payment/card-gateway.client';
import { PaymentService } from '../payment/payment.service';
import { HttpError } from '../shared/errors';
import { createLogger } from '../shared/logger';
import type { Request, Response } from '../shared/types';
import { assignRequestId, authenticate } from './middleware';
import { Router } from './router';

const log = createLogger('gateway');

export interface ShopfloorOptions {
  pspLatencyMs?: (attempt: number) => number;
  smtpHealthy?: () => boolean;
}

export async function createShopfloor(options: ShopfloorOptions = {}) {
  const db = new DbClient();
  await seed(db);
  const sessions = new SessionStore();
  const customers = new CustomerService(new ProfileRepository(db));
  const auth = new AuthService(db, sessions, customers);
  const carts = new CartService(db);
  const inventory = new InventoryService(db);
  const notifications = new NotificationService(options.smtpHealthy);
  const payments = new PaymentService(customers, new CardGatewayClient(options.pspLatencyMs));
  const checkout = new CheckoutService(carts, inventory, payments, notifications);

  const router = new Router()
    .post('/auth/login', async (req) => {
      const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
      const session = await auth.loginWithPassword(String(email), String(password), req.requestId);
      return { status: 200, body: { sessionId: session.id } };
    })
    .post('/auth/sso/callback', async (req) => {
      const assertion = req.body as { issuer: string; subject: string; email: string };
      const session = await auth.loginWithSso(assertion, req.requestId);
      return { status: 200, body: { sessionId: session.id } };
    })
    .get('/cart', async (req) => {
      const session = await authenticate(req, auth, customers);
      return { status: 200, body: carts.get(session.customerId) };
    })
    .post('/cart/items', async (req) => {
      const session = await authenticate(req, auth, customers);
      const { sku, quantity } = (req.body ?? {}) as { sku: string; quantity: number };
      return { status: 201, body: await carts.addItem(session.customerId, sku, quantity) };
    })
    .post('/checkout', async (req) => {
      const session = await authenticate(req, auth, customers);
      const order = await checkout.placeOrder(session, req.requestId);
      return { status: 201, body: order };
    });

  async function handle(req: Request): Promise<Response> {
    const requestId = assignRequestId(req);
    const started = Date.now();
    const route = router.match(req);
    if (!route) return { status: 404, body: { error: 'not_found' } };
    try {
      const res = await route.handler(req, route.params);
      log.info('http.request', { requestId, method: req.method, path: req.path, status: res.status, durationMs: Date.now() - started });
      return res;
    } catch (err) {
      if (err instanceof HttpError) {
        log.warn('http.request', { requestId, method: req.method, path: req.path, status: err.status, code: err.code });
        return { status: err.status, body: { error: err.code, message: err.message } };
      }
      log.error('http.unhandled_error', {
        requestId,
        method: req.method,
        path: req.path,
        status: 500,
        error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        stack: err instanceof Error ? err.stack?.split('\n').slice(0, 4).join(' | ') : undefined,
      });
      return { status: 500, body: { error: 'internal_error', requestId } };
    }
  }

  return { handle, notifications };
}

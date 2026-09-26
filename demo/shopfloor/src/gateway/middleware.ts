import { randomUUID } from 'node:crypto';
import type { AuthService } from '../auth/auth.service';
import type { CustomerService } from '../customer/customer.service';
import { createLogger } from '../shared/logger';
import type { Request, Session } from '../shared/types';

const log = createLogger('gateway');

export function assignRequestId(req: Request): string {
  const incoming = req.headers['x-request-id'];
  req.requestId = incoming && /^[a-zA-Z0-9-]{8,64}$/.test(incoming) ? incoming : `req_${randomUUID().slice(0, 8)}`;
  return req.requestId;
}

/**
 * Resolves the session from the cookie and lazily hydrates the customer profile
 * for sessions that were created without one.
 */
export async function authenticate(req: Request, auth: AuthService, customers: CustomerService): Promise<Session> {
  const session = auth.resolveSession(readSessionCookie(req));
  if (session.customer === undefined) {
    session.customer = await customers.loadProfile(session.customerId);
    log.debug('gateway.session_hydrated', { requestId: req.requestId, sessionId: session.id });
  }
  return session;
}

function readSessionCookie(req: Request): string | undefined {
  const cookie = req.headers.cookie ?? '';
  const match = /(?:^|;\s*)sid=([^;]+)/.exec(cookie);
  return match?.[1];
}

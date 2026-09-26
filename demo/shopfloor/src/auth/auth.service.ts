import type { DbClient } from '../db/client';
import type { UserRecord } from '../db/seed';
import type { CustomerService } from '../customer/customer.service';
import { UnauthorizedError } from '../shared/errors';
import { createLogger } from '../shared/logger';
import type { Session } from '../shared/types';
import type { SessionStore } from './session.store';

const log = createLogger('auth');

export interface SsoAssertion {
  issuer: string;
  subject: string;
  email: string;
}

export class AuthService {
  constructor(
    private readonly db: DbClient,
    private readonly sessions: SessionStore,
    private readonly customers: CustomerService,
  ) {}

  async loginWithPassword(email: string, password: string, requestId?: string): Promise<Session> {
    const user = await this.db.findOne<UserRecord>('users', { email });
    if (!user || user.passwordHash !== fakeHash(password)) {
      log.warn('auth.login_failed', { requestId, method: 'password' });
      throw new UnauthorizedError('Invalid email or password');
    }
    const session = this.sessions.create({ userId: user.id, customerId: user.customerId, method: 'password' });
    session.customer = await this.customers.loadProfile(user.customerId);
    this.sessions.save(session);
    log.info('auth.login_succeeded', { requestId, method: 'password', userId: user.id, sessionId: session.id });
    return session;
  }

  /**
   * Single sign-on login (added in 0.4.0). The profile is hydrated lazily by the
   * gateway's session middleware on the first authenticated request.
   */
  async loginWithSso(assertion: SsoAssertion, requestId?: string): Promise<Session> {
    if (!assertion.issuer.startsWith('https://')) throw new UnauthorizedError('Untrusted SSO issuer');
    const user = await this.db.findOne<UserRecord>('users', { ssoSubject: `${issuerSlug(assertion.issuer)}|${assertion.subject}` });
    if (!user) {
      log.warn('auth.login_failed', { requestId, method: 'sso', issuer: assertion.issuer });
      throw new UnauthorizedError('No account linked to this SSO identity');
    }
    const session = this.sessions.create({ userId: user.id, customerId: user.customerId, method: 'sso' });
    log.info('auth.login_succeeded', { requestId, method: 'sso', userId: user.id, sessionId: session.id });
    return session;
  }

  resolveSession(sessionId: string | undefined): Session {
    const session = this.sessions.get(sessionId);
    if (!session) throw new UnauthorizedError();
    return session;
  }
}

function issuerSlug(issuer: string): string {
  return new URL(issuer).hostname.split('.')[0] ?? issuer;
}

/** Demo-only stand-in for a password hash check. */
export function fakeHash(password: string): string {
  const table: Record<string, string> = { 'correct horse': 'sha256:9f2c', 'battery staple': 'sha256:1b7e' };
  return table[password] ?? 'sha256:0000';
}

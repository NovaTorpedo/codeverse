import { randomUUID } from 'node:crypto';
import type { LoginMethod, Session } from '../shared/types';

const SESSION_TTL_MS = 30 * 60 * 1000;

export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  create(input: { userId: string; customerId: string; method: LoginMethod }): Session {
    const session: Session = {
      id: `sess_${randomUUID().slice(0, 12)}`,
      userId: input.userId,
      customerId: input.customerId,
      method: input.method,
      createdAt: Date.now(),
      customer: null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string | undefined): Session | undefined {
    if (!id) return undefined;
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  save(session: Session): void {
    this.sessions.set(session.id, session);
  }
}

import { createLogger } from '../shared/logger';
import type { BillingProfile, CustomerProfile, Session } from '../shared/types';
import type { ProfileRepository } from './profile.repository';

const log = createLogger('customer');

export class CustomerService {
  private readonly cache = new Map<string, CustomerProfile>();

  constructor(private readonly profiles: ProfileRepository) {}

  async loadProfile(customerId: string): Promise<CustomerProfile | null> {
    const cached = this.cache.get(customerId);
    if (cached) return cached;
    const profile = await this.profiles.byId(customerId);
    if (profile) this.cache.set(customerId, profile);
    log.debug('customer.profile_loaded', { customerId, found: Boolean(profile) });
    return profile;
  }

  /**
   * Billing details for the signed-in customer. Reads from the hydrated session
   * first and falls back to the warm profile cache.
   */
  getBillingProfile(session: Session): BillingProfile | null {
    if (session.customer) return session.customer.billing;
    const cached = this.cache.get(session.customerId);
    if (!cached) {
      log.warn('customer.billing_profile_missing', { customerId: session.customerId, sessionMethod: session.method });
      return null;
    }
    return cached.billing;
  }
}

import type { DbClient } from '../db/client';
import type { CustomerProfile } from '../shared/types';

export class ProfileRepository {
  constructor(private readonly db: DbClient) {}

  async byId(customerId: string): Promise<CustomerProfile | null> {
    return this.db.findById<CustomerProfile>('customer_profiles', customerId);
  }

  async updateLoyaltyTier(customerId: string, tier: CustomerProfile['loyaltyTier']): Promise<void> {
    await this.db.update('customer_profiles', customerId, { loyaltyTier: tier });
  }
}

import type { CustomerProfile } from '../shared/types';
import type { DbClient } from './client';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  customerId: string;
  ssoSubject?: string;
}

export interface StockRecord {
  id: string;
  name: string;
  available: number;
  unitPrice: number;
}

export const USERS: UserRecord[] = [
  { id: 'usr_1001', email: 'ada@example.test', passwordHash: 'sha256:9f2c', customerId: 'cus_2001' },
  { id: 'usr_1002', email: 'grace@example.test', passwordHash: 'sha256:1b7e', customerId: 'cus_2002', ssoSubject: 'acme|grace' },
];

export const PROFILES: CustomerProfile[] = [
  {
    id: 'cus_2001',
    email: 'ada@example.test',
    displayName: 'Ada',
    loyaltyTier: 'gold',
    billing: {
      defaultCardToken: 'tok_visa_4242',
      billingAddress: { line1: '1 Analytical Way', city: 'London', postcode: 'N1 9GU', country: 'GB' },
      currency: 'GBP',
    },
  },
  {
    id: 'cus_2002',
    email: 'grace@example.test',
    displayName: 'Grace',
    loyaltyTier: 'silver',
    billing: {
      defaultCardToken: 'tok_mc_5454',
      billingAddress: { line1: '7 Compiler Street', city: 'Dublin', postcode: 'D02 X285', country: 'IE' },
      currency: 'EUR',
    },
  },
];

export const STOCK: StockRecord[] = [
  { id: 'sku_kbd_01', name: 'Mechanical keyboard', available: 42, unitPrice: 129.0 },
  { id: 'sku_mse_02', name: 'Wireless mouse', available: 3, unitPrice: 49.5 },
  { id: 'sku_cbl_03', name: 'USB-C cable', available: 310, unitPrice: 12.99 },
];

export async function seed(db: DbClient): Promise<void> {
  for (const u of USERS) await db.upsert('users', { ...u });
  for (const p of PROFILES) await db.upsert('customer_profiles', { ...p });
  for (const s of STOCK) await db.upsert('stock', { ...s });
}

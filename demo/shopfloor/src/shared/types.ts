export interface Address {
  line1: string;
  city: string;
  postcode: string;
  country: string;
}

export interface BillingProfile {
  defaultCardToken: string;
  billingAddress: Address;
  currency: 'EUR' | 'GBP' | 'USD';
}

export interface CustomerProfile {
  id: string;
  email: string;
  displayName: string;
  loyaltyTier: 'none' | 'silver' | 'gold';
  billing: BillingProfile;
}

export type LoginMethod = 'password' | 'sso';

export interface Session {
  id: string;
  userId: string;
  customerId: string;
  method: LoginMethod;
  createdAt: number;
  /** Hydrated customer profile. Stored sessions start with `null` so they serialise cleanly. */
  customer?: CustomerProfile | null;
}

export interface CartLine {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Cart {
  id: string;
  customerId: string;
  lines: CartLine[];
  currency: BillingProfile['currency'];
}

export interface Order {
  id: string;
  customerId: string;
  total: number;
  currency: string;
  chargeId: string;
  status: 'confirmed';
}

export interface Request {
  method: 'GET' | 'POST';
  path: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
  requestId?: string;
}

export interface Response {
  status: number;
  body: unknown;
}

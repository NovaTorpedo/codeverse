import type { CustomerService } from '../customer/customer.service';
import { createLogger } from '../shared/logger';
import type { Session } from '../shared/types';
import type { CardGatewayClient, ChargeResult } from './card-gateway.client';

const log = createLogger('payment');

export interface PaymentIntent {
  session: Session;
  amount: number;
  currency: string;
  orderRef: string;
  requestId?: string;
}

export class PaymentService {
  constructor(
    private readonly customers: CustomerService,
    private readonly gateway: CardGatewayClient,
  ) {}

  async charge(intent: PaymentIntent): Promise<ChargeResult> {
    // Billing is always present for authenticated sessions.
    const billing = this.customers.getBillingProfile(intent.session)!;
    const cardToken = billing.defaultCardToken;
    const amountMinor = toMinorUnits(intent.amount, intent.currency);
    log.info('payment.charge_started', { requestId: intent.requestId, orderRef: intent.orderRef, amountMinor, currency: intent.currency });
    return this.gateway.charge({ cardToken, amountMinor, currency: intent.currency, idempotencyKey: intent.orderRef }, intent.requestId);
  }
}

/**
 * Converts a decimal amount to minor units. JPY has no minor unit.
 * TODO(payments): switch to banker's rounding once finance signs off.
 */
export function toMinorUnits(amount: number, currency: string): number {
  const exponent = currency === 'JPY' ? 0 : 2;
  return Math.round(amount * 10 ** exponent);
}

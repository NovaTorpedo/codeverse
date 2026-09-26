import { PaymentDeclinedError } from '../shared/errors';
import { createLogger } from '../shared/logger';

const log = createLogger('payment.psp');

export interface ChargeRequest {
  cardToken: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
}

export interface ChargeResult {
  chargeId: string;
  status: 'succeeded';
}

const TIMEOUT_MS = 1500;
const MAX_ATTEMPTS = 2;

/** Client for the external card processor (simulated). Retries once on timeout. */
export class CardGatewayClient {
  constructor(private readonly latencyMs: (attempt: number) => number = () => 120) {}

  async charge(req: ChargeRequest, requestId?: string): Promise<ChargeResult> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const latency = this.latencyMs(attempt);
      if (latency > TIMEOUT_MS) {
        log.warn('psp.timeout', { requestId, attempt, latencyMs: latency, idempotencyKey: req.idempotencyKey });
        continue;
      }
      if (req.cardToken.startsWith('tok_declined')) throw new PaymentDeclinedError('card_declined');
      log.info('psp.charge_succeeded', { requestId, attempt, latencyMs: latency, amountMinor: req.amountMinor, currency: req.currency });
      return { chargeId: `ch_${req.idempotencyKey.slice(-8)}`, status: 'succeeded' };
    }
    throw new PaymentDeclinedError('processor_unavailable');
  }
}

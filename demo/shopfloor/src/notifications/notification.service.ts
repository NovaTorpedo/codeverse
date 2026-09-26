import { createLogger } from '../shared/logger';
import type { Order } from '../shared/types';

const log = createLogger('notifications');

export interface OutboundEmail {
  to: string;
  template: 'order-confirmation' | 'payment-failed';
  data: Record<string, unknown>;
}

/** Queues transactional email. Delivery happens out of band, so failures never block checkout. */
export class NotificationService {
  readonly outbox: OutboundEmail[] = [];

  constructor(private readonly smtpHealthy: () => boolean = () => true) {}

  async orderConfirmed(order: Order, email: string, requestId?: string): Promise<void> {
    this.enqueue({ to: email, template: 'order-confirmation', data: { orderId: order.id, total: order.total } }, requestId);
  }

  async paymentFailed(customerId: string, requestId?: string): Promise<void> {
    this.enqueue({ to: `customer:${customerId}`, template: 'payment-failed', data: { customerId } }, requestId);
  }

  private enqueue(email: OutboundEmail, requestId?: string): void {
    if (!this.smtpHealthy()) {
      log.warn('notifications.smtp_degraded', { requestId, template: email.template, queued: this.outbox.length + 1 });
    }
    this.outbox.push(email);
    log.info('notifications.queued', { requestId, template: email.template });
  }
}

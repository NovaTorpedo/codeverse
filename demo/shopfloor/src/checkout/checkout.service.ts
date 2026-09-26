import type { CartService } from '../cart/cart.service';
import type { InventoryService } from '../inventory/inventory.service';
import type { NotificationService } from '../notifications/notification.service';
import type { PaymentService } from '../payment/payment.service';
import { HttpError } from '../shared/errors';
import { createLogger } from '../shared/logger';
import type { Order, Session } from '../shared/types';

const log = createLogger('checkout');

export class CheckoutService {
  constructor(
    private readonly carts: CartService,
    private readonly inventory: InventoryService,
    private readonly payments: PaymentService,
    private readonly notifications: NotificationService,
  ) {}

  async placeOrder(session: Session, requestId?: string): Promise<Order> {
    const cart = this.carts.get(session.customerId);
    if (cart.lines.length === 0) throw new HttpError(400, 'empty_cart', 'Cart is empty');
    const total = this.carts.total(cart);
    const orderRef = `ord_${requestId ?? Date.now().toString(36)}`;
    log.info('checkout.started', { requestId, orderRef, cartId: cart.id, lines: cart.lines.length, total, currency: cart.currency });

    const reservation = await this.inventory.reserve(cart.lines, requestId);
    try {
      const charge = await this.payments.charge({ session, amount: total, currency: cart.currency, orderRef, requestId });
      const order: Order = { id: orderRef, customerId: session.customerId, total, currency: cart.currency, chargeId: charge.chargeId, status: 'confirmed' };
      this.carts.clear(session.customerId);
      await this.notifications.orderConfirmed(order, session.customer?.email ?? `customer:${session.customerId}`, requestId);
      log.info('checkout.completed', { requestId, orderRef, chargeId: charge.chargeId });
      return order;
    } catch (err) {
      await this.inventory.release(reservation, requestId);
      await this.notifications.paymentFailed(session.customerId, requestId);
      log.error('checkout.failed', { requestId, orderRef, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) });
      throw err;
    }
  }
}

import type { DbClient } from '../db/client';
import type { StockRecord } from '../db/seed';
import { HttpError } from '../shared/errors';
import { createLogger } from '../shared/logger';
import type { Cart } from '../shared/types';

const log = createLogger('cart');

export class CartService {
  private readonly carts = new Map<string, Cart>();

  constructor(private readonly db: DbClient) {}

  get(customerId: string): Cart {
    let cart = this.carts.get(customerId);
    if (!cart) {
      cart = { id: `cart_${customerId.slice(4)}`, customerId, lines: [], currency: 'EUR' };
      this.carts.set(customerId, cart);
    }
    return cart;
  }

  async addItem(customerId: string, sku: string, quantity: number): Promise<Cart> {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new HttpError(400, 'invalid_quantity', 'Quantity must be 1-20');
    const item = await this.db.findById<StockRecord>('stock', sku);
    if (!item) throw new HttpError(404, 'unknown_sku', `Unknown SKU ${sku}`);
    const cart = this.get(customerId);
    const existing = cart.lines.find((l) => l.sku === sku);
    if (existing) existing.quantity += quantity;
    else cart.lines.push({ sku, name: item.name, quantity, unitPrice: item.unitPrice });
    log.info('cart.item_added', { cartId: cart.id, sku, quantity });
    return cart;
  }

  total(cart: Cart): number {
    return cart.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  }

  clear(customerId: string): void {
    this.carts.delete(customerId);
  }
}

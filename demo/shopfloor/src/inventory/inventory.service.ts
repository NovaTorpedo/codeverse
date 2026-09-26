import type { DbClient } from '../db/client';
import type { StockRecord } from '../db/seed';
import { OutOfStockError } from '../shared/errors';
import { createLogger } from '../shared/logger';
import type { CartLine } from '../shared/types';

const log = createLogger('inventory');
const LOW_STOCK_THRESHOLD = 5;

export interface Reservation {
  id: string;
  lines: Array<{ sku: string; quantity: number }>;
}

export class InventoryService {
  constructor(private readonly db: DbClient) {}

  async reserve(lines: CartLine[], requestId?: string): Promise<Reservation> {
    for (const line of lines) {
      const stock = await this.db.findById<StockRecord>('stock', line.sku);
      if (!stock || stock.available < line.quantity) throw new OutOfStockError(line.sku);
      const remaining = stock.available - line.quantity;
      if (remaining < LOW_STOCK_THRESHOLD) log.warn('inventory.low_stock', { requestId, sku: line.sku, remaining });
      await this.db.update('stock', line.sku, { available: remaining });
    }
    const reservation = { id: `res_${Date.now().toString(36)}`, lines: lines.map((l) => ({ sku: l.sku, quantity: l.quantity })) };
    log.info('inventory.reserved', { requestId, reservationId: reservation.id, lines: lines.length });
    return reservation;
  }

  async release(reservation: Reservation, requestId?: string): Promise<void> {
    for (const line of reservation.lines) {
      const stock = await this.db.findById<StockRecord>('stock', line.sku);
      if (stock) await this.db.update('stock', line.sku, { available: stock.available + line.quantity });
    }
    log.info('inventory.released', { requestId, reservationId: reservation.id });
  }
}

import { createLogger } from '../shared/logger';

const log = createLogger('db');

type Row = { id: string } & Record<string, unknown>;

/** Minimal in-memory document store standing in for the Postgres client. */
export class DbClient {
  private readonly tables = new Map<string, Map<string, Row>>();

  private table(name: string): Map<string, Row> {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  async findById<T>(table: string, id: string): Promise<T | null> {
    const row = this.table(table).get(id);
    log.debug('db.query', { table, op: 'findById', hit: Boolean(row) });
    return (row as T | undefined) ?? null;
  }

  async findOne<T>(table: string, where: Record<string, unknown>): Promise<T | null> {
    for (const row of this.table(table).values()) {
      if (Object.entries(where).every(([k, v]) => row[k] === v)) return row as T;
    }
    return null;
  }

  async upsert<T extends Row>(table: string, row: T): Promise<T> {
    this.table(table).set(row.id, { ...row });
    return row;
  }

  async update(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
    const row = this.table(table).get(id);
    if (row) this.table(table).set(id, { ...row, ...patch });
  }
}

export const db = new DbClient();

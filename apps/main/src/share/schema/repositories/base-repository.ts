import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import * as schema from '@/share/schema/drizzles';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type DB = NodePgDatabase<typeof schema>;

export type PageParams = {
  page?: number;
  limit?: number;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function runInTransaction<T>(
  fn: (tx: DB) => Promise<T>,
  database: DB = defaultDb
): Promise<T> {
  // Drizzle postgres-js 트랜잭션 래퍼
  return database.transaction(async (tx) => fn(tx as DB));
}



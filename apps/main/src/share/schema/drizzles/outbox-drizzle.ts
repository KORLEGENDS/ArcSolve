import {
  bigserial,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const outboxStatusEnum = pgEnum('outbox_status', [
  'pending',
  'in_progress',
  'published',
  'dead',
]);

export const outbox = pgTable('outbox', {
  id: bigserial('id', { mode: 'number' }).primaryKey().notNull(),
  type: text('type').notNull(),
  roomId: uuid('room_id').notNull(),
  payload: jsonb('payload').notNull(),
  status: outboxStatusEnum('status').default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
  lockedBy: text('locked_by'),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
});

export type Outbox = typeof outbox.$inferSelect;
export type NewOutbox = typeof outbox.$inferInsert;


import {
    bigserial,
    jsonb,
    pgTable,
    timestamp,
    uuid,
} from 'drizzle-orm/pg-core';
import { conversations } from './conversation-drizzle';

export const messages = pgTable('messages', {
  id: bigserial('id', { mode: 'number' }).primaryKey().notNull(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull(),
  body: jsonb('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;


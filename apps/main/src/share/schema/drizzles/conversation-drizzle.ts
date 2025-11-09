import {
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const conversations = pgTable('conversations', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;


import {
  bigint,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const userChatRooms = pgTable('user_chat_rooms', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  lastMessageId: bigint('last_message_id', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export type UserChatRoom = typeof userChatRooms.$inferSelect;
export type NewUserChatRoom = typeof userChatRooms.$inferInsert;


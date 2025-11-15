import {
    jsonb,
    pgEnum,
    pgTable,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { arcyouChatRooms } from './arcyou-chat-room-drizzle';
import { users } from './user-drizzle';

export const arcyouChatMessageTypeEnum = pgEnum('arcyou_chat_message_type', [
  'text',
  'image',
  'file',
  'system',
]);

export const arcyouChatMessageStatusEnum = pgEnum('arcyou_chat_message_status', [
  'sent',
  'delivered',
  'read',
  'deleted',
]);

export const arcyouChatMessages = pgTable('arcyou_chat_messages', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => arcyouChatRooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: arcyouChatMessageTypeEnum('type').default('text').notNull(),
  content: jsonb('content').notNull(),
  replyToMessageId: uuid('reply_to_message_id')
    .references((): any => arcyouChatMessages.id, { onDelete: 'set null' }),
  status: arcyouChatMessageStatusEnum('status').default('sent').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type ArcyouChatMessage = typeof arcyouChatMessages.$inferSelect;
export type NewArcyouChatMessage = typeof arcyouChatMessages.$inferInsert;


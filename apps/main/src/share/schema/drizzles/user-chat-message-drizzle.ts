import {
  bigint,
  bigserial,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { userChatRooms } from './user-chat-room-drizzle';

export const userChatMessageTypeEnum = pgEnum('user_chat_message_type', [
  'text',
  'image',
  'file',
  'system',
]);

export const userChatMessageStatusEnum = pgEnum('user_chat_message_status', [
  'sent',
  'delivered',
  'read',
  'deleted',
]);

export const userChatMessages = pgTable('user_chat_messages', {
  id: bigserial('id', { mode: 'number' }).primaryKey().notNull(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => userChatRooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  type: userChatMessageTypeEnum('type').default('text').notNull(),
  content: jsonb('content').notNull(),
  replyToMessageId: bigint('reply_to_message_id', { mode: 'number' })
    .references(() => userChatMessages.id, { onDelete: 'set null' }),
  status: userChatMessageStatusEnum('status').default('sent').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type UserChatMessage = typeof userChatMessages.$inferSelect;
export type NewUserChatMessage = typeof userChatMessages.$inferInsert;


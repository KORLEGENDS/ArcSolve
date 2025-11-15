import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { arcyouChatMessages } from './arcyou-chat-message-drizzle';

export const arcyouChatRoomTypeEnum = pgEnum('arcyou_chat_room_type', [
  'direct',
  'group',
]);

export const arcyouChatRooms = pgTable('arcyou_chat_rooms', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  type: arcyouChatRoomTypeEnum('type').default('direct').notNull(),
  lastMessageId: uuid('last_message_id')
    .references((): any => arcyouChatMessages.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export type ArcyouChatRoom = typeof arcyouChatRooms.$inferSelect;
export type NewArcyouChatRoom = typeof arcyouChatRooms.$inferInsert;


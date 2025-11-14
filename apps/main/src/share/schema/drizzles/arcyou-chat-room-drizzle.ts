import {
  bigint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

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
  lastMessageId: bigint('last_message_id', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export type ArcyouChatRoom = typeof arcyouChatRooms.$inferSelect;
export type NewArcyouChatRoom = typeof arcyouChatRooms.$inferInsert;


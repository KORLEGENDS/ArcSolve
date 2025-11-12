import {
  bigint,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { arcyouChatRooms } from './arcyou-chat-room-drizzle';
import { users } from './user-drizzle';

export const arcyouChatMemberRoleEnum = pgEnum('arcyou_chat_member_role', [
  'owner',
  'manager',
  'participant',
]);

export const arcyouChatMembers = pgTable(
  'arcyou_chat_members',
  {
    roomId: uuid('room_id')
      .notNull()
      .references(() => arcyouChatRooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: arcyouChatMemberRoleEnum('role')
      .default('participant')
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    lastReadMessageId: bigint('last_read_message_id', { mode: 'number' }),
  },
  (member) => [
    primaryKey({ columns: [member.roomId, member.userId] }),
  ]
);

export type ArcyouChatMember = typeof arcyouChatMembers.$inferSelect;
export type NewArcyouChatMember = typeof arcyouChatMembers.$inferInsert;


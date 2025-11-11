import {
  bigint,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { userChatRooms } from './user-chat-room-drizzle';

export const userChatMemberRoleEnum = pgEnum('user_chat_member_role', [
  'owner',
  'manager',
  'participant',
]);

export const userChatMembers = pgTable(
  'user_chat_members',
  {
    roomId: uuid('room_id')
      .notNull()
      .references(() => userChatRooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    role: userChatMemberRoleEnum('role')
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

export type UserChatMember = typeof userChatMembers.$inferSelect;
export type NewUserChatMember = typeof userChatMembers.$inferInsert;


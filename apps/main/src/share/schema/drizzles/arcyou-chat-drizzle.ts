import {
    jsonb,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uuid,
} from 'drizzle-orm/pg-core';
import { users } from './user-drizzle';

// Enums
export const arcyouChatRoomTypeEnum = pgEnum('arcyou_chat_room_type', [
  'direct',
  'group',
]);

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

export const arcyouChatMemberRoleEnum = pgEnum('arcyou_chat_member_role', [
  'owner',
  'manager',
  'participant',
]);

export const arcyouChatRelationStatusEnum = pgEnum(
  'arcyou_chat_relation_status',
  ['pending', 'accepted', 'rejected', 'blocked'],
);

// Tables
export const arcyouChatRooms = pgTable('arcyou_chat_rooms', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .defaultRandom(),
  name: text('name').notNull(),
  type: arcyouChatRoomTypeEnum('type').default('direct').notNull(),
  imageUrl: text('image_url'),
  lastMessageId: uuid('last_message_id')
    .references((): any => arcyouChatMessages.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

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
    lastReadMessageId: uuid('last_read_message_id')
      .references(() => arcyouChatMessages.id, { onDelete: 'set null' }),
  },
  (member) => [
    primaryKey({ columns: [member.roomId, member.userId] }),
  ]
);

export const arcyouChatRelations = pgTable(
  'arcyou_chat_relations',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    status: arcyouChatRelationStatusEnum('status')
      .default('pending')
      .notNull(),

    requestedAt: timestamp('requested_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    respondedAt: timestamp('responded_at', { withTimezone: true }),

    blockedAt: timestamp('blocked_at', { withTimezone: true }),
  },
  (relation) => [
    primaryKey({
      columns: [relation.userId, relation.targetUserId],
    }),
  ],
);

// Types
export type ArcyouChatRoom = typeof arcyouChatRooms.$inferSelect;
export type NewArcyouChatRoom = typeof arcyouChatRooms.$inferInsert;

export type ArcyouChatMessage = typeof arcyouChatMessages.$inferSelect;
export type NewArcyouChatMessage = typeof arcyouChatMessages.$inferInsert;

export type ArcyouChatMember = typeof arcyouChatMembers.$inferSelect;
export type NewArcyouChatMember = typeof arcyouChatMembers.$inferInsert;

export type ArcyouChatRelation =
  typeof arcyouChatRelations.$inferSelect;

export type NewArcyouChatRelation =
  typeof arcyouChatRelations.$inferInsert;


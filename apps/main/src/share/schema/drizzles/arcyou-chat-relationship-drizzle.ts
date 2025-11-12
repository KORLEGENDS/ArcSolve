import {
    pgEnum,
    pgTable,
    primaryKey,
    timestamp,
    uuid,
} from 'drizzle-orm/pg-core';

import { users } from './user-drizzle';

export const arcyouChatRelationshipStatusEnum = pgEnum(
  'arcyou_chat_relationship_status',
  ['pending', 'accepted', 'blocked', 'rejected'],
);

export const arcyouChatRelationships = pgTable(
  'arcyou_chat_relationships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    status: arcyouChatRelationshipStatusEnum('status')
      .default('pending')
      .notNull(),

    requestedAt: timestamp('requested_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    respondedAt: timestamp('responded_at', { withTimezone: true }),

    blockedAt: timestamp('blocked_at', { withTimezone: true }),
  },
  (relationship) => [
    primaryKey({
      columns: [relationship.userId, relationship.targetUserId],
    }),
  ],
);

export type ArcyouChatRelationship =
  typeof arcyouChatRelationships.$inferSelect;

export type NewArcyouChatRelationship =
  typeof arcyouChatRelationships.$inferInsert;



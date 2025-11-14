import {
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './user-drizzle';

export const arcyouChatRelationStatusEnum = pgEnum(
  'arcyou_chat_relation_status',
  ['pending', 'accepted', 'rejected', 'blocked'],
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

export type ArcyouChatRelation =
  typeof arcyouChatRelations.$inferSelect;

export type NewArcyouChatRelation =
  typeof arcyouChatRelations.$inferInsert;


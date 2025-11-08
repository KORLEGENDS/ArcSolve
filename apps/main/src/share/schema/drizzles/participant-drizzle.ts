import {
  bigint,
  pgEnum,
  pgTable,
  primaryKey,
  uuid
} from 'drizzle-orm/pg-core';
import { conversations } from './conversation-drizzle';

export const participantRoleEnum = pgEnum('participant_role', [
  'member',
  'admin',
]);

export const participants = pgTable(
  'participants',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    lastReadId: bigint('last_read_id', { mode: 'number' })
      .default(0)
      .notNull(),
    role: participantRoleEnum('role').default('member').notNull(),
  },
  (participant) => [
    primaryKey({ columns: [participant.conversationId, participant.userId] }),
  ]
);

export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;


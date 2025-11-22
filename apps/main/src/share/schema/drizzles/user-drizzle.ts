import type { UserPreferences } from '@/share/schema/zod/user-zod';
import { jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),

  // Better Auth auth.user.id 매핑용 컬럼 (텍스트, 고유)
  authUserId: text('auth_user_id').unique(),

  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  imageUrl: text('image_url'),
  preferences: jsonb('preferences').$type<UserPreferences>(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

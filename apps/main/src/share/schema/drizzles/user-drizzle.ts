import type { UserPreferences } from '@/share/schema/zod/user-zod';
import { jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),

  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  imageUrl: text('image_url'),
  preferences: jsonb('preferences').$type<UserPreferences>(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

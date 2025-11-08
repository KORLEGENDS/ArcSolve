import type { UserPreferences } from '@/share/schema/zod/user-zod';
import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'manager', 'admin']);

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
  role: userRoleEnum('role').default('user').notNull(),
  preferences: jsonb('preferences').$type<UserPreferences>(),

  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

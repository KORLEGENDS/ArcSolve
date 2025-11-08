import type { AdapterAccountType } from '@auth/core/adapters';
import {
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// Auth.js DrizzleAdapter용 테이블을 auth 스키마로 격리
const auth = pgSchema('auth');

// 어댑터가 기대하는 최소 컬럼만 유지 (id, name, email, emailVerified, image)
export const authUsers = auth.table('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

// 계정 테이블도 어댑터 필수 컬럼만 유지 (userId, type, provider, providerAccountId)
// 토큰 관련 컬럼은 선택 사항이므로 필요한 것만 남김
export const authAccounts = auth.table(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

import { expo } from '@better-auth/expo';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth as createBetterAuth } from 'better-auth/minimal';
import { eq } from 'drizzle-orm';

import { db } from '@/server/database/postgresql/client-postgresql';
import { env, isDevelopment } from '@/share/configs/environments/server-constants';
import {
  authAccounts as adapterAccounts,
  authSessions as adapterSessions,
  authUsers as adapterUsers,
  authVerifications as adapterVerifications,
} from '@/share/schema/drizzles/auth-drizzle';
import { users } from '@/share/schema/drizzles/user-drizzle';

/**
 * Better Auth 인스턴스
 *
 * - Drizzle(PostgreSQL) 어댑터 사용
 * - Kakao / Naver 소셜 로그인
 * - Expo 플러그인(모바일 통합) 활성화
 *
 * ⚠️ 현재는 기존 NextAuth 플로우와 병행 사용을 위해
 *    별도 엔드포인트에서만 사용됩니다.
 */
export const betterAuth = betterAuthInit();

function betterAuthInit() {
  const socialProviders =
    env.AUTH_KAKAO_ID && env.AUTH_KAKAO_SECRET
      ? {
          kakao: {
            clientId: env.AUTH_KAKAO_ID,
            clientSecret: env.AUTH_KAKAO_SECRET,
            // Kakao 동의 항목 중 profile_image 는 요청하지 않습니다.
            // (콘솔에서 설정하지 않은 동의 항목으로 인해 에러가 발생하므로 제거)
            disableDefaultScope: true,
            scope: ['account_email', 'profile_nickname'],
          },
        }
      : {};

  const withNaver =
    env.AUTH_NAVER_ID && env.AUTH_NAVER_SECRET
      ? {
          naver: {
            clientId: env.AUTH_NAVER_ID,
            clientSecret: env.AUTH_NAVER_SECRET,
          },
        }
      : {};

  return createBetterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: adapterUsers,
        account: adapterAccounts,
        session: adapterSessions,
        verification: adapterVerifications,
      },
    }),
    databaseHooks: {
      user: {
        create: {
          // Better Auth가 auth.user를 생성한 이후, 우리 도메인 users 테이블과 매핑
          after: async (authUser) => {
            try {
              if (!authUser.email) return;

              // 1) 이미 authUserId로 매핑된 사용자 찾기
              const existingByAuthId = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.authUserId, authUser.id))
                .limit(1);

              if (existingByAuthId.length > 0) {
                await db
                  .update(users)
                  .set({
                    email: authUser.email,
                    name: authUser.name ?? users.name,
                    imageUrl: authUser.image ?? null,
                    updatedAt: new Date(),
                  })
                  .where(eq(users.id, existingByAuthId[0].id));
                return;
              }

              // 2) authUserId는 없지만 같은 이메일의 사용자가 이미 존재하는 경우 → 기존 유저에 authUserId 매핑
              const existingByEmail = await db
                .select({
                  id: users.id,
                  authUserId: users.authUserId,
                })
                .from(users)
                .where(eq(users.email, authUser.email))
                .limit(1);

              if (existingByEmail.length > 0) {
                await db
                  .update(users)
                  .set({
                    authUserId: authUser.id,
                    name: authUser.name ?? users.name,
                    imageUrl: authUser.image ?? null,
                    updatedAt: new Date(),
                  })
                  .where(eq(users.id, existingByEmail[0].id));
                return;
              }

              // 3) 완전히 새로운 사용자라면 새 도메인 유저 생성 (id는 uuid defaultRandom 사용)
              await db.insert(users).values({
                email: authUser.email,
                name: authUser.name ?? '',
                imageUrl: authUser.image ?? null,
                authUserId: authUser.id,
              });
            } catch (error) {
              if (isDevelopment) {
                // eslint-disable-next-line no-console
                console.error('[BetterAuth] user.create.after hook error:', error);
              }
            }
          },
        },
      },
    },
    socialProviders: {
      ...socialProviders,
      ...withNaver,
    },
    plugins: [expo()],
    trustedOrigins: [
      'arcsolve://',
      ...(isDevelopment
        ? [
            'exp://*/*',
            'exp://10.0.0.*:*/*',
            'exp://192.168.*.*:*/*',
            'exp://172.*.*.*:*/*',
            'exp://localhost:*/*',
          ]
        : []),
    ],
  });
}



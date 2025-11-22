import { expo } from '@better-auth/expo';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth as createBetterAuth } from 'better-auth/minimal';

import { db } from '@/server/database/postgresql/client-postgresql';
import { env, isDevelopment } from '@/share/configs/environments/server-constants';
import {
  authAccounts as adapterAccounts,
  authUsers as adapterUsers,
} from '@/share/schema/drizzles/auth-drizzle';

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
      },
    }),
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



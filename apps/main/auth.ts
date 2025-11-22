/**
 * 🔐 Better Auth 서버 엔트리 (NextAuth → Better Auth 전환 완료)
 *
 * - 서버 공용 진입점: `auth()` / `handlers`
 * - 기존 코드에서 사용하는 `@auth` 경로는 그대로 유지됩니다.
 */

import { betterAuth } from '@/server/auth/better-auth';
import { db } from '@/server/database/postgresql/client-postgresql';
import { users } from '@/share/schema/drizzles/user-drizzle';
import { eq } from 'drizzle-orm';
import { toNextJsHandler } from 'better-auth/next-js';
import { headers } from 'next/headers';

/**
 * 앱 전역에서 사용하는 세션 타입
 * - 기존 next-auth 기반 Session 대체
 */
export type AppSession = typeof betterAuth.$Infer.Session;

// Better Auth CLI가 설정을 읽을 수 있도록 auth 인스턴스를 default export로 노출
// (런타임 동작에는 영향 없음)
export default betterAuth;

/**
 * 서버에서 세션을 조회하는 헬퍼
 *
 * - 사용 예시:
 *   const session = await auth();
 */
export async function auth(): Promise<AppSession | null> {
  const session = await betterAuth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return session;
  }

  // Better Auth의 user.id(auth.user.id)를 도메인 users.id(uuid)로 매핑
  const authUserId = session.user.id;

  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, authUserId))
      .limit(1);

    if (rows.length > 0) {
      // 기존 NextAuth와 동일하게, 세션에서 사용하는 id를 도메인 users.id로 맞춰준다.
      (session.user as any).id = rows[0].id;
    }
  } catch {
    // 매핑 실패 시에는 원본 authUserId를 그대로 사용 (로그인은 유지)
  }

  return session;
}

/**
 * `/api/auth/*` 라우트용 핸들러
 *
 * - 사용 예시 (Route Handler):
 *   import { handlers } from '@auth';
 *   export const { GET, POST } = handlers;
 */
export const handlers = toNextJsHandler(betterAuth.handler);

// 필요 시 서버 액션/테스트에서 betterAuth 인스턴스를 직접 쓰기 위한 재노출
export { betterAuth };


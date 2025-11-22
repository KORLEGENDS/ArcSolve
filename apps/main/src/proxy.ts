import { routing } from '@/share/libs/i18n/routing';
import { betterAuth } from '@/server/auth/better-auth';
import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { authMiddleware } from './server/auth/edge-auth';

const handleI18n = createMiddleware(routing);

export const proxy = async (req: NextRequest): Promise<Response> => {
  // 먼저 i18n 라우팅 처리
  const res = handleI18n(req as unknown as NextRequest);

  // next-intl이 redirect/rewrite하지 않았다면 인증 미들웨어로 진행
  if (res.headers.get('x-middleware-next') !== null) {
    // proxy.ts (middleware/proxy 환경)에서는 next/headers의 headers()
    // 를 사용할 수 없으므로, 요청 객체의 headers를 직접 전달합니다.
    const session = await betterAuth.api
      .getSession({ headers: req.headers })
      .catch(() => null);
    const isLoggedIn = !!session;
    return authMiddleware(req, { isLoggedIn });
  }

  return res;
};

export const config = {
  matcher: [
    // 정적 자산 및 내부 경로 제외
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf|mjs|wasm|bcmap|json|mp4|webm|map)$).*)',
    ],
};



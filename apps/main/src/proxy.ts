import { routing } from '@/share/i18n/routing';
import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { authMiddleware, edgeAuth } from './server/auth/edge-auth';

const handleI18n = createMiddleware(routing);

export const proxy = edgeAuth(async (req: NextRequest & { auth: any }) => {
  // 먼저 i18n 라우팅 처리
  const res = handleI18n(req as unknown as NextRequest);
  // next-intl이 redirect/rewrite하지 않았다면 인증 미들웨어로 진행
  if (res.headers.get('x-middleware-next') !== null) {
    return authMiddleware(req as any);
  }
  return res;
});

export const config = {
  matcher: [
    // 정적 자산 및 내부 경로 제외
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf|mjs|wasm|bcmap|json|mp4|webm)$).*)',
    ],
};



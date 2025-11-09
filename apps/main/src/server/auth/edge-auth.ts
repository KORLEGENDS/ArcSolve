import { ERROR_CODES, getMiddlewareErrorResponse } from '@/share/configs/constants/api-constants';
// 서버 파일에서는 공유 i18n의 순수 유틸 함수만 사용합니다 (Link/훅 import 금지)
import {
  extractLocaleFromPathname,
  getLocalizedPath,
  removeLocaleFromPathname,
} from '@/share/libs/i18n/routing';
import NextAuth, { type NextAuthConfig, type Session } from 'next-auth';
import { type NextRequest, NextResponse } from 'next/server';

// ==================== 공개 경로 / 공개 API 경로 ====================
export const PUBLIC_PATHS = ['/login', '/docs'] as const;

export const PUBLIC_API_PATHS = [
  '/api/auth',
  '/api/cron',
  '/api/auth/oauth/token',
  '/api/auth/oauth/revoke',
] as const;

export function isPublicPath(pathname: string): boolean {
  // locale 제거 후 확인
  const pathnameWithoutLocale = removeLocaleFromPathname(pathname);
  return PUBLIC_PATHS.some((path) => pathnameWithoutLocale.startsWith(path));
}

// 특정 공개 API 경로 판별 (startsWith + 정규식 병행)
function isPublicApiPath(pathname: string): boolean {
  // 단순 prefix 기반 공개 API들
  return PUBLIC_API_PATHS.some((path) => pathname.startsWith(path));
}

// ==================== 인증 미들웨어 핵심 로직 (Edge-safe) ====================
export async function authMiddleware(
  req: NextRequest & { auth: Session | null }
): Promise<NextResponse | Response> {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // API 경로 보호 (먼저 처리하여 페이지 리다이렉트와 구분)
  if (pathname.startsWith('/api/')) {
    const isPublicApi = isPublicApiPath(pathname);
    if (!isPublicApi) {
      if (!isLoggedIn) {
        return getMiddlewareErrorResponse(ERROR_CODES.AUTH.UNAUTHORIZED);
      }
      // CSRF 방어: 브라우저가 보낸 변이 요청에 대해 Origin 검사
      const mutating =
        req.method === 'POST' ||
        req.method === 'PUT' ||
        req.method === 'PATCH' ||
        req.method === 'DELETE';
      if (mutating) {
        const requestOrigin = new URL(req.url).origin;
        const origin = req.headers.get('origin');
        const referer = req.headers.get('referer');
        if (origin) {
          if (origin !== requestOrigin) {
            return new Response(
              JSON.stringify({ error: 'Forbidden' }),
              { status: 403, headers: { 'content-type': 'application/json' } }
            );
          }
        } else if (referer) {
          try {
            const refererOrigin = new URL(referer).origin;
            if (refererOrigin !== requestOrigin) {
              return new Response(
                JSON.stringify({ error: 'Forbidden' }),
                { status: 403, headers: { 'content-type': 'application/json' } }
              );
            }
          } catch {
            return new Response(
              JSON.stringify({ error: 'Forbidden' }),
              { status: 403, headers: { 'content-type': 'application/json' } }
            );
          }
        }
      }
    }
    return NextResponse.next();
  }

  // 비로그인 사용자는 공개 경로만 접근 허용
  if (!isLoggedIn && !isPublicPath(pathname)) {
    // locale 추출
    const locale = extractLocaleFromPathname(pathname);

    // locale을 포함한 로그인 경로 생성 (always: 모든 locale에 prefix 포함)
    const localizedLoginPath = getLocalizedPath(locale, '/login');
    const loginUrl = new URL(localizedLoginPath, req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 로그인된 사용자가 로그인 페이지 접근 시 홈으로 리다이렉트
  const locale = extractLocaleFromPathname(pathname);
  const pathnameWithoutLocale = removeLocaleFromPathname(pathname);

  if (pathnameWithoutLocale === '/login' && isLoggedIn) {
    const localizedHomePath = getLocalizedPath(locale, '/');
    return NextResponse.redirect(new URL(localizedHomePath, req.url));
  }

  return NextResponse.next();
}

// ==================== Edge 전용 NextAuth 래퍼 (Node 의존성 금지) ====================
export const edgeAuthConfig = {
  session: { strategy: 'jwt' },
  trustHost: true,
  // Edge 런타임에서는 서버 환경 모듈을 import하지 않고 ENV로 직접 주입합니다.
  secret: process.env.AUTH_SECRET,
  providers: [],
} satisfies NextAuthConfig;

export const { auth: edgeAuth } = NextAuth(edgeAuthConfig);

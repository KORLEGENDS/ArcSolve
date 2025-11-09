/**
 * 🔐 Auth Provider - 인증 생명주기 관리 계층
 *
 * ## 📌 핵심 역할
 * 애플리케이션 전체의 인증 관련 에러를 감지하고 처리하는 중앙 관리 시스템입니다.
 * React Query의 모든 API 요청을 감시하여 토큰 만료 등 인증 실패 시 자동으로 복구 절차를 실행합니다.
 *
 * ## 🎯 주요 기능
 * - ✅ RefreshTokenError 전역 감지: 모든 API 요청에서 발생하는 토큰 만료 에러 포착
 * - ✅ 자동 로그아웃 처리: 토큰 만료 시 캐시 클리어 및 세션 종료
 * - ✅ 재인증 유도: 로그인 페이지로 리다이렉트하여 사용자 재인증 유도
 * - ✅ Query/Mutation 양방향 감시: 모든 타입의 React Query 작업 모니터링
 *
 * ## 🏗️ 아키텍처적 위치
 * ```
 * 정확히 작성 필요합니다.
 * ```
 *
 * ## 🔄 SessionProvider와의 역할 분담
 * - SessionProvider: NextAuth 기반 세션 상태 관리, OAuth 인증, 세션 갱신
 * - AuthProvider: 토큰 에러 처리, 인증 실패 복구, 자동 로그아웃 실행
 *
 * ## 🚀 향후 확장 가능성
 * - 토큰 자동 갱신 로직 추가
 * - 권한(Permission) 기반 접근 제어
 * - 인증 이벤트 로깅 및 분석
 * - 다중 인증 방식 지원 (Biometric, 2FA 등)
 * - 세션 타임아웃 관리
 *
 * ## ⚠️ 중요 사항
 * - Provider 계층 최상단에 위치해야 모든 하위 컴포넌트의 에러 감지 가능
 * - QueryClient 인스턴스가 필요하므로 QueryProvider 상위에 위치
 * - 무한 리다이렉트 방지를 위해 reauth 쿼리 파라미터 사용
 */

'use client';

import { isDevelopment } from '@/share/configs/environments/client-constants';
import { extractLocaleFromPathname, getLocalizedPath, usePathname } from '@/share/libs/i18n/routing';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { signOut } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { usePathname as useNextPathname, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useMemo } from 'react';

export async function logoutWithCacheClear(
  queryClient: QueryClient,
  options?: {
    callbackUrl?: string;
    redirect?: boolean;
  }
): Promise<void> {
  const fallbackCallbackUrl = (() => {
    try {
      if (typeof window !== 'undefined') {
        const locale = extractLocaleFromPathname(window.location.pathname);
        return getLocalizedPath(locale, '/login');
      }
    } catch {}
    return '/login';
  })();
  const finalCallbackUrl = options?.callbackUrl ?? fallbackCallbackUrl;
  try {
    queryClient.clear();
    // cleanupArcWorkLayout 유틸리티 제거됨

    if (options?.redirect === false) {
      await signOut({
        callbackUrl: finalCallbackUrl,
        redirect: false,
      });
    } else {
      await signOut({
        callbackUrl: finalCallbackUrl,
      });
    }
  } catch (error) {
    if (isDevelopment) {
      console.error('Failed to logout:', error);
    }
    window.location.href = finalCallbackUrl;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 인증 Provider - AuthError 감지 및 자동 복구
 * React Query의 에러 이벤트를 구독하여 인증 실패 시 적절한 처리를 수행
 */
export function AuthProvider({ children }: AuthProviderProps): ReactNode {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const pathname = usePathname(); // locale 제외된 경로
  const nextPathname = useNextPathname(); // locale 포함된 전체 경로
  const searchParams = useSearchParams();

  const currentPathWithQuery = useMemo((): string => {
    try {
      const query = searchParams?.toString();
      // locale 포함된 전체 경로 사용
      return query && query.length > 0 ? `${nextPathname}?${query}` : nextPathname;
    } catch {
      // 안전한 폴백
      if (typeof window !== 'undefined')
        return window.location.pathname + window.location.search;
      return nextPathname ?? '/';
    }
  }, [nextPathname, searchParams]);

  function isUnauthorized(error: unknown): boolean {
    // 다양한 에러 래퍼를 관용적으로 처리
    const anyErr = error as
      | {
          status?: number;
          response?: { status?: number };
          cause?: { status?: number };
        }
      | undefined;
    const status =
      anyErr?.status ?? anyErr?.response?.status ?? anyErr?.cause?.status;
    return status === 401;
  }

  useEffect((): (() => void) => {
    // 401 처리 로직: 캐시 정리 후 로그인 페이지로 이동 (복귀 경로 보존)
    const handleUnauthorized = async (): Promise<void> => {
      // 로그인 페이지에서 또다시 처리하지 않도록 루프 방지 (locale 제외된 경로로 비교)
      if (pathname === '/login') return;

      // locale을 포함한 로그인 경로 생성 (always: 모든 locale에 prefix 포함)
      const loginPath = getLocalizedPath(locale, '/login');
      const callbackUrl = `${loginPath}?next=${encodeURIComponent(currentPathWithQuery)}&reason=reauth`;

      await logoutWithCacheClear(queryClient, {
        callbackUrl,
        redirect: true,
      });
    };

    // React Query 전역 에러 캐치 핸들러
    const unsubscribe = queryClient
      .getMutationCache()
      .subscribe((event): void => {
        if (event?.type === 'updated' && event.mutation?.state.error) {
          const error = event.mutation.state.error as unknown;
          if (isUnauthorized(error)) {
            void handleUnauthorized();
          }
        }
      });

    // Query 에러도 감지
    const queryUnsubscribe = queryClient
      .getQueryCache()
      .subscribe((event): void => {
        if (event?.type === 'updated' && event.query?.state.error) {
          const error = event.query.state.error as unknown;
          if (isUnauthorized(error)) {
            void handleUnauthorized();
          }
        }
      });

    // 클린업
    return (): void => {
      unsubscribe();
      queryUnsubscribe();
    };
  }, [queryClient, pathname, currentPathWithQuery, locale]);

  return <>{children}</>;
}

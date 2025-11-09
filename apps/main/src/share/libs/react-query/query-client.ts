/**
 * TanStack Query v5 QueryClient 설정
 * 2025년 6월 기준 최신 안정 버전 - 간단하고 실용적인 설정
 * ✅ AuthError (인증 에러) 전역 처리 지원
 */

import { AuthError } from '@/share/types/api/error-types';
import { TIMEOUT } from '@/share/configs/constants/time-constants';
import { QueryClient } from '@tanstack/react-query';

// HTTP 상태 코드를 안전하게 추출하기 위한 헬퍼
const getHttpStatusFromError = (err: unknown): number => {
  if (typeof err !== 'object' || err === null) return 0;
  const maybe = err as { status?: unknown; response?: { status?: unknown } };
  if (typeof maybe.status === 'number') return maybe.status;
  if (maybe.response && typeof maybe.response.status === 'number')
    return maybe.response.status;
  return 0;
};

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // v5: staleTime 기본값
        staleTime: TIMEOUT.CACHE.MEDIUM, // 5분 - 데이터가 신선한 상태로 간주되는 시간
        gcTime: TIMEOUT.CACHE.LONG, // 30분 - 가비지 컬렉션 시간 (v5: cacheTime → gcTime)

        // 개선된 에러 처리 및 재시도 로직
        retry: (failureCount: number, error: unknown): boolean => {
          // AuthError (인증 에러)는 재시도하지 않음 (AuthProvider에서 처리)
          if (error instanceof AuthError) return false;

          // 표준 API 에러 구조 확인
          if (error && typeof error === 'object' && 'httpStatus' in error) {
            const status = (error as any).httpStatus;
            // 4xx 클라이언트 에러는 재시도하지 않음
            if (status >= 400 && status < 500) return false;
          }

          // HTTP 상태 코드 체크 (기존 방식)
          const status = getHttpStatusFromError(error);
          if (status >= 400 && status < 500) return false;

          // 최대 재시도 횟수
          return failureCount < 3;
        },

        // 지수 백오프 재시도 지연
        retryDelay: (attemptIndex) =>
          Math.min(
            TIMEOUT.RETRY.BASE_DELAY *
              TIMEOUT.RETRY.BACKOFF_FACTOR ** attemptIndex,
            TIMEOUT.RETRY.MAX_DELAY
          ),

        // 포커스 시 자동 리페치 비활성화 (성능상 이유)
        refetchOnWindowFocus: false,

        // v5: useErrorBoundary → throwOnError
        throwOnError: false,

        // 네트워크 재연결 시 리페치 비활성화 (성능 최적화)
        refetchOnReconnect: false,
      },
      mutations: {
        retry: (failureCount: number, error: unknown): boolean => {
          // AuthError (인증 에러)는 재시도하지 않음 (AuthProvider에서 처리)
          if (error instanceof AuthError) return false;

          // 표준 API 에러 구조 확인
          if (error && typeof error === 'object' && 'httpStatus' in error) {
            const status = (error as any).httpStatus;
            // 4xx 클라이언트 에러는 재시도하지 않음
            if (status >= 400 && status < 500) return false;
          }

          // 기본적으로 1회 재시도
          return failureCount < 1;
        },
        throwOnError: false,
        // 뮤테이션 타임아웃 설정
        gcTime: TIMEOUT.CACHE.MEDIUM, // 5분
      },
    },
  });

// 싱글톤 QueryClient 인스턴스 (SSR 호환)
let globalQueryClient: QueryClient | undefined = undefined;

export const getQueryClient = (): QueryClient => {
  if (typeof window === 'undefined') {
    // 서버 사이드: 매번 새로운 인스턴스 생성
    return createQueryClient();
  } else {
    // 클라이언트 사이드: 싱글톤 패턴
    globalQueryClient ??= createQueryClient();
    return globalQueryClient;
  }
};

// 기본 export
export const queryClient = getQueryClient();

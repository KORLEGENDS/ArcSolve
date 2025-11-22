/**
 * TanStack Query v5 Query Key Factory
 * 타입 안전한 쿼리 키 생성 패턴
 */

export const queryKeys = {
  // 인증 관련
  auth: {
    all: () => ['auth'] as const,
    session: () => [...queryKeys.auth.all(), 'session'] as const,
  }
} as const;


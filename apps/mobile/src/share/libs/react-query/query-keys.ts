/**
 * TanStack Query v5 Query Key Factory
 * 타입 안전한 쿼리 키 생성 패턴
 */

export const queryKeys = {
  // 인증 관련
  auth: {
    all: () => ['auth'] as const,
    session: () => [...queryKeys.auth.all(), 'session'] as const,
  },

  // AI 관련 (document 기반 AI 세션)
  ai: {
    all: () => ['ai'] as const,
    conversation: (documentId: string) =>
      [...queryKeys.ai.all(), 'conversation', documentId] as const,
  },

  // 문서 관련
  documents: {
    all: () => ['documents'] as const,
    byId: (documentId: string) =>
      [...queryKeys.documents.all(), 'detail', documentId] as const,
  },
} as const;


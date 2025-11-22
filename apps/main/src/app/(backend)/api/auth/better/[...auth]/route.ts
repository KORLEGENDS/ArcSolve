import { toNextJsHandler } from 'better-auth/next-js';

import { betterAuth } from '@/server/auth/better-auth';

/**
 * Better Auth 전용 API 엔드포인트
 *
 * - base path: /api/auth/better
 * - 모든 Better Auth 요청은 이 엔드포인트로 라우팅됩니다.
 * - 기존 NextAuth `/api/auth/[...nextauth]`와 병행 사용 (점진 전환용)
 */
export const { GET, POST } = toNextJsHandler(betterAuth.handler);



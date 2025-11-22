'use client';

import { createAuthClient } from 'better-auth/react';

// Better Auth 클라이언트 인스턴스 (React/Next.js 전용)
// - 기본값: `/api/auth` 엔드포인트 사용
export const authClient = createAuthClient({
  // 필요 시 baseURL, plugins 등을 여기에서 설정
});




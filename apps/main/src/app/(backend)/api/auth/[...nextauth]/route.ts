/**
 * NextAuth.js v5 API 라우트 (Backend)
 * 2025년 6월 기준 최신 안정 버전
 * ✅ 루트 auth.ts에서 handlers 가져오기 (표준 구조)
 */

import { handlers } from '@auth';

export const { GET, POST } = handlers;

// NextAuth.js v5가 자동으로 처리하는 엔드포인트들:
// - GET  /api/auth/session        - 현재 세션 조회
// - POST /api/auth/signin         - 로그인 처리
// - POST /api/auth/signout        - 로그아웃 처리
// - GET  /api/auth/providers      - 지원되는 제공자 목록
// - GET  /api/auth/callback/[provider] - OAuth 콜백 처리
// - GET  /api/auth/signin/[provider]   - 제공자별 로그인 페이지
// - GET  /api/auth/csrf           - CSRF 토큰 조회
// - POST /api/auth/callback/credentials - 자격 증명 콜백 (사용하지 않음)

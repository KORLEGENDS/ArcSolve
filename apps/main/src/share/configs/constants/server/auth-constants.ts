/**
 * 🚨 서버 전용 보안 상수 통합
 * 모든 보안 관련 설정이 통합된 중앙 집중식 보안 상수 파일
 *
 * ⚠️ 중요: 이 파일은 절대 클라이언트 번들에 포함되어서는 안됩니다
 */

import { TIME_UNITS } from '../time-constants';

// ==================== OAuth 제공자 상수 ====================

/**
 * OAuth 제공자 목록
 */
export const OAUTH_PROVIDERS = {
  KAKAO: 'kakao',
  NAVER: 'naver',
} as const satisfies Record<string, 'kakao' | 'naver'>;

/**
 * OAuth 제공자별 공개 인증 URL
 * 클라이언트에서 리다이렉트 시 사용
 */
export const OAUTH_AUTH_URLS: Record<'kakao' | 'naver', string> = {
  [OAUTH_PROVIDERS.KAKAO]: 'https://kauth.kakao.com/oauth/authorize',
  [OAUTH_PROVIDERS.NAVER]: 'https://nid.naver.com/oauth2.0/authorize',
} as const satisfies Record<'kakao' | 'naver', string>;

// ==================== 토큰 관련 상수 ====================
// TOKEN_EXPIRY 제거됨 - 사용되지 않음

// ==================== Rate Limiting 설정 (보안 중요) ====================

export const RATE_LIMIT = {
  // 실제 사용되는 Rate Limiting만 유지
  API: {
    WINDOW: TIME_UNITS.MINUTE * 1000, // 1분 윈도우
    MAX_REQUESTS: 100, // 분당 100회
    // BURST_LIMIT 제거됨 - 사용되지 않음
  },
  // AUTH, UPLOAD 제거됨 - 사용되지 않음
} as const;

// ==================== 세션 보안 설정 ====================
// JWT 전략 사용으로 DB 세션 관리 불필요 - 제거됨

// ==================== 사용자 역할 및 권한 (보안 중요) ====================

/**
 * 서버에서 검증하는 사용자 역할 (3단계 시스템)
 */
export const USER_ROLES = {
  USER: 'user',
  MANAGER: 'manager',
  ADMIN: 'admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// ROLE_PERMISSIONS 제거됨 - 사용되지 않음
// 현재는 단순한 role 기반 인증만 사용

// ==================== 파일 보안 설정 ====================
// FILE_SECURITY 제거됨 - 사용되지 않음

// ==================== OAuth 서버 엔드포인트 (보안 중요) ====================

/**
 * OAuth 제공자별 서버 전용 엔드포인트
 * 토큰 교환, 사용자 정보 조회 등 민감한 작업용
 */
export const OAUTH_SERVER_ENDPOINTS = {
  // 실제 사용되는 OAuth 제공자만 유지
  KAKAO: {
    AUTH: OAUTH_AUTH_URLS[OAUTH_PROVIDERS.KAKAO],
    TOKEN: 'https://kauth.kakao.com/oauth/token', // 🔒 서버 전용
    USERINFO: 'https://kapi.kakao.com/v2/user/me', // 🔒 서버 전용
    UNLINK: 'https://kapi.kakao.com/v1/user/unlink', // 🔒 서버 전용
    LOGOUT: 'https://kapi.kakao.com/v1/user/logout', // 🔒 서버 전용
  },
  NAVER: {
    AUTH: OAUTH_AUTH_URLS[OAUTH_PROVIDERS.NAVER],
    TOKEN: 'https://nid.naver.com/oauth2.0/token',
    USERINFO: 'https://openapi.naver.com/v1/nid/me',
  },
  // GOOGLE, NAVER, GITHUB, DISCORD 제거됨 - 사용되지 않음
} as const;

// ==================== 타입 정의 ====================

// Permission 타입 제거됨 - ROLE_PERMISSIONS 사용 않함

// ==================== 클라이언트 보호 코드 ====================

if (typeof window !== 'undefined') {
  throw new Error('Security constants cannot be imported in client-side code');
}

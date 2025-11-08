/**
 * 서버 전용 캐시 관련 상수 정의
 * 캐시 TTL 설정, 네임스페이스, 키 패턴 및 무효화 관리
 *
 * ⚠️  클라이언트 번들에 포함되지 않음
 */

import { TIME_UNITS } from '../time-constants';

// ==================== TTL 설정 (초 단위) ====================

export const CACHE_TTL = {
  // 실제 사용되는 TTL만 유지
  SESSION: {
    REFRESH_TOKEN: (60 * TIME_UNITS.DAY) / 1000, // 60일 - Refresh Token (JWT 갱신용)
  },

  SECURITY: {
    CSRF: (15 * TIME_UNITS.MINUTE) / 1000, // 15분 - CSRF 토큰
    PKCE: (15 * TIME_UNITS.MINUTE) / 1000, // 15분 - PKCE 코드
    LOCK: (10 * TIME_UNITS.SECOND) / 1000, // 10초 - Redis 분산 락
  },

  RATE_LIMIT: {
    WINDOW: TIME_UNITS.MINUTE / 1000, // 1분 - Rate Limiting 윈도우
  },

  CHAT: {
    MESSAGES: (60 * TIME_UNITS.MINUTE) / 1000, // 60분 - 채팅 메시지 캐시
  },
} as const;

// ==================== 캐시 네임스페이스 ====================

export const CACHE_NAMESPACES = {
  RATE_LIMIT: 'rl',
  AUTH: 'au',
  LOCK: 'lk',
  UPLOAD: 'up',
  CHAT: 'c',
  R2: 'r2',
} as const;

// ==================== 캐시 키 빌더 패턴 ====================

export const CACHE_KEYS = {
  // 실제 사용되는 캐시 키만 유지
  rateLimit: {
    ip: (ip: string) => `${CACHE_NAMESPACES.RATE_LIMIT}:ip:${ip}`,
    user: (uid: string) => `${CACHE_NAMESPACES.RATE_LIMIT}:uid:${uid}`,
  },
  chat: {
    messages: (chatId: string) => `${CACHE_NAMESPACES.CHAT}:messages:${chatId}`,
  },

  session: {
    refreshToken: (id: string) => `${CACHE_NAMESPACES.AUTH}:rt:${id}`, // JWT Refresh Token용
    // 확장 프로그램 전용 Refresh Token
    extensionRefreshToken: (userId: string, extensionId: string) =>
      `${CACHE_NAMESPACES.AUTH}:ext:rt:${userId}:${extensionId}`,
    extensionRefreshOwnerMap: (refreshToken: string) =>
      `${CACHE_NAMESPACES.AUTH}:ext:rtmap:${refreshToken}`,
  },

  security: {
    csrf: (id: string) => `${CACHE_NAMESPACES.AUTH}:ct:${id}`,
    pkce: (id: string) => `${CACHE_NAMESPACES.AUTH}:pk:${id}`,
    lock: (id: string) => `${CACHE_NAMESPACES.LOCK}:${id}`,
  },

  upload: {
    process: () => `${CACHE_NAMESPACES.UPLOAD}:process`,
    dailyCount: () => `${CACHE_NAMESPACES.UPLOAD}:dailyCount`,
  },

  r2: {
    downloadUrl: (
      storageKey: string,
      options?: { filename?: string; mimeType?: string; inline?: boolean }
    ): string => {
      const base = `${CACHE_NAMESPACES.R2}:dlurl:${storageKey}`;
      if (!options || (!options.filename && !options.mimeType)) return base;
      const disposition = options.inline ? 'inline' : 'attachment';
      return `${base}:${options.filename ?? ''}:${options.mimeType ?? ''}:${disposition}`;
    },
  },
} as const;

// ==================== 캐시 무효화 패턴 ====================
// 현재 사용되지 않음 - 필요시 구현 예정

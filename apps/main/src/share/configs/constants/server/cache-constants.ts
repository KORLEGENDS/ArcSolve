/**
 * 서버 전용 캐시 관련 상수 정의
 * 캐시 TTL 설정 및 캐시 키 빌더
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

// ==================== Rate Limit 설정 ====================

export const RATE_LIMIT = {
  USER: {
    MAX_REQUESTS: 60, // 사용자당 최대 요청 수
  },
  IP: {
    MAX_REQUESTS: 60, // IP당 최대 요청 수
  },
} as const;

// ==================== 캐시 키 빌더 ====================

export const CacheKey = {
  // Session-related keys
  session: {
    refreshToken: (userId: string) => `session:refresh:${userId}`,
  },
  // Security-related keys
  security: {
    csrf: (tokenId: string) => `security:csrf:${tokenId}`,
    pkce: (codeVerifierId: string) => `security:pkce:${codeVerifierId}`,
    lock: (id: string) => `security:lock:${id}`,
  },
  // Rate limit keys
  rateLimit: {
    user: (userId: string) => `ratelimit:user:${userId}`,
    ip: (ip: string) => `ratelimit:ip:${ip}`,
  },
  // 파일 업로드/다운로드 관련 키
  upload: {
    process: (processId: string) => `upload:process:${processId}`,
  },
  r2: {
    downloadUrl: (
      storageKey: string,
      options?: { filename?: string; mimeType?: string; inline?: boolean }
    ) => {
      const filename = options?.filename ?? '';
      const mimeType = options?.mimeType ?? '';
      const disposition = options?.inline ? 'inline' : 'attachment';
      const suffix = JSON.stringify({ filename, mimeType, disposition });
      return `r2:download:${storageKey}:${suffix}`;
    },
  },
} as const;

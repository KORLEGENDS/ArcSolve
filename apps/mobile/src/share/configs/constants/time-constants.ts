/**
 * 시간 관련 공통 상수 정의
 * 클라이언트와 서버 모두에서 사용되는 시간 관련 설정
 */

// ==================== 기본 시간 단위 (밀리초) ====================

export const TIME_UNITS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000,
} as const;

// ==================== 타임아웃 설정 (밀리초) ====================

export const TIMEOUT = {
  // 네트워크 타임아웃 (클라이언트)
  NETWORK: {
    SHORT: 5 * TIME_UNITS.SECOND, // 5초
    DEFAULT: 30 * TIME_UNITS.SECOND, // 30초
    LONG: 60 * TIME_UNITS.SECOND, // 60초
    VERY_LONG: 5 * TIME_UNITS.MINUTE, // 5분
    RETRY_DELAY: 1 * TIME_UNITS.SECOND, // 1초
  },

  // 캐시 TTL (React Query 등)
  CACHE: {
    SHORT: 1 * TIME_UNITS.MINUTE, // 1분
    MEDIUM: 5 * TIME_UNITS.MINUTE, // 5분
    LONG: 30 * TIME_UNITS.MINUTE, // 30분
  },

  // 재시도 설정
  RETRY: {
    BASE_DELAY: 1 * TIME_UNITS.SECOND, // 1초
    MAX_DELAY: 30 * TIME_UNITS.SECOND, // 30초
    BACKOFF_FACTOR: 2, // 지수 백오프
  },
} as const;


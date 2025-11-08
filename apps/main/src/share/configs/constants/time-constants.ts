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

  // 서버 전용 네트워크 타임아웃
  SERVER: {
    // 서버 내부 통신
    INTERNAL_API: 5 * TIME_UNITS.SECOND, // 내부 API 호출 (5초)
    DATABASE_QUERY: 10 * TIME_UNITS.SECOND, // 데이터베이스 쿼리 (10초)
    CACHE_OPERATION: 2 * TIME_UNITS.SECOND, // 캐시 작업 (2초)

    // 상태 확인
    STATUS_CHECK: 5 * TIME_UNITS.SECOND, // 상태 확인 간격 (5초)
    HEALTH_CHECK: 30 * TIME_UNITS.SECOND, // 헬스 체크 (30초)
    CONNECTION_CHECK: 10 * TIME_UNITS.SECOND, // 연결 상태 확인 (10초)

    // 재시도 설정
    RETRY_DELAY: 500, // 기본 재시도 지연 (500ms)
    EXPONENTIAL_BACKOFF_BASE: 1 * TIME_UNITS.SECOND, // 지수 백오프 기본값 (1초)
    MAX_RETRY_DELAY: 30 * TIME_UNITS.SECOND, // 최대 재시도 지연 (30초)

    // 서버 전용 타임아웃
    BATCH_OPERATION: 2 * TIME_UNITS.MINUTE, // 서버 배치 작업 (2분)
    LOG_PROCESSING: 10 * TIME_UNITS.SECOND, // 로그 처리 (10초)
    FILE_SYNC: 1 * TIME_UNITS.MINUTE, // 파일 동기화 (1분)
  },

  // 캐시 TTL (React Query 등)
  CACHE: {
    SHORT: 1 * TIME_UNITS.MINUTE, // 1분
    MEDIUM: 5 * TIME_UNITS.MINUTE, // 5분
    LONG: 30 * TIME_UNITS.MINUTE, // 30분
    // SESSION 제거됨 - JWT 전략 사용으로 불필요
  },

  // 재시도 설정
  RETRY: {
    BASE_DELAY: 1 * TIME_UNITS.SECOND, // 1초
    MAX_DELAY: 30 * TIME_UNITS.SECOND, // 30초
    BACKOFF_FACTOR: 2, // 지수 백오프
  },
} as const;

// ==================== 세션 설정 ====================
// JWT 전략 사용으로 DB 세션 관리 불필요 - 제거됨

// ==================== 헬퍼 함수 ====================

/**
 * 기간을 사람이 읽기 쉬운 형태로 포맷팅
 * @param milliseconds - 밀리초 단위 기간
 * @returns 포맷된 문자열 (예: "5분", "2시간 30분")
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < TIME_UNITS.MINUTE) {
    return `${Math.round(milliseconds / TIME_UNITS.SECOND)}초`;
  }

  if (milliseconds < TIME_UNITS.HOUR) {
    return `${Math.round(milliseconds / TIME_UNITS.MINUTE)}분`;
  }

  if (milliseconds < TIME_UNITS.DAY) {
    const hours = Math.floor(milliseconds / TIME_UNITS.HOUR);
    const minutes = Math.round(
      (milliseconds % TIME_UNITS.HOUR) / TIME_UNITS.MINUTE
    );
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  }

  const days = Math.floor(milliseconds / TIME_UNITS.DAY);
  const hours = Math.round((milliseconds % TIME_UNITS.DAY) / TIME_UNITS.HOUR);
  return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
}

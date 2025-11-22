import { TIME_UNITS } from '@/share/configs/constants';

/**
 * 🎯 세션 TTL 설정 (Better Auth / 모바일 토큰 공용)
 *
 * - 기존 NextAuth 설정에서 분리된 헬퍼
 * - 서버/모바일 토큰 발급 시 만료 시간 계산에만 사용합니다.
 */
export function getSessionConfig(): {
  maxAge: number;
} {
  return {
    maxAge: 30 * TIME_UNITS.DAY,
  };
}



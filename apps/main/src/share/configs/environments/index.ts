/**
 * 환경변수 모듈 통합 export
 * Edge Runtime 호환성을 위해 스키마와 키만 노출
 */

export * from './keys-constants';
export * from './schemas-constants';

/**
 * 주의사항:
 * - 서버 컴포넌트: import { env } from '@/config/environment/server' (필수)
 * - 클라이언트 컴포넌트: import { clientEnv } from '@/config/environment/client' (필수)
 * - 공통 유틸리티: import { isDevelopmentPath } from '@/config/environment/shared'
 * - 타입 정의: import type { NodeEnv } from '@/config/environment/shared/schemas'
 *
 * ⚠️ 금지: import {} from '@/config/environment' (직접 import)
 *   → Edge Runtime에서 오류 발생, 명시적 경로 사용 필수
 */

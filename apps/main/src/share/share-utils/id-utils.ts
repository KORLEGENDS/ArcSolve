/**
 * ID 생성 유틸리티
 * UUID 및 시스템별 특수 ID 생성을 위한 통합 함수들
 */

/**
 * 표준 UUID v4 생성 (브라우저/Node.js 호환)
 * 모든 엔티티의 id에 사용
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * TanStack Query v5 Query Options Factory
 * 프로젝트 관련 타입 안전한 쿼리 옵션 생성
 * 
 * 공통 타입 및 모든 도메인별 Query Options를 export
 */

// ==================== 공통 타입 정의 ====================

/**
 * 무한 스크롤 파라미터
 * 모든 리스트 API에서 공통으로 사용 (page 제외)
 */
export interface InfiniteListParams {
  limit?: number;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// ==================== 도메인별 Query Options Export ====================

export * from './user';
export * from './chat-room';
export * from './relation';
export * from './document';
export * from './ai';


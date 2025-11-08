// Legacy block removed (duplicated implementations)

import { and, asc, desc, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * PostgreSQL 쿼리 헬퍼 유틸리티
 * MongoDB 쿼리 패턴을 PostgreSQL로 변환하는 공통 함수들
 */

// ==================== 검색 조건 생성 ====================

/**
 * 텍스트 검색 조건 생성 (MongoDB $regex → PostgreSQL ILIKE)
 */
export function buildSearchConditions(
  search: string,
  fields: PgColumn[]
): SQL<unknown> | undefined {
  if (!search.trim()) return undefined;

  const searchTerm = `%${search.trim()}%`;
  return or(...fields.map((field) => ilike(field, searchTerm)));
}

/**
 * 복합 조건 생성 (MongoDB $and → Drizzle and())
 * Drizzle 공식 권장 패턴: undefined 필터링 후 명시적 타입 어설션
 */
export function buildAndConditions(
  conditions: (SQL<unknown> | undefined)[]
): SQL<unknown> {
  const validConditions = conditions.filter(
    (c): c is SQL<unknown> => c !== undefined
  );

  if (validConditions.length === 0) {
    // 조건이 없으면 항상 참인 조건 반환 (모든 레코드 매칭)
    return sql`1=1`;
  }

  if (validConditions.length === 1) return validConditions[0] as SQL<unknown>;

  // 명시적 타입 어설션 - Drizzle 내부 구현과 동일한 패턴
  return and(...(validConditions as SQL<unknown>[])) as SQL<unknown>;
}

// ==================== 페이지네이션 ====================

/**
 * 페이지네이션 옵션 계산
 */
export function getPaginationOptions(
  page = 1,
  limit = 20
): {
  offset: number;
  limit: number;
  page: number;
  pageSize: number;
} {
  const pageNum = Math.max(1, page);
  const limitNum = Math.min(Math.max(1, limit), 100); // 최대 100개 제한

  return {
    offset: (pageNum - 1) * limitNum,
    limit: limitNum,
    page: pageNum,
    pageSize: limitNum,
  };
}

/**
 * 페이지네이션 메타데이터 계산
 */
export function calculatePaginationMeta(
  total: number,
  page: number,
  limit: number
): {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
} {
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// ==================== 정렬 조건 ====================

/**
 * 정렬 조건 생성 (MongoDB sort → Drizzle orderBy)
 *
 * 단순화된 구현:
 * - sortBy는 API 스키마에서 enum으로 검증되므로 항상 유효한 컬럼명
 * - updatedAt 폴백 로직 제거 (실제로 사용되지 않음)
 * - any 타입 사용하되 타입 안전성은 API 스키마 레벨에서 보장
 *
 * @param table - Drizzle 테이블 스키마 객체
 * @param sortBy - 정렬할 컬럼 이름 (API 스키마에서 enum으로 검증됨)
 * @param sortOrder - 정렬 순서 (기본: 'desc')
 * @returns Drizzle 정렬 조건
 */
export function buildSortConditions(
  table: any,
  sortBy: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): SQL<unknown> {
  const column = table[sortBy] as PgColumn;
  return sortOrder === 'asc' ? asc(column) : desc(column);
}

// ==================== 카운트 정규화 ====================

/**
 * 카운트 값을 숫자로 정규화
 * PostgreSQL COUNT() 결과는 문자열로 반환되므로 숫자로 변환
 */
export function normalizeCount(count: unknown): number {
  return typeof count === 'string' ? parseInt(count, 10) : Number(count);
}

// ==================== 타입 헬퍼 ====================

/**
 * 테이블 타입에서 컬럼 추출
 */
export type TableColumns<T> =
  T extends Record<string, infer U> ? (U extends PgColumn ? T : never) : never;

/**
 * 검색 가능한 필드 타입
 */
export type SearchableFields = PgColumn[];

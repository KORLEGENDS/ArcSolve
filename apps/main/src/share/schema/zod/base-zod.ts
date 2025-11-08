/**
 * 기본 모델 스키마 정의
 * 모든 도메인 모델에서 공통으로 사용하는 스키마
 */

import { z } from 'zod';

// ==================== 기본 스키마 ====================

/**
 * UUID v4 패턴 스키마
 */
export const uuidSchema = z.string().uuid();

/**
 * ISO 8601 날짜 문자열 스키마
 */
export const isoDateSchema = z.iso.datetime();

/**
 * 기본 엔티티 스키마 (모든 도메인 모델의 기본 필드)
 */
export const baseSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  deletedAt: isoDateSchema.optional(),
});

// ==================== 공통 도메인 스키마 ====================

/** 파일/노트 공통 항목 타입 */
export const itemTypeSchema = z.enum(['folder', 'item']);

/** 태그 배열 (엄격 검증용) */
export const tagsArraySchema = z.array(z.string());

/** 태그 배열 (매퍼 등 보정 지점에서 안전 기본값 주입) */
export const safeTagsSchema = tagsArraySchema.catch([]);

/** 리스트 전용 공통 필드 모듈화 (확장해서 사용) */
export const baseListItemCore = {
  id: z.string(),
  name: z.string(),
  path: z.string(),
  itemType: itemTypeSchema,
  lastModified: isoDateSchema,
  tags: tagsArraySchema.default([]),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  deletedAt: isoDateSchema.optional(),
} as const;

// ==================== 공통 타입 추론 ====================

export type BaseSchema = z.infer<typeof baseSchema>;
/**
 * UserSchema 도메인 모델 및 Zod 스키마
 * 런타임 타입 검증과 타입 추론을 위한 통합 모델
 */

import { z } from 'zod';
import { baseSchema } from './base-zod';

// ==================== User Preferences 스키마 ====================

// 사용자 개인화 설정
export const userPreferencesSchema = z.object({
  // 언어 및 지역 설정
  locale: z.enum(['ko', 'en']).default('ko'),
  // 테마 설정
  theme: z.enum(['light', 'dark', 'system']).default('system'),
});

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

// ==================== UserSchema 스키마 ====================

// UserSchema 전체 스키마
export const userSchema = baseSchema.extend({
  // 기본 프로필 정보
  email: z.email(),
  name: z.string().min(1).max(100),
  imageUrl: z.string().url().nullable().optional(),

  // 개인화 설정
  preferences: userPreferencesSchema.nullable().optional(),
});

export type UserSchema = z.infer<typeof userSchema>;

// ==================== 재사용 가능한 파생 스키마/타입 ====================

// 서버/응답 메타 등에서 사용하는 경량 사용자 메타 타입
export type UserMeta = { id?: string; email?: string } | undefined;

/**
 * API 계층 타입 정의 (슬림화)
 * 실제 사용되는 표준 API 응답 타입만 유지
 */

import { userRoleSchema } from '@/share/schema/zod/user-zod';
import { z } from 'zod';
import type { StandardApiErrorResponse } from './error-types';

type UserSchemaRole = z.infer<typeof userRoleSchema>;

// ==================== 기본 API 응답 구조 ====================

export interface ApiResponseMeta {
  timestamp: string;
  version: string;
  requestId: string;
  correlationId?: string;
  user?: {
    id: string;
    email: string;
    role: UserSchemaRole;
  };
}

export interface StandardApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta: ApiResponseMeta;
}

// 성공/실패 유니언 응답
export type ApiResponse<T> = StandardApiResponse<T> | StandardApiErrorResponse;

// ==================== 유틸 통합용 추가 타입 ====================

// UserMeta는 user.schema.ts에서 단일 소스로 관리

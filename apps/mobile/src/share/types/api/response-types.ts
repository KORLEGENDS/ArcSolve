/**
 * API 계층 타입 정의 (슬림화)
 * 실제 사용되는 표준 API 응답 타입만 유지
 */

import type { StandardApiErrorResponse } from './error-types';

// ==================== 기본 API 응답 구조 ====================

export interface ApiResponseMeta {
  timestamp: string;
  version: string;
  requestId: string;
  correlationId?: string;
  user?: {
    id: string;
    email: string;
  };
}

export interface StandardApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta: ApiResponseMeta;
}

// StandardApiErrorResponse re-export
export type { StandardApiErrorResponse };

// 성공/실패 유니언 응답
export type ApiResponse<T> = StandardApiResponse<T> | StandardApiErrorResponse;


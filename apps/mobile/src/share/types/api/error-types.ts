/**
 * 핵심 에러 타입 정의
 * 5개의 기본 에러 클래스로 대부분의 시나리오 커버
 */

import type { ApiResponseMeta } from './response-types';

// ==================== 기본 에러 클래스 ====================

export abstract class BaseError extends Error {
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public override readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;

    // V8 스택 추적 최적화 (React Native/TS 환경에서는 타입 단언으로 처리)
    const captureStackTrace = (Error as any).captureStackTrace as
      | ((target: unknown, constructor?: Function) => void)
      | undefined;

    if (typeof captureStackTrace === 'function') {
      captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): {
    name: string;
    message: string;
    statusCode: number;
    stack?: string;
  } {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.stack !== undefined ? { stack: this.stack } : {}),
    };
  }
}

// ==================== 핵심 에러 클래스 (5개) ====================

/**
 * 유효성 검사 에러 (400)
 * 잘못된 입력, 형식 오류 등
 */
export class ValidationError extends BaseError {
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly field?: string,
    cause?: Error
  ) {
    super(message, cause);
  }
}

/**
 * 인증/인가 에러 (401/403)
 * 로그인 필요, 권한 부족 등
 */
export class AuthError extends BaseError {
  readonly statusCode: number;

  constructor(
    message: string,
    type: 'authentication' | 'authorization' = 'authentication',
    cause?: Error
  ) {
    super(message, cause);
    this.statusCode = type === 'authentication' ? 401 : 403;
  }
}

/**
 * 시스템 에러 (500/502)
 * 내부 서버 오류, 외부 서비스 오류 등
 */
export class SystemError extends BaseError {
  readonly statusCode: number;

  constructor(
    message: string,
    type: 'internal' | 'external' = 'internal',
    cause?: Error
  ) {
    super(message, cause);
    this.statusCode = type === 'internal' ? 500 : 502;
  }
}

// ==================== API 에러 표준 타입 ====================

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface StandardApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface StandardApiErrorResponse {
  success: false;
  error: StandardApiError;
  meta: ApiResponseMeta;
}


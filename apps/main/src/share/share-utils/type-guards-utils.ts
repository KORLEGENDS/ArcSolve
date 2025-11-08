/**
 * 런타임 타입 가드 및 검증 유틸리티
 * user.model.ts 기반 Zod 스키마와 연동하여 타입 안전성 제공
 */

// ==================== 기본 타입 가드 ====================

/**
 * 값이 문자열인지 확인
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * 값이 숫자인지 확인
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * 값이 불린인지 확인
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * 값이 배열인지 확인
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * 값이 객체인지 확인 (null 제외)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 값이 함수인지 확인
 */
export function isFunction(
  value: unknown
): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/**
 * 값이 유효한 UUID인지 확인
 */
export function isUUID(value: unknown): value is string {
  if (!isString(value)) return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * 값이 유효한 이메일인지 확인
 */
export function isEmail(value: unknown): value is string {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

// ==================== 에러 타입 가드 ====================

/**
 * 에러 객체인지 확인 (Error 또는 BaseError)
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// ==================== 통합 타입 가드 객체 ====================

/**
 * 모든 타입 가드를 포함하는 통합 객체
 */
export const TypeGuards = {
  // 기본 타입
  isString,
  isNumber,
  isBoolean,
  isArray,
  isObject,
  isFunction,
  isUUID,
  isEmail,

  // 에러
  isError,
} as const;

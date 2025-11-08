/**
 * 외부 API 통합을 위한 유틸리티 함수
 *
 * 외부 시스템(OAuth, 결제, 웹훅 등)과의 통신에서
 * 런타임 타입 안전성을 보장하기 위한 검증 함수들
 */

import { ValidationError } from '@/share/types/api/error-types';
import { z } from 'zod';

// ==================== 외부 API 응답 검증 ====================

/**
 * 외부 API 응답 검증 함수
 *
 * 신뢰할 수 없는 외부 시스템의 응답을 Zod 스키마로 검증하여
 * 타입 안전성을 런타임에서 보장합니다.
 *
 * @param response - 검증할 응답 데이터
 * @param schema - Zod 스키마
 * @returns 검증된 데이터
 * @throws ValidationError - 검증 실패 시
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   access_token: z.string(),
 *   expires_in: z.number()
 * });
 *
 * const validated = await validateApiResponse(apiResponse, schema);
 * // validated는 이제 타입 안전함
 * ```
 */
export async function validateApiResponse<T>(
  response: unknown,
  schema: z.ZodType<T>
): Promise<T> {
  const result = await schema.safeParseAsync(response);

  if (!result.success) {
    // Zod v4: error.issues 사용
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    });

    // 에러 메시지에 구체적인 검증 실패 내용 포함
    const errorMessage =
      errors.length > 0
        ? `Invalid API response: ${errors.join(', ')}`
        : 'Invalid API response';

    throw new ValidationError(errorMessage, 'response', result.error);
  }

  return result.data;
}

// ==================== API 에러 정규화 ====================

/**
 * useChat 등에서 전달되는 에러를 정규화하여 UI에서 처리하기 쉬운 형태로 반환
 * - JSON 문자열이면 파싱하여 객체 반환
 * - `{ success: false }` 표준 에러 포맷이면 그대로 유지
 * - 그 외에는 원본 값을 유지
 */
export function normalizeApiError(error: unknown): unknown {
  if (error == null) return error ?? undefined;

  const maybeString = typeof error === 'string'
    ? error
    : error instanceof Error && typeof error.message === 'string'
      ? error.message
      : null;

  if (maybeString) {
    const trimmed = maybeString.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && (parsed as { success?: unknown }).success === false) {
          return parsed;
        }
      } catch {
        // JSON 파싱 실패 시 원본 문자열 유지
      }
    }
  }

  if (typeof error === 'object' && error !== null) {
    return error;
  }

  return maybeString ?? error;
}

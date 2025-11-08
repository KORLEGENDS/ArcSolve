import type { ApiErrorCode } from '@/share/types/api/error-types';

export const HTTP_STATUS_BY_ERROR_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class ApiException extends Error {
  public readonly code: ApiErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
    this.details = details ?? {};
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

export function throwApi(code: ApiErrorCode, message: string, details?: Record<string, unknown>): never {
  throw new ApiException(code, message, details);
}



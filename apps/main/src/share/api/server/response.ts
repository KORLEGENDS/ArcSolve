import { HTTP_STATUS_BY_ERROR_CODE } from '@/share/api/server/errors';
import type { UserMeta } from '@/share/schema/zod/user-zod';
import { generateUUID } from '@/share/share-utils/id-utils';
import type { StandardApiError, StandardApiErrorResponse } from '@/share/types/api/error-types';
import type { ApiResponseMeta, StandardApiResponse } from '@/share/types/api/response-types';
import { NextResponse } from 'next/server';

type BuildMetaInput = { user?: UserMeta; correlationId?: string } | undefined;

function buildMeta(input?: BuildMetaInput): ApiResponseMeta {
  return {
    timestamp: new Date().toISOString(),
    version: '1.0',
    requestId: generateUUID(),
    correlationId: input?.correlationId,
    user: input?.user?.id && input.user.email
      ? { id: input.user.id, email: input.user.email }
      : undefined,
  };
}

function buildOkBody<T>(data: T, opts?: { user?: UserMeta; correlationId?: string; message?: string }): StandardApiResponse<T> {
  return { success: true, data, message: opts?.message, meta: buildMeta(opts) };
}

function buildErrorBody(
  code: StandardApiError['code'],
  message: string,
  opts?: { user?: UserMeta; correlationId?: string; details?: Record<string, unknown> }
): StandardApiErrorResponse {
  const error: StandardApiError = { code, message, details: opts?.details };
  return { success: false, error, meta: buildMeta(opts) };
}

// New simplified APIs: Prefer these in route handlers
export function ok<T>(data: T, opts?: { user?: UserMeta; correlationId?: string; message?: string }): Response {
  const body = buildOkBody<T>(data, opts);
  return NextResponse.json(body, { status: 200 });
}

export function error(
  code: StandardApiError['code'],
  message: string,
  opts?: { user?: UserMeta; correlationId?: string; details?: Record<string, unknown> }
): Response {
  const body = buildErrorBody(code, message, opts);
  const status = HTTP_STATUS_BY_ERROR_CODE[code];
  return NextResponse.json(body, { status });
}



'use client';

import type { ApiErrorCode } from '@/share/types/api/error-types';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast as sonnerToast } from 'sonner';

/** 클라이언트 표준 에러 객체 */
export interface ApiClientError {
  code?: ApiErrorCode;
  httpStatus?: number;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
  correlationId?: string;
  raw?: unknown;
}

export interface UseAPIRenderOptions {
  /** 토스트 제목을 오버라이드 */
  title?: string;
  /** 토스트 설명을 오버라이드 */
  description?: string;
}

export interface UseAPIOptions {
  /** 사용 맥락(도메인) - 메시지 커스터마이즈 용 */
  domain?: 'chat' | 'note' | 'file' | 'event' | 'project' | string;
  /** 동일 에러 중복 토스트 방지 시간(ms) */
  dedupeWithinMs?: number;
}

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
  501: 'INTERNAL',
  502: 'INTERNAL',
  503: 'INTERNAL',
  504: 'INTERNAL',
};

function deriveStatusFromMessage(message: string | undefined): number | undefined {
  if (!message) return undefined;
  // "HTTP 404: Not Found" 또는 "API Request Failed: HTTP 404: Not Found" 등에서 추출
  const match = /HTTP\s+(\d{3})/i.exec(message) ?? /(\b[45]??\d{2}\b)/.exec(message);
  const status = match ? Number(match[1]) : NaN;
  return Number.isNaN(status) ? undefined : status;
}

function mapStatusToTitle(status?: number, code?: ApiErrorCode): string {
  if (code === 'UNAUTHORIZED' || status === 401) return '인증이 필요합니다';
  if (code === 'FORBIDDEN' || status === 403) return '권한이 없습니다';
  if (code === 'NOT_FOUND' || status === 404) return '리소스를 찾을 수 없습니다';
  if (code === 'BAD_REQUEST' || status === 400) return '요청이 잘못되었습니다';
  if (code === 'RATE_LIMITED' || status === 429) return '요청이 너무 많거나, 남은 사용량 부족합니다.';
  if (status && status >= 500) return '서버 오류가 발생했습니다';
  return '요청이 실패했습니다';
}

function normalizeUnknownError(error: unknown): ApiClientError {
  // 1) query-builder에서 throw한 표준 API 에러 구조
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    // ex) { code: 'RATE_LIMITED', message: '...', details: {...}, httpStatus: 429, ... }
    if ('code' in obj && 'message' in obj && 'httpStatus' in obj) {
      return {
        code: obj.code as ApiErrorCode,
        httpStatus: obj.httpStatus as number,
        message: String(obj.message),
        details: (obj.details as Record<string, unknown> | undefined) ?? undefined,
        requestId: (obj.requestId as string | undefined) ?? undefined,
        correlationId: (obj.correlationId as string | undefined) ?? undefined,
        raw: obj.raw,
      };
    }
    
    // 2) 서버 표준 에러 응답 형태(StandardApiErrorResponse)
    // ex) { success: false, error: { code, message, details }, meta: { ... } }
    if (obj.success === false && typeof obj.error === 'object' && obj.error !== null) {
      const err = obj.error as Record<string, unknown>;
      const meta = (obj.meta as Record<string, unknown>) ?? {};
      const message = String(err.message ?? '요청 처리 중 오류가 발생했습니다');
      const code = err.code as ApiErrorCode | undefined;
      
      // 코드에서 HTTP 상태 추론
      const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
        UNPROCESSABLE: 422,
        RATE_LIMITED: 429,
        INTERNAL: 500,
      };
      
      return {
        code,
        httpStatus: code ? STATUS_BY_CODE[code] : undefined,
        message,
        details: (err.details as Record<string, unknown> | undefined) ?? undefined,
        requestId: (meta.requestId as string | undefined) ?? undefined,
        correlationId: (meta.correlationId as string | undefined) ?? undefined,
        raw: error,
      };
    }
  }

  // 2) Error 인스턴스
  if (error instanceof Error) {
    const status = deriveStatusFromMessage(error.message);
    const code = status ? STATUS_TO_CODE[status] : undefined;
    return {
      code,
      httpStatus: status,
      message: error.message || '요청 처리 중 오류가 발생했습니다',
      raw: error,
    };
  }

  // 3) 문자열
  if (typeof error === 'string') {
    const status = deriveStatusFromMessage(error);
    const code = status ? STATUS_TO_CODE[status] : undefined;
    return {
      code,
      httpStatus: status,
      message: error,
      raw: error,
    };
  }

  // 4) 그 외: 안전 디폴트
  return {
    code: undefined,
    httpStatus: undefined,
    message: '요청 처리 중 오류가 발생했습니다',
    raw: error,
  };
}

export function useAPI(options?: UseAPIOptions) {
  const dedupeWithinMs = options?.dedupeWithinMs ?? 1500;

  const lastToastSigRef = useRef<string | null>(null);
  const lastToastAtRef = useRef<number>(0);

  const parse = useCallback((e: unknown): ApiClientError => normalizeUnknownError(e), []);

  const buildToastPayload = useCallback((err: ApiClientError, renderOpts?: UseAPIRenderOptions): { title: string; description: string } => {
    const title = renderOpts?.title ?? mapStatusToTitle(err.httpStatus, err.code);
    const description = renderOpts?.description ?? (err.message || '요청 처리 중 오류가 발생했습니다');
    return { title, description };
  }, []);

  const showToast = useCallback((e: unknown, renderOpts?: UseAPIRenderOptions): void => {
    const norm = parse(e);
    const { title, description } = buildToastPayload(norm, renderOpts);

    // 중복 토스트 방지
    const signature = `${norm.code ?? 'UNKNOWN'}|${norm.httpStatus ?? 'NA'}|${description}`;
    const now = Date.now();
    if (lastToastSigRef.current === signature && now - lastToastAtRef.current < dedupeWithinMs) {
      return;
    }
    lastToastSigRef.current = signature;
    lastToastAtRef.current = now;

    // ArcState 토스트 스타일과 일관성 유지 목적: error 레벨 기본값
    sonnerToast.error(title, { description });
  }, [buildToastPayload, dedupeWithinMs, parse]);

  return useMemo(() => ({ parse, showToast }), [parse, showToast]);
}

export default useAPI;

// ==================== 안전한 에러 토스트 훅들 ====================

/**
 * 에러 토스트를 표시하는 안전한 훅
 * 훅 규칙을 준수하여 최상위에서만 호출됩니다
 */
export function useErrorToast(params: { 
  shouldShow?: boolean; 
  error?: unknown; 
  renderOpts?: UseAPIRenderOptions 
}) {
  const { showToast } = useAPI();
  const { shouldShow, error, renderOpts } = params;
  
  useEffect(() => {
    if (shouldShow && error) {
      showToast(error, renderOpts);
    }
  }, [shouldShow, error, renderOpts, showToast]);
}

/**
 * React Query 에러를 처리하는 안전한 훅
 */
export function useQueryErrorToast(params: { 
  isError?: boolean; 
  error?: unknown; 
  renderOpts?: UseAPIRenderOptions 
}) {
  useErrorToast({ 
    shouldShow: Boolean(params?.isError && params?.error), 
    error: params?.error, 
    renderOpts: params?.renderOpts 
  });
}

/**
 * React Mutation 에러를 처리하는 안전한 훅
 */
export function useMutationErrorToast(params: { 
  isError?: boolean; 
  error?: unknown; 
  renderOpts?: UseAPIRenderOptions 
}) {
  useErrorToast({ 
    shouldShow: Boolean(params?.isError && params?.error), 
    error: params?.error, 
    renderOpts: params?.renderOpts 
  });
}



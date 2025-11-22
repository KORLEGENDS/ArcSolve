/**
 * TanStack Query v5 범용 API 쿼리 빌더
 * 표준화된 API 응답 파싱 및 에러 처리 유틸리티
 */

import { TIMEOUT } from '@/share/configs/constants/time-constants';
import { apiClient, extractApiData } from '../api/client';
import type { StandardApiResponse } from '@/share/types/api/response-types';

/**
 * React Query 통합 API 옵션 생성기
 * 타입 안전성 + 재사용성 + 성능 최적화 통합 솔루션
 */
export const createApiQueryOptions = <TData, TApiData>(
  url: string,
  dataExtractor: (apiData: TApiData) => TData,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
  }
): {
  queryFn: (context?: { signal?: AbortSignal }) => Promise<TData>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
} => ({
  queryFn: async (context?: { signal?: AbortSignal }): Promise<TData> => {
    const result = await apiClient<TApiData>(url, {
      method: options?.method ?? 'GET',
      headers: options?.headers,
      body: options?.body,
      signal: context?.signal,
    });
    return dataExtractor(result);
  },
  enabled: options?.enabled,
  staleTime: options?.staleTime ?? TIMEOUT.CACHE.MEDIUM,
  gcTime: options?.gcTime ?? TIMEOUT.CACHE.LONG,
});

/**
 * 뮤테이션용 API 호출 유틸리티
 * POST/PUT/PATCH/DELETE 요청에 특화된 헬퍼
 */
export const createApiMutation = <TData, TApiData, TVariables = unknown>(
  urlBuilder: (variables: TVariables) => string,
  dataExtractor: (apiData: TApiData) => TData,
  options?: {
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    bodyExtractor?: (variables: TVariables) => unknown;
  }
): {
  mutationFn: (variables: TVariables) => Promise<TData>;
} => ({
  mutationFn: async (variables: TVariables): Promise<TData> => {
    const url = urlBuilder(variables);
    const method = options?.method ?? 'POST';

    // bodyExtractor가 제공된 경우 사용, 아니면 전체 variables 사용
    const bodyData = options?.bodyExtractor
      ? options.bodyExtractor(variables)
      : variables;

    const result = await apiClient<TApiData>(url, {
      method,
      headers: options?.headers,
      body: bodyData,
    });

    return dataExtractor(result);
  },
});


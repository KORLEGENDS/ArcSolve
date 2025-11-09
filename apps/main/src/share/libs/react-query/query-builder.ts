/**
 * TanStack Query v5 범용 API 쿼리 빌더
 * 표준화된 API 응답 파싱 및 에러 처리 유틸리티
 */

import type { StandardApiResponse } from '@/share/types/api/response-types';
import { TIME_UNITS, TIMEOUT } from '@/share/configs/constants/time-constants';

/**
 * 경량화된 API 데이터 추출 유틸리티
 * 최소 검증으로 성능 최적화
 */
export const extractApiData = <T>(response: StandardApiResponse<T>): T => {
  if (!response?.success || response.data === undefined) {
    const errorMessage =
      response && 'error' in response && typeof response.error === 'string'
        ? response.error
        : 'API request failed';
    throw new Error(errorMessage);
  }

  return response.data;
};

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
    const response = await fetch(url, {
      method: options?.method ?? 'GET',
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers ?? {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: context?.signal,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData: unknown = await response.json();
        if (errorData && typeof errorData === 'object' && 'error' in errorData) {
          const err = (errorData as any).error;
          if (typeof err === 'string') errorMessage = err;
          else if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
            errorMessage = err.message;
          }
        }
      } catch {
        // JSON 파싱 실패 시 기본 에러 메시지 사용
      }
      throw new Error(`API Request Failed: ${errorMessage}`);
    }

    const result = (await response.json()) as StandardApiResponse<TApiData>;
    const apiData = extractApiData(result);
    return dataExtractor(apiData);
  },
  enabled: options?.enabled,
  staleTime: options?.staleTime,
  gcTime: options?.gcTime,
});

/**
 * 뮤테이션용 API 호출 유틸리티
 * POST/PUT/PATCH/DELETE 요청에 특화된 헬퍼
 * 낙관적 업데이트 훅 지원 추가
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

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: method !== 'DELETE' ? JSON.stringify(bodyData) : undefined,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (errorData && typeof errorData === 'object' && 'error' in errorData) {
        const err = (errorData as any).error;
        if (typeof err === 'string') errorMessage = err;
        else if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
          errorMessage = err.message;
        }
      }
      
      // 표준 에러 응답 구조를 보존하여 throw
      const apiError = {
        code: (errorData as any)?.error?.code ?? 'UNKNOWN',
        message: errorMessage,
        details: (errorData as any)?.error?.details ?? {},
        httpStatus: response.status,
        requestId: (errorData as any)?.meta?.requestId,
        correlationId: (errorData as any)?.meta?.correlationId,
        raw: errorData,
      };
      
      throw apiError;
    }

    const result = (await response.json()) as StandardApiResponse<TApiData>;
    const apiData = extractApiData(result);
    return dataExtractor(apiData);
  },
});
/**
 * 페이지네이션 응답 타입
 */
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * API 리스트 응답 타입
 */
interface ApiListResponse<T> {
  [key: string]: T[] | PaginationMeta | unknown;
  pagination: PaginationMeta;
}

// ==================== 무한 스크롤 타입 정의 ====================

/**
 * 무한 스크롤 페이지 파라미터 타입
 */
export interface InfinitePageParam {
  page: number;
  limit: number;
}

/**
 * 무한 스크롤 응답 타입 (오프셋 기반)
 */
export interface InfinitePaginationResponse<T> {
  items: T[];
  pagination: PaginationMeta & {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * 무한 스크롤 설정 타입
 */
export interface InfiniteQueryConfig<
  _TModel,
  _TParams = Record<string, unknown>,
> {
  baseUrl: string;
  modelKey: string;
  defaultLimit?: number;
  maxPages?: number;
  staleTime?: number;
  gcTime?: number;
  retryDelay?: (attemptIndex: number) => number;
}

// ==================== 무한 스크롤 쿼리 빌더 ====================

/**
 * 무한 스크롤 쿼리 옵션 생성기
 * 오프셋 기반 페이지네이션으로 무한 스크롤 구현
 *
 * @example
 * const infiniteOptions = createInfiniteQueryOptions<ProjectSchema>({
 *   baseUrl: '/api/project',
 *   modelKey: 'projects',
 *   defaultLimit: 20,
 * });
 */
export const createInfiniteQueryOptions = <
  TModel,
  TParams = Record<string, unknown>,
>(
  config: InfiniteQueryConfig<TModel, TParams>
) => {
  return (
    params?: Omit<TParams, 'page' | 'limit'>
  ): {
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: InfinitePageParam;
      signal?: AbortSignal;
    }) => Promise<InfinitePaginationResponse<TModel>>;
    initialPageParam: InfinitePageParam;
    getNextPageParam: (
      lastPage: InfinitePaginationResponse<TModel>
    ) => InfinitePageParam | undefined;
    getPreviousPageParam: (
      firstPage: InfinitePaginationResponse<TModel>
    ) => InfinitePageParam | undefined;
    maxPages: number;
    staleTime: number;
    gcTime: number;
    retry: (failureCount: number, error: Error) => boolean;
    retryDelay: (attemptIndex: number) => number;
  } => ({
    queryFn: async ({
      pageParam,
      signal,
    }: {
      pageParam: InfinitePageParam;
      signal?: AbortSignal;
    }): Promise<InfinitePaginationResponse<TModel>> => {
      const queryParams = {
        ...params,
        page: pageParam.page,
        limit: pageParam.limit,
      };

      // 페이지네이션 쿼리 스트링 빌더 (내부 함수로 통합)
      const buildQueryString = (params?: Record<string, unknown>): string => {
        if (!params) return '';
        const keys = Object.keys(params).filter((k) => params[k] !== undefined);
        keys.sort();
        const sp = new URLSearchParams();
        for (const key of keys) {
          const value = params[key];
          if (Array.isArray(value)) {
            value
              .filter((v) => v !== undefined && v !== null && String(v).length > 0)
              .forEach((v) => sp.append(key, String(v)));
          } else {
            sp.append(key, String(value as unknown));
          }
        }
        const s = sp.toString();
        return s ? `?${s}` : '';
      };

      const url = `${config.baseUrl}${buildQueryString(queryParams as Record<string, unknown>)}`;

      const response = await fetch(url, { signal });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData: unknown = await response.json();
          if (
            errorData &&
            typeof errorData === 'object' &&
            'error' in errorData &&
            typeof errorData.error === 'string'
          ) {
            errorMessage = errorData.error;
          }
        } catch {
          // JSON 파싱 실패 시 기본 메시지 사용
        }
        throw new Error(`Infinite Query Failed: ${errorMessage}`);
      }

      const result = (await response.json()) as StandardApiResponse<
        ApiListResponse<TModel>
      >;
      const apiData = extractApiData(result);

      // 서버에서 통일된 키 'items'를 사용하도록 계약
      const items = (apiData as any)[config.modelKey] as TModel[];

      return {
        items,
        pagination: {
          ...apiData.pagination,
          hasNextPage: apiData.pagination.page < apiData.pagination.totalPages,
          hasPreviousPage: apiData.pagination.page > 1,
        },
      };
    },
    initialPageParam: {
      page: 1,
      limit: config.defaultLimit ?? 20,
    } as InfinitePageParam,
    getNextPageParam: (
      lastPage: InfinitePaginationResponse<TModel>
    ): InfinitePageParam | undefined => {
      return lastPage.pagination.hasNextPage
        ? {
            page: lastPage.pagination.page + 1,
            limit: lastPage.pagination.limit,
          }
        : undefined;
    },
    getPreviousPageParam: (
      firstPage: InfinitePaginationResponse<TModel>
    ): InfinitePageParam | undefined => {
      return firstPage.pagination.hasPreviousPage
        ? {
            page: firstPage.pagination.page - 1,
            limit: firstPage.pagination.limit,
          }
        : undefined;
    },
    maxPages: config.maxPages ?? 10,
    staleTime: config.staleTime ?? TIMEOUT.CACHE.MEDIUM, // 5분
    gcTime: config.gcTime ?? TIMEOUT.CACHE.LONG, // 30분
    retry: (failureCount: number, error: Error): boolean => {
      // HTTP 상태코드 추출(메시지 기반): 4xx 전부 미재시도
      const match = /HTTP\s+(\d{3})/i.exec(error.message) ?? /(\d{3})/.exec(error.message);
      const status = match ? Number(match[1]) : NaN;
      if (!Number.isNaN(status) && status >= 400 && status < 500) return false;
      return failureCount < 3;
    },
    retryDelay:
      config.retryDelay ??
      ((attemptIndex: number): number =>
        Math.min(
          TIMEOUT.RETRY.BASE_DELAY *
            TIMEOUT.RETRY.BACKOFF_FACTOR ** attemptIndex,
          TIMEOUT.RETRY.MAX_DELAY
        )),
  });
};

/**
 * 경로 기반 쿼리 옵션 생성기
 * 파일 시스템 경로를 통한 모델 조회
 */
export const createPathQueryOptions =
  <TModel>(
    queryKeyFn: (path: string) => readonly string[],
    endpoint: string,
    modelKey: string
  ): ((path: string) => {
    queryKey: readonly string[];
    queryFn: () => Promise<TModel[]>;
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
  }) =>
  (path: string) => ({
    queryKey: queryKeyFn(path),
    ...createApiQueryOptions(
      `${endpoint}?path=${encodeURIComponent(path)}`,
      (data: Record<string, TModel[]>) => data[modelKey] as TModel[],
      {
        enabled: !!path,
        staleTime: 2 * TIME_UNITS.MINUTE, // 2분
        gcTime: 15 * TIME_UNITS.MINUTE, // 15분
      }
    ),
  });

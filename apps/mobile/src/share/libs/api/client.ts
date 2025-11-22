/**
 * API 클라이언트
 * fetch 래퍼로 쿠키 자동 포함 및 표준 응답 구조 파싱
 */

import { useAuthStore } from '@/client/states/stores/auth-store';
import { API_BASE_URL } from '@/share/configs/environments/client-constants';
import { clearRefreshToken, getRefreshToken, saveRefreshToken } from '@/share/share-utils/session-utils';
import type { StandardApiErrorResponse } from '@/share/types/api/error-types';
import type { StandardApiResponse } from '@/share/types/api/response-types';

export interface ApiClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

// 토큰 갱신 중복 방지를 위한 플래그 및 Promise
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Refresh Token으로 Access Token 갱신
 */
async function refreshAccessToken(): Promise<string | null> {
  // 이미 갱신 중이면 기존 Promise 반환
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/mobile/token/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // Refresh 실패 → 토큰 삭제 및 로그아웃
        await clearRefreshToken();
        useAuthStore.getState().clearAuth();
        return null;
      }

      const result = (await response.json()) as StandardApiResponse<{
        accessToken: string;
        refreshToken?: string;
        expiresIn: string;
        expiresAt: number;
        user: {
          id: string;
          email?: string;
          name?: string;
          image?: string;
        };
      }> | StandardApiErrorResponse;
      
      const data = extractApiData(result);
      const { accessToken, refreshToken: newRefreshToken, user } = data;

      if (!accessToken || !user) {
        throw new Error('Invalid refresh response');
      }

      // 새 Access Token과 사용자 정보를 전역 상태에 저장
      useAuthStore.getState().setAuth(user, accessToken);

      // 새 Refresh Token이 있으면 저장
      if (newRefreshToken) {
        await saveRefreshToken(newRefreshToken);
      }

      return accessToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      await clearRefreshToken();
      useAuthStore.getState().clearAuth();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * API 데이터 추출 유틸리티
 */
export function extractApiData<T>(response: StandardApiResponse<T> | StandardApiErrorResponse): T {
  if (!response || 'error' in response) {
    const errorMessage =
      response && 'error' in response && typeof response.error === 'object'
        ? response.error.message || 'API request failed'
        : 'API request failed';
    throw new Error(errorMessage);
  }

  if (!response.success || response.data === undefined) {
    throw new Error('API request failed');
  }

  return response.data;
}

/**
 * API 클라이언트
 * React Native에서는 쿠키가 자동으로 포함되지 않으므로,
 * 액세스 토큰을 Authorization 헤더에 포함하여 인증합니다.
 */
export async function apiClient<TData>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<TData> {
  const { method = 'GET', headers = {}, body, signal } = options;

  // 액세스 토큰 가져오기 (전역 상태에서)
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    // 401 에러 시 토큰 갱신 시도
    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        // 토큰 갱신 실패 → 인증 에러
        const authError = new Error('Authentication failed');
        (authError as any).status = 401;
        throw authError;
      }

      // 토큰 갱신 성공 → 원래 요청 재시도
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });

      if (!retryResponse.ok) {
        let errorMessage = `HTTP ${retryResponse.status}: ${retryResponse.statusText}`;
        try {
          const errorData: unknown = await retryResponse.json();
          if (errorData && typeof errorData === 'object' && 'error' in errorData) {
            const err = (errorData as any).error;
            if (typeof err === 'string') {
              errorMessage = err;
            } else if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
              errorMessage = err.message;
            }
          }
        } catch {
          // JSON 파싱 실패 시 기본 에러 메시지 사용
        }

        // 재시도 실패
        if (retryResponse.status === 401) {
          const authError = new Error('Authentication failed');
          (authError as any).status = 401;
          throw authError;
        }

        throw new Error(`API Request Failed: ${errorMessage}`);
      }

      // 재시도 성공
      const result = (await retryResponse.json()) as StandardApiResponse<TData> | StandardApiErrorResponse;
      return extractApiData(result);
    }

    // 401이 아닌 다른 에러
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData: unknown = await response.json();
      if (errorData && typeof errorData === 'object' && 'error' in errorData) {
        const err = (errorData as any).error;
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
          errorMessage = err.message;
        }
      }
    } catch {
      // JSON 파싱 실패 시 기본 에러 메시지 사용
    }

    throw new Error(`API Request Failed: ${errorMessage}`);
  }

  const result = (await response.json()) as StandardApiResponse<TData> | StandardApiErrorResponse;
  return extractApiData(result);
}


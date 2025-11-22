/**
 * 인증 관련 React Query 훅들
 */

import { useAuthStore } from '@/client/states/stores/auth-store';
import { API_BASE_URL } from '@/share/configs/environments/client-constants';
import type { OAuthProvider } from '@/share/libs/auth/oauth-config';
import { queryKeys } from '@/share/libs/react-query/query-keys';
import { authQueryOptions } from '@/share/libs/react-query/query-options/auth';
import { logoutWithCacheClear } from '@/share/providers/client/auth-provider';
import {
  clearRefreshToken,
  saveRefreshToken,
  saveSession,
} from '@/share/share-utils/session-utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { authClient } from '@/share/libs/auth/better-auth-client';
import { extractApiData } from '@/share/libs/api/client';
import type { StandardApiErrorResponse } from '@/share/types/api/error-types';
import type { StandardApiResponse } from '@/share/types/api/response-types';

/**
 * 현재 세션 조회 훅
 */
export function useSession() {
  return useQuery(authQueryOptions.session);
}

/**
 * 소셜 로그인 훅
 * WebView를 통해 웹 로그인 페이지를 엽니다.
 */
export function useSocialLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const mutation = useMutation({
    mutationFn: async (provider: OAuthProvider) => {
      // 1. Better Auth를 통한 소셜 로그인 (Expo 플러그인이 WebBrowser + 딥링크 처리)
      await authClient.signIn.social({
        provider,
        callbackURL: '/(app)', // arcsolve:///(app) 딥링크로 변환됨
      });

      // 2. Better Auth 세션 쿠키를 포함하여 모바일 전용 토큰 발급
      const cookies = authClient.getCookie?.();

      const tokenResponse = await fetch(`${API_BASE_URL}/api/auth/mobile/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookies ? { Cookie: cookies } : {}),
        },
      });

      if (!tokenResponse.ok) {
        throw new Error('토큰 발급에 실패했습니다.');
      }

      const tokenResult = (await tokenResponse.json()) as StandardApiResponse<{
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

      const tokenData = extractApiData(tokenResult);

      // 3. Refresh Token을 SecureStore에 저장
      if (tokenData.refreshToken) {
        await saveRefreshToken(tokenData.refreshToken);
      }

      // 4. Better Auth 세션 조회 (선택) 및 사용자 정보 결정
      const { data: session } = await authClient.getSession();
      const user = session?.user ?? tokenData.user;

      if (!user || !tokenData.accessToken) {
        await clearRefreshToken();
        throw new Error('로그인 처리에 실패했습니다. 다시 시도해주세요.');
      }

      // 5. Access Token과 사용자 정보를 전역 상태에 저장 (메모리)
      setAuth(user, tokenData.accessToken);

      // 6. 세션 정보도 SecureStore에 저장 (호환성 유지)
      await saveSession({ user });

      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });

      // 7. Expo Router로 홈 화면 이동
      router.replace('/(app)');

      return { user };
    },
  });

  return {
    login: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * 로그아웃 훅
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const logout = useCallback(async () => {
    await logoutWithCacheClear(queryClient);
    // 로그아웃 후 로그인 화면으로 이동
    router.replace('/(auth)/login');
  }, [queryClient, router]);

  return logout;
}


/**
 * 인증 관련 React Query 훅들
 */

import { useAuthStore } from '@/client/states/stores/auth-store';
import { API_BASE_URL } from '@/share/configs/environments/client-constants';
import type { OAuthProvider } from '@/share/libs/auth/oauth-config';
import { getAuthUrl } from '@/share/libs/auth/oauth-config';
import { queryKeys } from '@/share/libs/react-query/query-keys';
import { authQueryOptions } from '@/share/libs/react-query/query-options/auth';
import { logoutWithCacheClear } from '@/share/providers/client/auth-provider';
import {
    clearRefreshToken,
    saveRefreshToken,
    saveSession
} from '@/share/share-utils/session-utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';

// WebBrowser 완료 후 인증 상태를 올바르게 처리하기 위해 설정
WebBrowser.maybeCompleteAuthSession();

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
      const authUrl = getAuthUrl(provider);
      
      // WebView를 통해 로그인 페이지 열기
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        `${API_BASE_URL}/api/auth/callback/${provider}`
      );

      if (result.type === 'success') {
        // 로그인 성공 후 세션 확인 및 토큰 발급
        try {
          // 1. 모바일 앱용 토큰 발급 (Access Token + Refresh Token)
          // 참고: 서버 측에서 `/api/auth/mobile/token` 엔드포인트를 구현해야 합니다.
          const tokenResponse = await fetch(`${API_BASE_URL}/api/auth/mobile/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!tokenResponse.ok) {
            throw new Error('토큰 발급에 실패했습니다.');
          }

          const tokenData = await tokenResponse.json();
          
          // 2. Refresh Token을 SecureStore에 저장
          if (tokenData.refreshToken) {
            await saveRefreshToken(tokenData.refreshToken);
          }
          
          // 3. 세션 정보 조회 (Access Token 사용)
          const sessionResponse = await fetch(`${API_BASE_URL}/api/auth/session`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenData.accessToken}`,
            },
          });

          if (!sessionResponse.ok) {
            throw new Error('세션 조회에 실패했습니다.');
          }

          const sessionData = await sessionResponse.json();
          const session = sessionData.data || sessionData;
          
          // 4. Access Token과 사용자 정보를 전역 상태에 저장 (메모리)
          setAuth(session.user, tokenData.accessToken);
          
          // 5. 세션 정보도 SecureStore에 저장 (선택사항, 호환성 유지)
          await saveSession(session);
          
          queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });
          
          // 6. Expo Router로 홈 화면 이동
          router.replace('/(app)');
          
          return session;
        } catch (error) {
          console.error('Login error:', error);
          // 에러 발생 시 Refresh Token도 삭제
          await clearRefreshToken();
          throw new Error('로그인 처리에 실패했습니다. 다시 시도해주세요.');
        }
      }

      throw new Error('로그인이 취소되었거나 실패했습니다.');
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


/**
 * 인증 Provider
 * 세션 상태 관리 및 인증 에러 처리
 */

import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { clearSession, getSession, saveSession, clearRefreshToken, getRefreshToken, saveRefreshToken } from '@/share/share-utils/session-utils';
import { authQueryOptions } from '@/share/libs/react-query/query-options/auth';
import { queryKeys } from '@/share/libs/react-query/query-keys';
import { useAuthStore } from '@/client/states/stores/auth-store';
import { API_BASE_URL } from '@/share/configs/environments/client-constants';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 인증 Provider - 세션 관리 및 인증 에러 처리
 */
export function AuthProvider({ children }: AuthProviderProps): ReactNode {
  const queryClient = useQueryClient();
  const { setAuth, setLoading, clearAuth } = useAuthStore();
  const [isBootstrapComplete, setIsBootstrapComplete] = useState(false);

  // 앱 시작 시 토큰 복원 (Bootstrap)
  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);

        // 1. SecureStore에서 Refresh Token 확인
        const refreshToken = await getRefreshToken();

        if (!refreshToken) {
          // Refresh Token 없음 → 로그인 안 된 상태
          setIsBootstrapComplete(true);
          setLoading(false);
          return;
        }

        // 2. Refresh Token으로 Access Token 갱신 시도
        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (!refreshResponse.ok) {
            // Refresh 실패 → 토큰 삭제 및 로그아웃
            await clearRefreshToken();
            await clearSession();
            clearAuth();
            setIsBootstrapComplete(true);
            setLoading(false);
            return;
          }

          // 3. 새 Access Token 및 사용자 정보 받기
          const refreshData = await refreshResponse.json();
          const { accessToken, refreshToken: newRefreshToken, user } = refreshData;

          if (!accessToken || !user) {
            throw new Error('Invalid refresh response');
          }

          // 4. 새 Refresh Token이 있으면 저장
          if (newRefreshToken) {
            await saveRefreshToken(newRefreshToken);
          }

          // 5. Access Token과 사용자 정보를 전역 상태에 저장
          setAuth(user, accessToken);

          // 6. 세션 정보도 SecureStore에 저장 (호환성 유지)
          await saveSession({
            user,
            expires: refreshData.expires,
          });

          // 7. React Query 캐시 무효화
          queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Refresh 실패 → 토큰 삭제 및 로그아웃
          await clearRefreshToken();
          await clearSession();
          clearAuth();
        }
      } catch (error) {
        console.error('Bootstrap error:', error);
        await clearRefreshToken();
        await clearSession();
        clearAuth();
      } finally {
        setIsBootstrapComplete(true);
        setLoading(false);
      }
    };

    void bootstrap();
  }, [queryClient, setAuth, setLoading, clearAuth]);

  // 세션 초기화 및 주기적 확인 (Bootstrap 완료 후)
  useEffect(() => {
    if (!isBootstrapComplete) return;

    const initializeSession = async () => {
      try {
        const storedSession = await getSession();
        if (storedSession) {
          // 세션이 있으면 서버에서 확인
          try {
            const serverSession = await queryClient.fetchQuery(authQueryOptions.session);
            await saveSession(serverSession);
          } catch (error) {
            // 서버 세션이 없으면 로컬 세션 삭제
            await clearSession();
          }
        }
      } catch (error) {
        console.error('Failed to initialize session:', error);
      }
    };

    void initializeSession();

    // 주기적으로 세션 확인 (5분마다)
    const interval = setInterval(() => {
      void initializeSession();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [queryClient, isBootstrapComplete]);

  // React Query 에러 감지 및 처리
  useEffect(() => {
    const handleUnauthorized = async () => {
      await clearSession();
      await clearRefreshToken();
      useAuthStore.getState().clearAuth();
      queryClient.clear();
    };

    // Mutation 에러 감지
    const unsubscribeMutation = queryClient
      .getMutationCache()
      .subscribe((event) => {
        if (event?.type === 'updated' && event.mutation?.state.error) {
          const error = event.mutation.state.error as any;
          if (error?.status === 401) {
            void handleUnauthorized();
          }
        }
      });

    // Query 에러 감지
    const unsubscribeQuery = queryClient
      .getQueryCache()
      .subscribe((event) => {
        if (event?.type === 'updated' && event.query?.state.error) {
          const error = event.query.state.error as any;
          if (error?.status === 401) {
            void handleUnauthorized();
          }
        }
      });

    return () => {
      unsubscribeMutation();
      unsubscribeQuery();
    };
  }, [queryClient]);

  return <>{children}</>;
}

/**
 * 로그아웃 함수 (캐시 클리어 포함)
 */
export async function logoutWithCacheClear(
  queryClient: ReturnType<typeof useQueryClient>
): Promise<void> {
  try {
    await queryClient.mutateAsync(authQueryOptions.signOut);
  } catch (error) {
    // 로그아웃 실패해도 세션은 삭제
    console.error('Logout failed:', error);
  } finally {
    await clearSession();
    await clearRefreshToken();
    useAuthStore.getState().clearAuth();
    queryClient.clear();
  }
}


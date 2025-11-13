/**
 * 인증 관련 React Query 훅들
 * React Query 캐시 정리와 함께 로그아웃 처리
 */

'use client';

import { logoutWithCacheClear } from '@/share/providers/client/auth-provider';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * React Query 캐시 정리와 함께 로그아웃을 수행하는 커스텀 훅
 *
 * @returns 로그아웃 함수와 로딩 상태
 */
export function useLogoutWithCacheClear(): (options?: {
  callbackUrl?: string;
  redirect?: boolean;
}) => Promise<void> {
  const queryClient = useQueryClient();

  const logout = useCallback(
    async (options?: {
      callbackUrl?: string;
      redirect?: boolean;
    }): Promise<void> => {
      await logoutWithCacheClear(queryClient, options);
    },
    [queryClient]
  );

  return logout;
}

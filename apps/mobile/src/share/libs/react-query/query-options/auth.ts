/**
 * 인증 관련 Query Options
 */

import { queryOptions } from '@tanstack/react-query';

import { authClient } from '@/share/libs/auth/better-auth-client';
import { queryKeys } from '../query-keys';

export interface SessionResponse {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  };
  expires?: string;
}

export const authQueryOptions = {
  /**
   * 현재 세션 조회 (Better Auth)
   */
  session: queryOptions({
    queryKey: queryKeys.auth.session(),
    queryFn: async (): Promise<SessionResponse> => {
      const { data, error } = await authClient.getSession();
      if (error) {
        throw error;
      }
      if (!data?.user) {
        throw new Error('세션 정보가 없습니다.');
      }
      return {
        user: {
          id: data.user.id,
          email: data.user.email ?? undefined,
          name: data.user.name ?? undefined,
          image: data.user.image ?? undefined,
        },
        expires: undefined,
      };
    },
        staleTime: 5 * 60 * 1000, // 5분
        gcTime: 10 * 60 * 1000, // 10분
  }),

  /**
   * 로그아웃
   * Better Auth signOut
   */
  signOut: {
    mutationFn: async (): Promise<void> => {
      await authClient.signOut();
    },
    },
} as const;


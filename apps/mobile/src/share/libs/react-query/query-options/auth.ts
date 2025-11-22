/**
 * 인증 관련 Query Options
 */

import { queryOptions } from '@tanstack/react-query';
import { createApiQueryOptions, createApiMutation } from '../query-builder';
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
   * 현재 세션 조회
   * GET /api/auth/session
   */
  session: queryOptions({
    queryKey: queryKeys.auth.session(),
    ...createApiQueryOptions<SessionResponse, SessionResponse>(
      '/api/auth/session',
      (data) => data,
      {
        staleTime: 5 * 60 * 1000, // 5분
        gcTime: 10 * 60 * 1000, // 10분
      },
    ),
  }),

  /**
   * 로그아웃
   * POST /api/auth/signout
   */
  signOut: createApiMutation<void, void, void>(
    () => '/api/auth/signout',
    () => undefined,
    {
      method: 'POST',
    },
  ),
} as const;


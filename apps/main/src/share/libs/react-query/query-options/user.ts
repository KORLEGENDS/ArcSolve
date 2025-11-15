/**
 * 사용자 관련 Query Options
 * query-builder 유틸리티를 활용한 표준화된 API 호출
 */

import { TIMEOUT } from '@/share/configs/constants/time-constants';
import type {
  UserPreferences,
  UserSchema,
} from '@/share/schema/zod';
import { queryOptions } from '@tanstack/react-query';
import {
  createApiMutation,
  createApiQueryOptions
} from '../query-builder';
import { queryKeys } from '../query-keys';

/**
 * 사용자 preferences 수정 뮤테이션 변수 타입
 */
export interface UpdateUserPreferencesMutationVariables {
  userId: string;
  preferences: Partial<UserPreferences>;
}

/**
 * 사용자 관련 Query Options
 */
export const userQueryOptions = {
  /**
   * 사용자 상세 정보 조회
   */
  detail: (userId: string) =>
    queryOptions({
      queryKey: queryKeys.users.detail(userId),
      ...createApiQueryOptions(
        `/api/user/${userId}`,
        (data: { user: UserSchema }) => data.user,
        {
          enabled: !!userId,
          staleTime: TIMEOUT.CACHE.MEDIUM, // 5분
          gcTime: TIMEOUT.CACHE.LONG, // 30분
        }
      ),
    }),

  /**
   * 사용자 preferences 조회
   */
  preferences: (userId: string) =>
    queryOptions({
      queryKey: queryKeys.users.preferences(userId),
      ...createApiQueryOptions(
        `/api/user/${userId}/preferences`,
        (data: { preferences: UserPreferences }) => data.preferences,
        {
          enabled: !!userId,
          staleTime: TIMEOUT.CACHE.MEDIUM, // 5분
          gcTime: TIMEOUT.CACHE.LONG, // 30분
        }
      ),
    }),

  /**
   * 사용자 preferences 수정 뮤테이션 옵션
   */
  updatePreferences: createApiMutation<
    UserPreferences,
    { preferences: UserPreferences },
    UpdateUserPreferencesMutationVariables
  >(
    (variables) => `/api/user/${variables.userId}/preferences`,
    (data) => data.preferences,
    {
      method: 'PATCH',
      bodyExtractor: ({ userId: _, ...body }) => body, // userId 제외하고 body만 전송
    }
  ),
} as const;


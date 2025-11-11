/**
 * TanStack Query v5 Query Options Factory
 * 프로젝트 관련 타입 안전한 쿼리 옵션 생성
 */

import { TIMEOUT } from '@/share/configs/constants/time-constants';
// 도메인별 실제 스키마 경로로 타입 정확히 import
import type {
  UserPreferences,
  UserSchema,
} from '@/share/schema/zod';
import { queryOptions } from '@tanstack/react-query';
import {
  createApiMutation,
  createApiQueryOptions
} from './query-builder';
import { queryKeys } from './query-keys';

// ==================== 공통 무한 스크롤 타입 정의 ====================

/**
 * 무한 스크롤 파라미터
 * 모든 리스트 API에서 공통으로 사용 (page 제외)
 */
export interface InfiniteListParams {
  limit?: number;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// ==================== 사용자 관련 타입 정의 ====================

export interface UpdateUserPreferencesMutationVariables {
  userId: string;
  preferences: Partial<UserPreferences>;
}

// ==================== 사용자 Query Options ====================

/**
 * 사용자 관련 Query Options
 * query-builder 유틸리티를 활용한 표준화된 API 호출
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

// 번역 스트리밍으로 전환되어 React Query 옵션 제거됨

// (태스크 전용 Query Options 제거됨)

// 이벤트 관련 옵션 제거됨

// ==================== 채팅방 Query Options ====================

/**
 * 채팅방 관련 타입 정의
 */
export type UserChatRoom = {
  id: string;
  name: string;
  description: string | null;
  lastMessageId: number | null;
  role: 'owner' | 'manager' | 'participant';
  lastReadMessageId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ChatRoomsListResponse = {
  rooms: UserChatRoom[];
};

/**
 * 채팅방 생성 뮤테이션 변수 타입
 */
export interface CreateChatRoomMutationVariables {
  name: string;
  description?: string | null;
}

export type CreateChatRoomResponse = {
  room: UserChatRoom;
};

/**
 * 채팅방 관련 Query Options
 */
export const chatRoomQueryOptions = {
  /**
   * 사용자의 채팅방 목록 조회
   */
  list: () =>
    queryOptions({
      queryKey: queryKeys.chatRooms.list(),
      ...createApiQueryOptions<ChatRoomsListResponse['rooms'], ChatRoomsListResponse>(
        '/api/arcyou/chat/rooms',
        (data) => data.rooms,
        {
          staleTime: TIMEOUT.CACHE.SHORT, // 1분
          gcTime: TIMEOUT.CACHE.MEDIUM, // 5분
        }
      ),
    }),

  /**
   * 채팅방 생성 뮤테이션 옵션
   */
  create: createApiMutation<
    CreateChatRoomResponse['room'],
    CreateChatRoomResponse,
    CreateChatRoomMutationVariables
  >(
    () => '/api/arcyou/chat/rooms',
    (data) => data.room,
    {
      method: 'POST',
    }
  ),
} as const;

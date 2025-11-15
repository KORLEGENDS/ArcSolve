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
export type ArcyouChatRoom = {
  id: string;
  name: string;
  description: string | null;
  type: 'direct' | 'group';
  lastMessageId: number | null;
  role: 'owner' | 'manager' | 'participant';
  lastReadMessageId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ChatRoomsListResponse = {
  rooms: ArcyouChatRoom[];
};

/**
 * 채팅방 생성 뮤테이션 변수 타입
 */
export interface CreateChatRoomMutationVariables {
  type: 'direct' | 'group';
  name: string;
  description?: string | null;
  targetUserId?: string; // direct 타입일 때 필수
  memberIds?: string[]; // group 타입일 때 필수 (최소 1명)
}

export type CreateChatRoomResponse = {
  room: ArcyouChatRoom;
};

/**
 * 채팅방 이름 수정 뮤테이션 변수 타입
 */
export interface RenameChatRoomMutationVariables {
  roomId: string;
  name: string;
}

export type RenameChatRoomResponse = {
  room: ArcyouChatRoom;
};

/**
 * 채팅방 관련 Query Options
 */
export const chatRoomQueryOptions = {
  /**
   * 사용자의 채팅방 목록 조회
   * @param type 채팅방 타입 필터 (선택사항)
   */
  list: (type?: 'direct' | 'group') => {
    const url = type
      ? `/api/arcyou/chat/rooms?type=${encodeURIComponent(type)}`
      : '/api/arcyou/chat/rooms';
    return queryOptions({
      queryKey: queryKeys.chatRooms.list(type),
      ...createApiQueryOptions<ChatRoomsListResponse['rooms'], ChatRoomsListResponse>(
        url,
        (data) => data.rooms,
        {
          staleTime: TIMEOUT.CACHE.SHORT, // 1분
          gcTime: TIMEOUT.CACHE.MEDIUM, // 5분
        }
      ),
    });
  },

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

  /**
   * 채팅방 이름 수정 뮤테이션 옵션
   */
  rename: createApiMutation<
    RenameChatRoomResponse['room'],
    RenameChatRoomResponse,
    RenameChatRoomMutationVariables
  >(
    (variables) => `/api/arcyou/chat/rooms/${variables.roomId}`,
    (data) => data.room,
    {
      method: 'PATCH',
      bodyExtractor: ({ roomId: _roomId, ...body }) => body,
    }
  ),
} as const;

// ==================== 친구 관계 Query Options ====================

/**
 * 친구 관계 관련 타입 정의 (API 응답용)
 */
export type ArcyouChatRelationApi = {
  userId: string;
  targetUserId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  requestedAt: string | null;
  respondedAt: string | null;
  blockedAt: string | null;
};

export type RelationshipWithTargetUser = ArcyouChatRelationApi & {
  targetUser: {
    id: string;
    name: string;
    email: string;
    imageUrl?: string | null;
  };
  /**
   * 현재 사용자가 요청을 받은 경우 true
   * pending 상태에서 수락/거부 버튼을 표시할지 결정하는 데 사용
   */
  isReceivedRequest?: boolean;
};

export type RelationsListResponse = {
  relationships: RelationshipWithTargetUser[];
};

/**
 * 친구 요청 뮤테이션 변수 타입
 */
export interface SendFriendRequestMutationVariables {
  email: string;
}

export type SendFriendRequestResponse = {
  relation: ArcyouChatRelationApi;
};

/**
 * 친구 요청 수락/거절 뮤테이션 변수 타입
 */
export interface RespondToFriendRequestMutationVariables {
  requesterUserId: string;
  action: 'accept' | 'reject';
}

export type RespondToFriendRequestResponse = {
  relation: ArcyouChatRelationApi;
};

/**
 * 친구 관계 삭제 뮤테이션 변수 타입
 */
export interface DeleteFriendRelationMutationVariables {
  friendUserId: string;
}

export type DeleteFriendRelationResponse = {
  deletedCount: number;
};

/**
 * 친구 요청 취소 뮤테이션 변수 타입
 */
export interface CancelFriendRequestMutationVariables {
  targetUserId: string;
}

export type CancelFriendRequestResponse = {
  relation: ArcyouChatRelationApi;
};

/**
 * 친구 관계 관련 Query Options
 */
export const relationQueryOptions = {
  /**
   * 사용자의 친구 관계 목록 조회
   */
  list: () =>
    queryOptions({
      queryKey: queryKeys.relations.list(),
      ...createApiQueryOptions<
        RelationsListResponse['relationships'],
        RelationsListResponse
      >(
        '/api/arcyou/relation',
        (data) => data.relationships,
        {
          staleTime: TIMEOUT.CACHE.SHORT, // 1분
          gcTime: TIMEOUT.CACHE.MEDIUM, // 5분
        }
      ),
    }),

  /**
   * 친구 검색
   * @param query 검색어
   */
  search: (query: string) => {
    const url = query.trim()
      ? `/api/arcyou/relation?q=${encodeURIComponent(query.trim())}`
      : '/api/arcyou/relation';
    return queryOptions({
      queryKey: queryKeys.relations.search(query),
      ...createApiQueryOptions<
        RelationsListResponse['relationships'],
        RelationsListResponse
      >(
        url,
        (data) => data.relationships,
        {
          enabled: query.trim().length > 0, // 검색어가 있을 때만 실행
          staleTime: TIMEOUT.CACHE.SHORT, // 1분
          gcTime: TIMEOUT.CACHE.MEDIUM, // 5분
        }
      ),
    });
  },

  /**
   * 친구 요청 보내기 뮤테이션 옵션
   */
  sendFriendRequest: createApiMutation<
    SendFriendRequestResponse['relation'],
    SendFriendRequestResponse,
    SendFriendRequestMutationVariables
  >(
    () => '/api/arcyou/relation',
    (data) => data.relation,
    {
      method: 'POST',
    }
  ),

  /**
   * 친구 요청 수락/거절 뮤테이션 옵션
   */
  respondToFriendRequest: createApiMutation<
    RespondToFriendRequestResponse['relation'],
    RespondToFriendRequestResponse,
    RespondToFriendRequestMutationVariables
  >(
    () => '/api/arcyou/relation',
    (data) => data.relation,
    {
      method: 'PATCH',
    }
  ),

  /**
   * 친구 관계 삭제 뮤테이션 옵션
   */
  deleteFriendRelation: createApiMutation<
    DeleteFriendRelationResponse['deletedCount'],
    DeleteFriendRelationResponse,
    DeleteFriendRelationMutationVariables
  >(
    (variables) => `/api/arcyou/relation?friendUserId=${encodeURIComponent(variables.friendUserId)}`,
    (data) => data.deletedCount,
    {
      method: 'DELETE',
    }
  ),

  /**
   * 친구 요청 취소 뮤테이션 옵션
   */
  cancelFriendRequest: createApiMutation<
    CancelFriendRequestResponse['relation'],
    CancelFriendRequestResponse,
    CancelFriendRequestMutationVariables
  >(
    () => '/api/arcyou/relation',
    (data) => data.relation,
    {
      method: 'PATCH',
      bodyExtractor: (variables) => ({
        targetUserId: variables.targetUserId,
        action: 'cancel',
      }),
    }
  ),
} as const;

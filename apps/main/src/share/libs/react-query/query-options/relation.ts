/**
 * 친구 관계 관련 Query Options
 */

import { TIMEOUT } from '@/share/configs/constants/time-constants';
import { queryOptions } from '@tanstack/react-query';
import {
  createApiMutation,
  createApiQueryOptions
} from '../query-builder';
import { queryKeys } from '../query-keys';

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


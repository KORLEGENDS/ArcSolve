/**
 * ArcYou 친구 관계 도메인 전용 React Query 훅
 * - 목록 조회, 요청/응답/취소/삭제 액션을 모두 캡슐화
 * - API 응답의 ISO 시각 필드를 Date 객체로 변환해 UI에서 바로 사용할 수 있도록 제공
 */

import { useCallback, useMemo } from 'react';

import { queryKeys } from '@/share/libs/react-query/query-keys';
import {
  relationQueryOptions,
  type RelationshipWithTargetUser as ApiRelationshipWithTargetUser,
} from '@/share/libs/react-query/query-options';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

/**
 * UI 전용 관계 타입
 * - ISO string 대신 Date 객체를 사용
 */
export type ArcYouRelationWithTargetUser = Omit<
  ApiRelationshipWithTargetUser,
  'requestedAt' | 'respondedAt' | 'blockedAt'
> & {
  requestedAt: Date | null;
  respondedAt: Date | null;
  blockedAt: Date | null;
};

export interface ArcYouRelationHandlers {
  accept: (relationship: ArcYouRelationWithTargetUser) => Promise<unknown>;
  reject: (relationship: ArcYouRelationWithTargetUser) => Promise<unknown>;
  cancel: (relationship: ArcYouRelationWithTargetUser) => Promise<unknown>;
  delete: (relationship: ArcYouRelationWithTargetUser) => Promise<unknown>;
}

const toDate = (value: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const mapRelation = (
  relation: ApiRelationshipWithTargetUser
): ArcYouRelationWithTargetUser => ({
  ...relation,
  requestedAt: toDate(relation.requestedAt),
  respondedAt: toDate(relation.respondedAt),
  blockedAt: toDate(relation.blockedAt),
});

const mapRelations = (
  relations?: ApiRelationshipWithTargetUser[]
): ArcYouRelationWithTargetUser[] => {
  if (!relations) return [];
  return relations.map(mapRelation);
};

export function useArcYouRelation() {
  const queryClient = useQueryClient();

  const listQuery = useQuery(relationQueryOptions.list());

  const relationships = useMemo(
    () => mapRelations(listQuery.data),
    [listQuery.data]
  );

  const invalidateRelations = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.relations.list(),
    });
  }, [queryClient]);

  const sendFriendRequestMutation = useMutation({
    ...relationQueryOptions.sendFriendRequest,
    onSuccess: invalidateRelations,
  });

  const respondToFriendRequestMutation = useMutation({
    ...relationQueryOptions.respondToFriendRequest,
    onSuccess: invalidateRelations,
  });

  const deleteFriendRelationMutation = useMutation({
    ...relationQueryOptions.deleteFriendRelation,
    onSuccess: invalidateRelations,
  });

  const cancelFriendRequestMutation = useMutation({
    ...relationQueryOptions.cancelFriendRequest,
    onSuccess: invalidateRelations,
  });

  const sendFriendRequest = useCallback(
    (email: string) =>
      sendFriendRequestMutation.mutateAsync({
        email,
      }),
    [sendFriendRequestMutation]
  );

  const acceptFriendRequest = useCallback(
    (requesterUserId: string) =>
      respondToFriendRequestMutation.mutateAsync({
        requesterUserId,
        action: 'accept',
      }),
    [respondToFriendRequestMutation]
  );

  const rejectFriendRequest = useCallback(
    (requesterUserId: string) =>
      respondToFriendRequestMutation.mutateAsync({
        requesterUserId,
        action: 'reject',
      }),
    [respondToFriendRequestMutation]
  );

  const cancelFriendRequest = useCallback(
    (targetUserId: string) =>
      cancelFriendRequestMutation.mutateAsync({
        targetUserId,
      }),
    [cancelFriendRequestMutation]
  );

  const deleteFriendRelation = useCallback(
    (friendUserId: string) =>
      deleteFriendRelationMutation.mutateAsync({
        friendUserId,
      }),
    [deleteFriendRelationMutation]
  );

  const handlers: ArcYouRelationHandlers = useMemo(
    () => ({
      accept: (relationship) =>
        acceptFriendRequest(relationship.targetUser.id),
      reject: (relationship) =>
        rejectFriendRequest(relationship.targetUser.id),
      cancel: (relationship) =>
        cancelFriendRequest(relationship.targetUser.id),
      delete: (relationship) =>
        deleteFriendRelation(relationship.targetUser.id),
    }),
    [
      acceptFriendRequest,
      rejectFriendRequest,
      cancelFriendRequest,
      deleteFriendRelation,
    ]
  );

  return {
    ...listQuery,
    data: relationships,
    relationships,
    sendFriendRequest,
    isSending: sendFriendRequestMutation.isPending,
    sendError: sendFriendRequestMutation.error,
    acceptFriendRequest,
    rejectFriendRequest,
    isResponding: respondToFriendRequestMutation.isPending,
    respondError: respondToFriendRequestMutation.error,
    cancelFriendRequest,
    isCanceling: cancelFriendRequestMutation.isPending,
    cancelError: cancelFriendRequestMutation.error,
    deleteFriendRelation,
    isDeleting: deleteFriendRelationMutation.isPending,
    deleteError: deleteFriendRelationMutation.error,
    handlers,
  };
}

export function useArcYouRelationSearch(query: string) {
  const searchQuery = useQuery(relationQueryOptions.search(query));

  const results = useMemo(
    () => mapRelations(searchQuery.data),
    [searchQuery.data]
  );

  return {
    ...searchQuery,
    data: results,
    results,
  };
}

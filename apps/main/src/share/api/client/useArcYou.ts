/**
 * 친구 관계 관련 React Query 훅
 * 사용자의 친구 관계 목록을 조회하고 친구 요청을 보내는 훅
 */

import { queryKeys } from '@/share/libs/react-query/query-keys';
import { relationQueryOptions } from '@/share/libs/react-query/query-options';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * 사용자의 친구 관계 목록을 조회하고 친구 요청을 보내는 훅
 * 
 * @example
 * ```tsx
 * const { data: relationships, isLoading, error, sendFriendRequest, isSending } = useArcYou();
 * 
 * if (isLoading) return <div>로딩 중...</div>;
 * if (error) return <div>오류: {error.message}</div>;
 * 
 * return (
 *   <div>
 *     {relationships?.map(rel => (
 *       <div key={rel.userId}>{rel.targetUser.name}</div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useArcYou() {
  const queryClient = useQueryClient();

  const query = useQuery(relationQueryOptions.list());

  const sendFriendRequestMutation = useMutation({
    ...relationQueryOptions.sendFriendRequest,
    onSuccess: () => {
      // 친구 관계 목록 쿼리 무효화하여 자동으로 새로고침
      queryClient.invalidateQueries({ queryKey: queryKeys.relations.list() });
    },
  });

  return {
    ...query,
    sendFriendRequest: sendFriendRequestMutation.mutateAsync,
    isSending: sendFriendRequestMutation.isPending,
    sendError: sendFriendRequestMutation.error,
  };
}


/**
 * 채팅방 관련 React Query 훅
 * - 사용자의 채팅방 목록을 조회/생성
 */

import { queryKeyUtils, queryKeys } from '@/share/libs/react-query/query-keys';
import {
  chatRoomQueryOptions,
  type ArcyouChatRoom,
} from '@/share/libs/react-query/query-options';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

// 분리된 훅들을 re-export
export { useArcYouChatRoom, type UseArcYouChatRoomReturn } from './useArcYouChatRoom';
export { useArcYouChatRooms, type ArcYouChatRoomsOptions } from './useArcYouChatRooms';

/**
 * 사용자의 채팅방 목록을 조회하는 훅
 * 
 * @param type 채팅방 타입 필터 (선택사항)
 * 
 * @example
 * ```tsx
 * // 모든 채팅방 조회
 * const { data: rooms, isLoading, error } = useArcyouChat();
 * 
 * // 1:1 채팅방만 조회
 * const { data: directRooms } = useArcyouChat('direct');
 * 
 * // 그룹 채팅방만 조회
 * const { data: groupRooms } = useArcyouChat('group');
 * ```
 */
export function useArcyouChat(type?: 'direct' | 'group') {
  const queryClient = useQueryClient();

  const query = useQuery(chatRoomQueryOptions.list(type));

  const createMutation = useMutation({
    ...chatRoomQueryOptions.create,
    onSuccess: () => {
      // 모든 타입의 채팅방 목록 쿼리 무효화하여 자동으로 새로고침
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms.all() });
    },
  });

  return {
    ...query,
    createRoom: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
  };
}

/**
 * 채팅방 이름 수정 훅
 *
 * - 성공 시 채팅방 목록 및 상세 쿼리를 무효화하여 최신 이름을 반영합니다.
 */
export function useRenameChatRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    ...chatRoomQueryOptions.rename,
    onSuccess: (room) => {
      // 목록/상세 캐시를 모두 무효화하여 이름/updatedAt 변경사항 반영
      queryKeyUtils.invalidateChatRoomsList(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatRooms.byId(room.id),
      });
    },
  });
}

/**
 * 특정 채팅방 멤버 목록 조회 훅
 */
export function useChatRoomMembers(roomId: string) {
  return useQuery(chatRoomQueryOptions.members(roomId));
}

/**
 * 방 목록 캐시에서 특정 room의 lastMessageId/updatedAt을 갱신하고
 * 최신 방이 상단에 오도록 재정렬하는 헬퍼 훅
 */
export function useBumpChatRoomActivity() {
  const queryClient = useQueryClient();

  const bump = (roomId: string, opts: { lastMessageId?: string; updatedAt?: string }) => {
    const updateList = (rooms?: ArcyouChatRoom[]) => {
      if (!rooms) return rooms;
      const idx = rooms.findIndex((r) => r.id === roomId);
      if (idx === -1) return rooms;

      const original = rooms[idx];
      const updated: ArcyouChatRoom = {
        ...original,
        lastMessageId: opts.lastMessageId ?? original.lastMessageId,
        updatedAt: opts.updatedAt ?? original.updatedAt ?? new Date().toISOString(),
      };

      const next = [...rooms];
      next.splice(idx, 1);
      next.unshift(updated);
      return next;
    };

    // 전체/타입별 리스트 모두 갱신 (존재하지 않는 캐시는 무시)
    queryClient.setQueryData(queryKeys.chatRooms.list(), updateList);
    queryClient.setQueryData(queryKeys.chatRooms.list('direct'), updateList);
    queryClient.setQueryData(queryKeys.chatRooms.list('group'), updateList);
  };

  return { bump };
}



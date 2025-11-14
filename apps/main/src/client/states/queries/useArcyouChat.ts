/**
 * 채팅방 관련 React Query 훅
 * 사용자의 채팅방 목록을 조회하고 생성하는 훅
 */

import { queryKeys } from '@/share/libs/react-query/query-keys';
import { chatRoomQueryOptions } from '@/share/libs/react-query/query-options';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
 * 채팅방 생성 훅 (별도로 사용 가능)
 * 
 * @example
 * ```tsx
 * const createRoom = useCreateChatRoom();
 * 
 * const handleCreate = async () => {
 *   try {
 *     const room = await createRoom.mutateAsync({
 *       name: '새 채팅방',
 *       description: '설명',
 *     });
 *   } catch (error) {
 *     console.error('생성 실패:', error);
 *   }
 * };
 * ```
 */
export function useCreateChatRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    ...chatRoomQueryOptions.create,
    onSuccess: () => {
      // 채팅방 목록 쿼리 무효화하여 자동으로 새로고침
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms.list() });
    },
  });
}


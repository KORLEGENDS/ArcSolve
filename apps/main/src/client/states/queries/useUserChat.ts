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
 * @example
 * ```tsx
 * const { data: rooms, isLoading, error } = useUserChat();
 * 
 * if (isLoading) return <div>로딩 중...</div>;
 * if (error) return <div>오류: {error.message}</div>;
 * 
 * return (
 *   <div>
 *     {rooms?.map(room => (
 *       <div key={room.id}>{room.name}</div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useUserChat() {
  const queryClient = useQueryClient();

  const query = useQuery(chatRoomQueryOptions.list());

  const createMutation = useMutation({
    ...chatRoomQueryOptions.create,
    onSuccess: () => {
      // 채팅방 목록 쿼리 무효화하여 자동으로 새로고침
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms.list() });
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
 *     console.log('생성된 채팅방:', room);
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


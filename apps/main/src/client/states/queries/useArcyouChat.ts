/**
 * 채팅방 관련 React Query 훅 및 실시간 방 활동 연동 훅
 * - 사용자의 채팅방 목록을 조회/생성
 * - uws-gateway의 room-activity 스트림을 통해 방 목록을 실시간으로 최신화
 */

import { clientEnv } from '@/share/configs/environments/client-constants';
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
import { useEffect, useRef } from 'react';

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
 * 방 목록 캐시에서 특정 room의 lastMessageId/updatedAt을 갱신하고
 * 최신 방이 상단에 오도록 재정렬하는 헬퍼 훅
 */
export function useBumpChatRoomActivity() {
  const queryClient = useQueryClient();

  const bump = (roomId: string, opts: { lastMessageId?: number; updatedAt?: string }) => {
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

/**
 * uws-gateway의 room-activity 스트림을 구독하여
 * React Query 방 목록 캐시를 실시간으로 갱신하는 훅
 *
 * - auth → watch_rooms 순으로 한 번만 등록
 * - RightSidebar 레벨에서 한 번만 호출하는 것을 예상
 */
export interface RoomActivitySocketOptions {
  /**
   * 방 정보(이름 등)가 업데이트되었을 때 호출되는 콜백
   * - ArcWork 탭 이름 동기화 등에 사용 가능
   */
  onRoomUpdated?: (room: { id: string; name?: string | null }) => void;
}

export function useRoomActivitySocket(options?: RoomActivitySocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const { bump } = useBumpChatRoomActivity();
  const queryClient = useQueryClient();
  const wsUrl = clientEnv.NEXT_PUBLIC_CHAT_WS_URL;

  useEffect(() => {
    if (!wsUrl) return;

    let closed = false;

    (async () => {
      try {
        const res = await fetch('/api/arcyou/chat/ws/token', { method: 'GET' });
        if (!res.ok) {
          return;
        }
        const { token } = (await res.json()) as { token: string };
        if (closed) return;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.addEventListener('open', () => {
          ws.send(JSON.stringify({ op: 'auth', token }));
        });

        ws.addEventListener('message', (ev) => {
          try {
            const data = JSON.parse(ev.data as string) as any;

            if (data.op === 'auth') {
              if (data.success) {
                ws.send(JSON.stringify({ op: 'rooms', action: 'watch' }));
              }
              return;
            }

            if (data.op === 'rooms' && data.event === 'watch') {
              // 필요 시 에러/상태 처리 확장 가능
              return;
            }

            if (
              data.op === 'rooms' &&
              data.event === 'room.activity' &&
              typeof data.roomId === 'string'
            ) {
              const lastMessageId =
                typeof data.lastMessageId === 'number' ? data.lastMessageId : undefined;
              const updatedAt =
                typeof data.createdAt === 'string' ? data.createdAt : undefined;

              bump(data.roomId, { lastMessageId, updatedAt });
              return;
            }

            if (
              data.op === 'rooms' &&
              data.event === 'room.created' &&
              data.room &&
              typeof data.room.id === 'string'
            ) {
              const roomData = data.room as Partial<ArcyouChatRoom>;

              const room: ArcyouChatRoom = {
                id: roomData.id!,
                name: roomData.name ?? '',
                description: roomData.description ?? null,
                type: roomData.type ?? 'direct',
                lastMessageId: roomData.lastMessageId ?? null,
                // WS 이벤트에는 role/lastReadMessageId 정보가 없으므로 기본값 사용
                role: roomData.role ?? 'participant',
                lastReadMessageId: roomData.lastReadMessageId ?? null,
                createdAt: roomData.createdAt ?? null,
                updatedAt: roomData.updatedAt ?? null,
              };

              const upsert = (rooms?: ArcyouChatRoom[]) => {
                if (!rooms || rooms.length === 0) return [room];
                if (rooms.some((r) => r.id === room.id)) return rooms;
                return [room, ...rooms];
              };

              // 전체 목록에 추가
              queryClient.setQueryData<ArcyouChatRoom[] | undefined>(
                queryKeys.chatRooms.list(),
                upsert,
              );

              // 타입별 목록에도 추가
              if (room.type === 'direct') {
                queryClient.setQueryData<ArcyouChatRoom[] | undefined>(
                  queryKeys.chatRooms.list('direct'),
                  upsert,
                );
              } else if (room.type === 'group') {
                queryClient.setQueryData<ArcyouChatRoom[] | undefined>(
                  queryKeys.chatRooms.list('group'),
                  upsert,
                );
              }

              return;
            }

            if (
              data.op === 'rooms' &&
              data.event === 'room.updated' &&
              data.room &&
              typeof data.room.id === 'string'
            ) {
              const roomData = data.room as Partial<ArcyouChatRoom>;

              const patch = (rooms?: ArcyouChatRoom[]) => {
                if (!rooms) return rooms;
                const idx = rooms.findIndex((r) => r.id === roomData.id);
                if (idx === -1) return rooms;

                const original = rooms[idx];
                const updated: ArcyouChatRoom = {
                  ...original,
                  name: roomData.name ?? original.name,
                  description: roomData.description ?? original.description,
                  updatedAt:
                    roomData.updatedAt ??
                    original.updatedAt ??
                    new Date().toISOString(),
                };

                const next = [...rooms];
                next[idx] = updated;
                return next;
              };

              // 전체/타입별 목록의 해당 room name/description/updatedAt 패치
              queryClient.setQueryData<ArcyouChatRoom[] | undefined>(
                queryKeys.chatRooms.list(),
                patch,
              );
              queryClient.setQueryData<ArcyouChatRoom[] | undefined>(
                queryKeys.chatRooms.list('direct'),
                patch,
              );
              queryClient.setQueryData<ArcyouChatRoom[] | undefined>(
                queryKeys.chatRooms.list('group'),
                patch,
              );

              // ArcWork 탭 등 외부 동기화를 위한 콜백
              if (options?.onRoomUpdated) {
                options.onRoomUpdated({
                  id: roomData.id!,
                  name: roomData.name,
                });
              }

              return;
            }
          } catch {
            // ignore malformed messages
          }
        });

        ws.addEventListener('error', () => {
          // 필요시 로깅만 수행 (자동 재연결은 추후 요구사항에 따라 보강)
        });
      } catch {
        // token fetch 실패 등은 조용히 무시 (사용자 경험에 큰 영향 없음)
      }
    })();

    return () => {
      closed = true;
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    };
  }, [wsUrl, bump, queryClient, options]);
}


/**
 * 채팅방 목록 실시간 갱신 훅
 *
 * uws-gateway의 room-activity 스트림을 구독하여
 * React Query 방 목록 캐시를 실시간으로 갱신합니다.
 *
 * - auth → watch_rooms 순으로 한 번만 등록
 * - RightSidebar 레벨에서 한 번만 호출하는 것을 예상
 */

import { useArcYouGatewaySocket } from '@/client/states/queries/arcyou/useArcYouSockets';
import { clientEnv } from '@/share/configs/environments/client-constants';
import { queryKeys } from '@/share/libs/react-query/query-keys';
import type { ArcyouChatRoom } from '@/share/libs/react-query/query-options';
import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useBumpChatRoomActivity } from './useArcyouChat';

export interface ArcYouChatRoomsOptions {
  /**
   * 방 정보(이름 등)가 업데이트되었을 때 호출되는 콜백
   * - ArcWork 탭 이름 동기화 등에 사용 가능
   */
  onRoomUpdated?: (room: { id: string; name?: string | null }) => void;
}

export function useArcYouChatRooms(options?: ArcYouChatRoomsOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const { bump } = useBumpChatRoomActivity();
  const queryClient = useQueryClient();
  const currentUserIdRef = useRef<string | null>(null);

  useArcYouGatewaySocket({
    wsRef,
    enabled: Boolean(clientEnv.NEXT_PUBLIC_CHAT_WS_URL),
    deps: [bump, queryClient, options],
    onSetup: (ws, token) => {
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ op: 'auth', token }));
      });

      ws.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse(ev.data as string) as any;

          if (data.op === 'auth') {
            if (data.success) {
              if (data.userId) {
                currentUserIdRef.current = String(data.userId);
              }
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
            const lastMessage =
              data.lastMessage &&
              typeof data.lastMessage === 'object' &&
              'content' in data.lastMessage
                ? { content: data.lastMessage.content }
                : null;
            const updatedAt =
              typeof data.updatedAt === 'string' ? data.updatedAt : undefined;

            bump(data.roomId, { lastMessage, updatedAt });
            // 방 활동 발생 시 unreadCount 증분 업데이트
            // - authorId가 현재 사용자라면 unreadCount를 올리지 않는다.
            const authorId =
              typeof data.authorId === 'string'
                ? data.authorId
                : data.authorId != null
                  ? String(data.authorId)
                  : undefined;
            const selfId = currentUserIdRef.current;

            if (!authorId || !selfId || authorId !== selfId) {
              const incrementUnread = (rooms?: ArcyouChatRoom[]) => {
                if (!rooms) return rooms;
                const idx = rooms.findIndex((r) => r.id === data.roomId);
                if (idx === -1) return rooms;
                const original = rooms[idx];
                const current = typeof original.unreadCount === 'number' ? original.unreadCount : 0;
                const nextCount = current + 1;
                const capped = nextCount > 300 ? 300 : nextCount;
                const nextRooms = [...rooms];
                nextRooms[idx] = { ...original, unreadCount: capped };
                return nextRooms;
              };

              queryClient.setQueryData<ArcyouChatRoom[] | undefined>(
                queryKeys.chatRooms.list(),
                incrementUnread,
              );
              queryClient.setQueryData<ArcyouChatRoom[] | undefined>(
                queryKeys.chatRooms.list('direct'),
                incrementUnread,
              );
              queryClient.setQueryData<ArcyouChatRoom[] | undefined>(
                queryKeys.chatRooms.list('group'),
                incrementUnread,
              );
            }
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
              type: roomData.type ?? 'direct',
              imageUrl: roomData.imageUrl ?? null,
              lastMessage: roomData.lastMessage ?? null,
              // WS 이벤트에는 role/lastReadMessageId 정보가 없으므로 기본값 사용
              role: roomData.role ?? 'participant',
              lastReadMessageId: roomData.lastReadMessageId ?? null,
              createdAt: roomData.createdAt ?? null,
              updatedAt: roomData.updatedAt ?? null,
              unreadCount: roomData.unreadCount ?? 0,
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
                updatedAt:
                  roomData.updatedAt ??
                  original.updatedAt ??
                  new Date().toISOString(),
              };

              const next = [...rooms];
              next[idx] = updated;
              return next;
            };

            // 전체/타입별 목록의 해당 room name/updatedAt 패치
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
    },
  });
}


/**
 * 개별 채팅방 WebSocket 연결 및 메시지 관리 훅
 *
 * 특정 채팅방에 대한 WebSocket 연결을 관리하고,
 * 메시지 송수신, 읽음 동기화, 히스토리 로딩 등을 처리합니다.
 */

import type { ArcyouChatMessage } from '@/client/components/arc/ArcYou/ArcYouChat/components/ArcYouChatMessage';
import { useArcYouGatewaySocket } from '@/client/states/queries/arcyou/useArcYouSockets';
import { clientEnv } from '@/share/configs/environments/client-constants';
import { queryKeys } from '@/share/libs/react-query/query-keys';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseArcYouChatRoomReturn {
  /**
   * 현재 메시지 목록
   */
  messages: ArcyouChatMessage[];
  /**
   * 현재 사용자 ID
   */
  currentUserId: string;
  /**
   * WebSocket 연결 및 방 조인 완료 여부
   */
  ready: boolean;
  /**
   * 메시지 전송 함수
   */
  sendMessage: (text: string) => void;
  /**
   * 읽음 상태 (userId -> lastReadMessageId)
   */
  readByUser: Record<string, string>;
  /**
   * 읽음 상태 업데이트 함수
   */
  setReadByUser: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export interface UseArcYouChatRoomOptions {
  /**
   * 이 채팅방 탭이 현재 ArcWork에서 활성 탭인지 여부
   *
   * - true: 화면에 실제로 노출되고 있으므로, 새 메시지를 "읽음"으로 간주하고 ACK 전송
   * - false: 백그라운드 탭이므로, ACK 전송을 지연(보류)했다가 활성화 시점에 모아서 전송
   */
  isActive?: boolean;
}

export function useArcYouChatRoom(
  roomId: string,
  options?: UseArcYouChatRoomOptions,
): UseArcYouChatRoomReturn {
  const [messages, setMessages] = useState<ArcyouChatMessage[]>([]);
  const messagesRef = useRef<ArcyouChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('unknown-user');
  const currentUserIdRef = useRef<string>('unknown-user');
  const [ready, setReady] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingMapRef = useRef<Record<string, number>>({});
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const persistedIdSetRef = useRef<Set<string>>(new Set());
  const isAuthedRef = useRef<boolean>(false);
  const isJoinedRef = useRef<boolean>(false);
  const historyAckPendingRef = useRef<boolean>(false);
  const [readByUser, setReadByUser] = useState<Record<string, string>>({});
  const isActive = options?.isActive ?? true;
  const isActiveRef = useRef<boolean>(isActive);
  const pendingReadAckRef = useRef<boolean>(false);
  const queryClient = useQueryClient();

  // messages 상태와 ref 동기화
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const wsUrl = clientEnv.NEXT_PUBLIC_CHAT_WS_URL;

  const toDisplayText = useCallback((content: unknown): string => {
    if (typeof content === 'string') return content;
    if (content && typeof content === 'object') {
      const obj = content as Record<string, unknown>;
      if (typeof obj.text === 'string') return obj.text as string;
      try {
        return JSON.stringify(content);
      } catch {
        return String(content);
      }
    }
    return String(content ?? '');
  }, []);

  const sendAck = useCallback(() => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!isActiveRef.current) return;
    const lastId = lastMessageIdRef.current;
    if (!lastId || typeof lastId !== 'string') return;
    ws.send(
      JSON.stringify({
        op: 'room',
        action: 'ack',
        roomId,
        lastReadMessageId: lastId,
      }),
    );
    pendingReadAckRef.current = false;
    // 읽음 ACK를 보낸 시점에, 방 목록의 unreadCount를 0으로 초기화
    const resetUnread = (rooms?: import('@/share/libs/react-query/query-options').ArcyouChatRoom[]) => {
      if (!rooms) return rooms;
      const idx = rooms.findIndex((r) => r.id === roomId);
      if (idx === -1) return rooms;
      const original = rooms[idx];
      if (original.unreadCount === 0) return rooms;
      const next = [...rooms];
      next[idx] = { ...original, unreadCount: 0 };
      return next;
    };
    queryClient.setQueryData(
      queryKeys.chatRooms.list(),
      resetUnread,
    );
    queryClient.setQueryData(
      queryKeys.chatRooms.list('direct'),
      resetUnread,
    );
    queryClient.setQueryData(
      queryKeys.chatRooms.list('group'),
      resetUnread,
    );
  }, [roomId, queryClient]);

  const scheduleAck = useCallback(() => {
    if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
    ackTimerRef.current = setTimeout(() => {
      ackTimerRef.current = null;
      sendAck();
    }, 300);
  }, [sendAck]);

  useArcYouGatewaySocket({
    wsRef: socketRef,
    enabled: Boolean(roomId && wsUrl),
    deps: [roomId],
    onSetup: (ws, token) => {
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ op: 'auth', token }));
      });

      ws.addEventListener('error', () => {
        // error handling (필요 시 로깅 등 확장)
      });

      ws.addEventListener('close', () => {
        // close handling (필요 시 로깅 등 확장)
      });

      ws.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse(ev.data as string) as any;
          if (data.op === 'auth') {
            if (data.success && data.userId) {
              const uid = String(data.userId);
              setCurrentUserId(uid);
              currentUserIdRef.current = uid;
              isAuthedRef.current = true;
              // 선히스토리 로드 (최신 N개) 후 join → backfill로 겹쳐도 dedupe 처리
              (async () => {
                try {
                  const res = await fetch(
                    `/api/arcyou/chat/rooms/${roomId}/messages?limit=50`,
                    { method: 'GET' },
                  );
                  if (res.ok) {
                    const body = (await res.json()) as {
                      success: boolean;
                      data?: {
                        messages?: Array<{
                          id: string;
                          userId: string;
                          content: unknown;
                          createdAt?: string;
                        }>;
                      };
                    };
                    const items = body?.data?.messages ?? [];
                    if (items.length > 0) {
                      // 서버는 DESC(createdAt 내림차순) 반환 → ASC(createdAt 오름차순)으로 정렬하여 앞쪽에 배치
                      const asc = [...items].reverse();
                      const latest = asc[asc.length - 1];
                      setMessages((prev) => {
                        const next: ArcyouChatMessage[] = [];
                        for (const m of asc) {
                          if (!persistedIdSetRef.current.has(m.id)) {
                            persistedIdSetRef.current.add(m.id);
                            next.push({
                              id: m.id,
                              roomId,
                              userId: m.userId,
                              type: 'text',
                              content:
                                typeof m.content === 'string'
                                  ? m.content
                                  : (m as any).content?.text ??
                                    JSON.stringify(m.content),
                              status: 'delivered',
                              createdAt: m.createdAt ?? new Date().toISOString(),
                            });
                            lastMessageIdRef.current = m.id;
                          }
                        }
                        return next.length > 0 ? [...next, ...prev] : prev;
                      });

                      if (latest?.id) {
                        const latestId = String(latest.id);
                        lastMessageIdRef.current = latestId;
                        const selfId = currentUserIdRef.current;
                        if (selfId) {
                          setReadByUser((prev) => {
                            if (prev[selfId] === latestId) return prev;
                            return { ...prev, [selfId]: latestId };
                          });
                        }
                        historyAckPendingRef.current = true;
                        if (isJoinedRef.current) {
                          historyAckPendingRef.current = false;
                          pendingReadAckRef.current = true;
                          scheduleAck();
                        }
                      }
                    }
                  }
                } catch {
                  // ignore
                } finally {
                  ws.send(
                    JSON.stringify({
                      op: 'room',
                      action: 'join',
                      roomId,
                    }),
                  );
                }
              })();
            } else {
              isAuthedRef.current = false;
            }
            return;
          }
          if (data.op === 'room' && data.event === 'joined' && data.roomId === roomId) {
            const joined = !!data?.success;
            isJoinedRef.current = joined;
            setReady(joined);
            if (joined && historyAckPendingRef.current) {
              historyAckPendingRef.current = false;
              pendingReadAckRef.current = true;
              scheduleAck();
            }
            return;
          }
          if (
            data.op === 'room' &&
            data.event === 'message.created' &&
            data.roomId === roomId
          ) {
            const contentText = toDisplayText(data.message?.content);
            const createdAt =
              data.message?.created_at ?? new Date().toISOString();
            const tempId = data.message?.temp_id as string | undefined;

            setMessages((prev) => {
              // 낙관적 메시지 승격
              if (tempId && tempId in pendingMapRef.current) {
                const idx = pendingMapRef.current[tempId]!;
                if (prev[idx]) {
                  const copy = prev.slice();
                  copy[idx] = {
                    ...copy[idx],
                    id: data.message.id,
                    status: 'delivered',
                    createdAt,
                  };
                  const nextMap = { ...pendingMapRef.current };
                  delete nextMap[tempId];
                  pendingMapRef.current = nextMap;
                  if (typeof data.message.id === 'string') {
                    lastMessageIdRef.current = data.message.id;
                    persistedIdSetRef.current.add(data.message.id);
                  }
                  pendingReadAckRef.current = true;
                  scheduleAck();
                  return copy;
                }
              }
              // 중복 방지: 이미 존재하는 서버 id면 상태만 delivered로 승격
              if (
                typeof data.message.id === 'string' &&
                persistedIdSetRef.current.has(data.message.id)
              ) {
                const idx = prev.findIndex((m) => m.id === data.message.id);
                if (idx >= 0) {
                  const copy = prev.slice();
                  copy[idx] = { ...copy[idx], status: 'delivered', createdAt };
                  return copy;
                }
                return prev;
              }
              const next: ArcyouChatMessage = {
                id: String(data.message.id),
                roomId,
                userId: String(data.message.user_id),
                type: 'text',
                content: contentText,
                status: 'delivered',
                createdAt,
              };
              const out = [...prev, next];
              if (typeof data.message.id === 'string') {
                lastMessageIdRef.current = data.message.id;
                persistedIdSetRef.current.add(data.message.id);
              }
              pendingReadAckRef.current = true;
              scheduleAck();
              return out;
            });
            return;
          }
          if (data.op === 'room' && data.event === 'read' && data.roomId === roomId) {
            const readerId = data.userId ? String(data.userId) : undefined;
            const lastReadMessageIdRaw = data.lastReadMessageId;

            if (!readerId) {
              return;
            }

            const lastReadMessageId =
              typeof lastReadMessageIdRaw === 'string'
                ? lastReadMessageIdRaw
                : String(lastReadMessageIdRaw);

            if (!lastReadMessageId) {
              return;
            }

            setReadByUser((prev) => {
              const prevVal = prev[readerId];
              if (prevVal) {
                const currentMessages = messagesRef.current;
                const prevMsg = currentMessages.find((m) => m.id === prevVal);
                const newMsg = currentMessages.find((m) => m.id === lastReadMessageId);
                if (prevMsg && newMsg) {
                  const prevTime = new Date(prevMsg.createdAt).getTime();
                  const newTime = new Date(newMsg.createdAt).getTime();
                  if (prevTime >= newTime) {
                    return prev;
                  }
                }
              }
              return { ...prev, [readerId]: lastReadMessageId };
            });

            return;
          }
          if (data.op === 'error') {
            // 전송 실패 처리: action:'send' + tempId가 있으면 낙관적 메시지를 failed로 변경
            const errorData = data as {
              error?: string;
              action?: string;
              tempId?: string;
            };
            if (errorData.action === 'send' && errorData.tempId) {
              const idx = pendingMapRef.current[errorData.tempId];
              if (typeof idx === 'number') {
                setMessages((prev) => {
                  const copy = prev.slice();
                  const target = copy[idx];
                  if (!target) return prev;
                  copy[idx] = {
                    ...target,
                    status: 'failed',
                  };
                  const nextMap = { ...pendingMapRef.current };
                  delete nextMap[errorData.tempId!];
                  pendingMapRef.current = nextMap;
                  return copy;
                });
              }
            }
            return;
          }
        } catch {
          // ignore
        }
      });
    },
  });

  // ArcWork 탭 활성/비활성 상태에 따라 읽음 ACK 전송 타이밍을 제어
  useEffect(() => {
    isActiveRef.current = isActive;
    // 비활성 상태에서 메시지가 쌓여 pendingReadAckRef가 true인 경우,
    // 탭이 다시 활성화되면 최신 lastMessageId 기준으로 ACK를 한 번 더 전송
    if (
      isActive &&
      pendingReadAckRef.current &&
      isJoinedRef.current &&
      isAuthedRef.current
    ) {
      scheduleAck();
    }
  }, [isActive, scheduleAck]);

  useEffect(() => {
    return () => {
      socketRef.current = null;
      pendingMapRef.current = {};
      if (ackTimerRef.current) {
        clearTimeout(ackTimerRef.current);
        ackTimerRef.current = null;
      }
      lastMessageIdRef.current = null;
      pendingReadAckRef.current = false;
      isAuthedRef.current = false;
      isJoinedRef.current = false;
      setReady(false);
      setReadByUser({});
    };
  }, [roomId]);

  // roomId 변경 시 메시지 로컬 상태 초기화
  useEffect(() => {
    pendingMapRef.current = {};
    lastMessageIdRef.current = null;
    setMessages([]);
    setReadByUser({});
  }, [roomId]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const ws = socketRef.current;
      if (!isAuthedRef.current || !isJoinedRef.current) {
        return;
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        const tempId = `temp-${Date.now()}`;
        const optimistic: ArcyouChatMessage = {
          id: tempId,
          roomId,
          userId: currentUserId,
          type: 'text',
          content: text,
          status: 'sending',
          createdAt: new Date(),
        };
        setMessages((prev) => {
          const index = prev.length;
          pendingMapRef.current = { ...pendingMapRef.current, [tempId]: index };
          return [...prev, optimistic];
        });
        ws.send(
          JSON.stringify({
            op: 'room',
            action: 'send',
            roomId,
            content: { text },
            tempId,
          }),
        );
      }
    },
    [roomId, currentUserId],
  );

  return {
    messages,
    currentUserId,
    ready,
    sendMessage,
    readByUser,
    setReadByUser,
  };
}


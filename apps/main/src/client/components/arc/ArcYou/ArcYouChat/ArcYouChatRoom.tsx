'use client';

import { cn } from '@/client/components/ui/utils';
import { useChatRoomMembers } from '@/client/states/queries/useArcyouChat';
import { clientEnv } from '@/share/configs/environments/client-constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from './components/ArcYouChatInput/ArcYouChatInput';
import type { ArcyouChatMessage } from './components/ArcYouChatMessage';
import { ArcYouChatMessageList } from './components/ArcYouChatMessageList';

export interface ArcYouChatRoomProps {
  id: string;
  className?: string;
}

export function ArcYouChatRoom({
  id,
  className,
}: ArcYouChatRoomProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ArcyouChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('unknown-user');
  const currentUserIdRef = useRef<string>('unknown-user');
  const [ready, setReady] = useState<boolean>(false); // auth + join 완료 여부
  const socketRef = useRef<WebSocket | null>(null);
  const pendingMapRef = useRef<Record<string, number>>({});
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const persistedIdSetRef = useRef<Set<string>>(new Set());
  const isAuthedRef = useRef<boolean>(false);
  const isJoinedRef = useRef<boolean>(false);
  const historyAckPendingRef = useRef<boolean>(false);
  // room.read 이벤트 기반 다른 사용자들의 마지막 읽은 메시지 id
  const [readByUser, setReadByUser] = useState<Record<string, string>>({});

  // 채팅방 멤버 목록 (이름/아바타 등)
  const { data: members } = useChatRoomMembers(id);

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
    const lastId = lastMessageIdRef.current;
    if (!lastId || typeof lastId !== 'string') return;
    console.debug('[ArcYouChatRoom] sendAck', {
      roomId: id,
      lastReadMessageId: lastId,
      currentUserIdState: currentUserId,
      currentUserIdRef: currentUserIdRef.current,
    });
    ws.send(
      JSON.stringify({
        op: 'room',
        action: 'ack',
        roomId: id,
        lastReadMessageId: lastId,
      }),
    );
  }, [id, currentUserId]);

  const scheduleAck = useCallback(() => {
    if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
    ackTimerRef.current = setTimeout(() => {
      ackTimerRef.current = null;
      sendAck();
    }, 300);
  }, [sendAck]);

  useEffect(() => {
    if (!id || !wsUrl) return;

    let closed = false;
    let ws: WebSocket | null = null;
    (async () => {
      try {
        const r = await fetch('/api/arcyou/chat/ws/token', { method: 'GET' });
        if (!r.ok) {
          return;
        }
        const { token } = (await r.json()) as { token: string };
        if (closed) return;
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.addEventListener('open', () => {
          ws?.send(JSON.stringify({ op: 'auth', token }));
        });

        ws.addEventListener('error', (err) => {
          // error handling
        });

        ws.addEventListener('close', (ev) => {
          // close handling
        });

        ws.addEventListener('message', (ev) => {
          try {
            const data = JSON.parse(ev.data as string) as any;
            if (data.op === 'auth') {
              if (data.success && data.userId) {
                const uid = String(data.userId);
                setCurrentUserId(uid);
                currentUserIdRef.current = uid;
                if (process.env.NODE_ENV !== 'production') {
                  console.debug('[ArcYouChatRoom] auth success', {
                    roomId: id,
                    userId: uid,
                  });
                }
                isAuthedRef.current = true;
                // 선히스토리 로드 (최신 N개) 후 join → backfill로 겹쳐도 dedupe 처리
                (async () => {
                  try {
                    const res = await fetch(`/api/arcyou/chat/room/${id}/messages?limit=50`, { method: 'GET' });
                    if (res.ok) {
                      const body = (await res.json()) as {
                        success: boolean;
                        data?: { messages?: Array<{ id: string; userId: string; content: unknown; createdAt?: string }> };
                      };
                      const items = body?.data?.messages ?? [];
                      if (items.length > 0) {
                        // 서버는 DESC(createdAt 내림차순) 반환 → ASC(createdAt 오름차순)으로 정렬하여 앞쪽에 배치
                        const asc = [...items].reverse();
                        const latest = asc[asc.length - 1];
                        if (process.env.NODE_ENV !== 'production') {
                          console.debug('[ArcYouChatRoom] history loaded', {
                            roomId: id,
                            total: asc.length,
                            ids: asc.map((m) => m.id),
                          });
                        }
                        setMessages((prev) => {
                          const next: ArcyouChatMessage[] = [];
                          for (const m of asc) {
                            if (!persistedIdSetRef.current.has(m.id)) {
                              persistedIdSetRef.current.add(m.id);
                              next.push({
                                id: m.id,
                                roomId: id,
                                userId: m.userId,
                                type: 'text',
                                content: typeof m.content === 'string' ? m.content : (m as any).content?.text ?? JSON.stringify(m.content),
                                status: 'delivered',
                                createdAt: m.createdAt ?? new Date().toISOString(),
                              });
                              lastMessageIdRef.current = m.id;
                            }
                          }
                          if (
                            process.env.NODE_ENV !== 'production' &&
                            next.length > 0
                          ) {
                            console.debug('[ArcYouChatRoom] history applied', {
                              roomId: id,
                              added: next.map((m) => m.id),
                              totalAfter: next.length + prev.length,
                            });
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
                              const next = { ...prev, [selfId]: latestId };
                              if (process.env.NODE_ENV !== 'production') {
                                console.debug('[ArcYouChatRoom] readByUser self sync from history', {
                                  roomId: id,
                                  userId: selfId,
                                  latestId,
                                });
                              }
                              return next;
                            });
                          }
                          historyAckPendingRef.current = true;
                          if (isJoinedRef.current) {
                            historyAckPendingRef.current = false;
                            scheduleAck();
                          }
                        }
                      }
                    }
                  } catch {
                    // ignore
                    } finally {
                      ws?.send(
                        JSON.stringify({
                          op: 'room',
                          action: 'join',
                          roomId: id,
                        }),
                      );
                    }
                })();
              } else {
                isAuthedRef.current = false;
              }
              return;
            }
            if (data.op === 'room' && data.event === 'joined' && data.roomId === id) {
              // 성공/실패 UI는 필요 시 확장
              const joined = !!data?.success;
              isJoinedRef.current = joined;
              setReady(joined);
              if (joined && historyAckPendingRef.current) {
                historyAckPendingRef.current = false;
                scheduleAck();
              }
              return;
            }
            if (
              data.op === 'room' &&
              data.event === 'message.created' &&
              data.roomId === id
            ) {
              const contentText = toDisplayText(data.message?.content);
              const createdAt = data.message?.created_at ?? new Date().toISOString();
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
                    if (process.env.NODE_ENV !== 'production') {
                      console.debug('[ArcYouChatRoom] message.created (optimistic matched)', {
                        roomId: id,
                        messageId: data.message.id,
                        tempId,
                        index: idx,
                      });
                    }
                    scheduleAck();
                    return copy;
                  }
                }
                // 중복 방지: 이미 존재하는 서버 id면 상태만 delivered로 승격
                if (typeof data.message.id === 'string' && persistedIdSetRef.current.has(data.message.id)) {
                  const idx = prev.findIndex((m) => m.id === data.message.id);
                  if (idx >= 0) {
                    const copy = prev.slice();
                    copy[idx] = { ...copy[idx], status: 'delivered', createdAt };
                    if (process.env.NODE_ENV !== 'production') {
                      console.debug('[ArcYouChatRoom] message.created (duplicate server id)', {
                        roomId: id,
                        messageId: data.message.id,
                        index: idx,
                      });
                    }
                    return copy;
                  }
                  return prev;
                }
                const next: ArcyouChatMessage = {
                  id: String(data.message.id),
                  roomId: id,
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
                if (process.env.NODE_ENV !== 'production') {
                  console.debug('[ArcYouChatRoom] message.created (append)', {
                    roomId: id,
                    messageId: data.message.id,
                    totalAfter: out.length,
                    idsTail: out.slice(-5).map((m) => m.id),
                  });
                }
                scheduleAck();
                return out;
              });
              return;
            }
            if (data.op === 'room' && data.event === 'read' && data.roomId === id) {
              const readerId = data.userId ? String(data.userId) : undefined;
              const lastReadMessageIdRaw = data.lastReadMessageId;

              if (!readerId) {
                return;
              }

              const lastReadMessageId = typeof lastReadMessageIdRaw === 'string' ? lastReadMessageIdRaw : String(lastReadMessageIdRaw);

              if (!lastReadMessageId) {
                return;
              }

              console.debug('[ArcYouChatRoom] room.read received', {
                roomId: data.roomId,
                userId: readerId,
                lastReadMessageId,
              });

              setReadByUser((prev) => {
                const prevVal = prev[readerId];
                // 이전 값이 있고, 해당 메시지가 이미 읽은 메시지보다 나중이면 업데이트하지 않음
                if (prevVal) {
                  // 메시지 리스트에서 두 id의 createdAt을 비교
                  const prevMsg = messages.find((m) => m.id === prevVal);
                  const newMsg = messages.find((m) => m.id === lastReadMessageId);
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
            if (data.op === 'room' && data.event === 'sent') {
              const res = data as {
                success: boolean;
                messageId?: string;
                tempId?: string;
              };
              if (!res.tempId) return;
              const idx = pendingMapRef.current[res.tempId];
              if (typeof idx !== 'number') return;
              setMessages((prev) => {
                const copy = prev.slice();
                const target = copy[idx];
                if (!target) return prev;
                copy[idx] = {
                  ...target,
                  id:
                    res.success && typeof res.messageId === 'string'
                      ? res.messageId
                      : target.id,
                  status: res.success ? 'sent' : 'failed',
                };
                const nextMap = { ...pendingMapRef.current };
                delete nextMap[res.tempId!];
                pendingMapRef.current = nextMap;
                if (res.success && typeof res.messageId === 'string') {
                  lastMessageIdRef.current = res.messageId;
                  // 중복 방지용으로 서버 확정 id 기록
                  persistedIdSetRef.current.add(res.messageId);
                }
                return copy;
              });
              return;
            }
            if (data.op === 'error') {
              return;
            }
          } catch {
            // ignore
          }
        });
      } catch (e) {
        // error handling
      }
    })();

    return () => {
      closed = true;
      try {
        ws?.close();
      } catch {
        // ignore
      }
      socketRef.current = null;
      pendingMapRef.current = {};
      if (ackTimerRef.current) {
        clearTimeout(ackTimerRef.current);
        ackTimerRef.current = null;
      }
      lastMessageIdRef.current = null;
      isAuthedRef.current = false;
      isJoinedRef.current = false;
      setReady(false);
      setReadByUser({});
    };
  }, [id, wsUrl]);

  // roomId 변경 시 메시지 로컬 상태 초기화 (의존성 최소화)
  useEffect(() => {
    pendingMapRef.current = {};
    lastMessageIdRef.current = null;
    setMessages([]);
    setReadByUser({});
  }, [id]);

  // 멤버 API에서 내려온 lastReadMessageId를 초기 상태로 반영
  useEffect(() => {
    if (!members || members.length === 0) return;

    setReadByUser((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const member of members) {
        const userId = member.userId;
        const candidate = member.lastReadMessageId;
        if (!candidate) continue;

        const prevVal = next[userId];
        if (!prevVal) {
          next[userId] = candidate;
          changed = true;
          continue;
        }
        if (prevVal === candidate) {
          continue;
        }

        const prevMsg = messages.find((m) => m.id === prevVal);
        const candidateMsg = messages.find((m) => m.id === candidate);

        if (!candidateMsg) {
          next[userId] = candidate;
          changed = true;
          continue;
        }
        if (!prevMsg) {
          next[userId] = candidate;
          changed = true;
          continue;
        }

        const prevTime = new Date(prevMsg.createdAt).getTime();
        const candidateTime = new Date(candidateMsg.createdAt).getTime();
        if (candidateTime > prevTime) {
          next[userId] = candidate;
          changed = true;
        }
      }

      if (process.env.NODE_ENV !== 'production' && changed) {
        console.debug('[ArcYouChatRoom] readByUser initialized from members', {
          roomId: id,
          next,
        });
      }

      return changed ? next : prev;
    });
  }, [members, messages, id]);

  const enhancedMessages = useMemo(() => {
    if (!members || members.length === 0) return messages;

    // 모든 참여자 목록 (자기 자신 포함)
    const participants = members;

    const withMeta = messages.map((m) => {
      const messageId = typeof m.id === 'string' ? m.id : String(m.id);
      const messageCreatedAt = new Date(m.createdAt).getTime();

      // 이 메시지를 아직 읽지 않은 사용자 목록 (자기 자신 포함)
      const unreadUsers = participants.filter((p) => {
        const lastReadMessageId = readByUser[p.userId];
        if (!lastReadMessageId) {
          return true; // 아직 읽지 않음
        }
        // 마지막 읽은 메시지의 createdAt과 현재 메시지의 createdAt 비교
        const lastReadMsg = messages.find((msg) => msg.id === lastReadMessageId);
        if (!lastReadMsg) {
          return true; // 읽은 메시지를 찾을 수 없으면 읽지 않은 것으로 간주
        }
        const lastReadCreatedAt = new Date(lastReadMsg.createdAt).getTime();
        return lastReadCreatedAt < messageCreatedAt;
      });

      const unreadCount = unreadUsers.length;

      return {
        ...m,
        unreadCount,
        unreadUsers,
      };
    });

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[ArcYouChatRoom] enhancedMessages summary', {
        roomId: id,
        totalMessages: messages.length,
        participants: participants.map((p) => p.userId),
        readByUser,
      });
    }

    return withMeta;
  }, [messages, members, readByUser, id]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const messageValue = formData.get('message') as string;
    if (messageValue.trim()) {
      const ws = socketRef.current;
      if (!isAuthedRef.current || !isJoinedRef.current) {
        setMessage('');
        return;
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        const tempId = `temp-${Date.now()}`;
        const optimistic: ArcyouChatMessage = {
          id: tempId,
          roomId: id,
          userId: currentUserId,
          type: 'text',
          content: messageValue,
          status: 'sending',
          createdAt: new Date(),
        };
        setMessages((prev) => {
          const index = prev.length;
          pendingMapRef.current = { ...pendingMapRef.current, [tempId]: index };
          // 아직 서버 id 없으므로 lastMessageIdRef 갱신 없음
          return [...prev, optimistic];
        });
        ws.send(
          JSON.stringify({
            op: 'room',
            action: 'send',
            roomId: id,
            content: { text: messageValue },
            tempId,
          }),
        );
      }
      setMessage('');
    }
  };

  return (
    <div ref={rootRef} className={cn('flex flex-col h-full w-full relative', className)}>
      <div className="flex-1 min-h-0">
        <ArcYouChatMessageList messages={enhancedMessages} currentUserId={currentUserId} />
      </div>
      <div
        className="w-full max-w-2xl pt-0 px-2 pb-2 bg-transparent absolute left-0 right-0 bottom-0 mx-auto z-20"
        data-arc-input-wrapper="1"
      >
        <Input
          onSubmit={handleSubmit}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="메시지를 입력하세요..."
          submitDisabled={!message.trim() || !ready}
        />
      </div>
    </div>
  );
}


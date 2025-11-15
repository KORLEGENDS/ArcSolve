'use client';

import { cn } from '@/client/components/ui/utils';
import { clientEnv } from '@/share/configs/environments/client-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [ready, setReady] = useState<boolean>(false); // auth + join 완료 여부
  const socketRef = useRef<WebSocket | null>(null);
  const pendingMapRef = useRef<Record<string, number>>({});
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageIdRef = useRef<number | null>(null);
  const persistedIdSetRef = useRef<Set<number>>(new Set());
  const isAuthedRef = useRef<boolean>(false);
  const isJoinedRef = useRef<boolean>(false);

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
    if (lastId == null || !Number.isFinite(lastId)) return;
    ws.send(
      JSON.stringify({
        op: 'room',
        action: 'ack',
        roomId: id,
        lastReadMessageId: lastId,
      }),
    );
  }, [id]);

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
                setCurrentUserId(String(data.userId));
                isAuthedRef.current = true;
                // 선히스토리 로드 (최신 N개) 후 join → backfill로 겹쳐도 dedupe 처리
                (async () => {
                  try {
                    const res = await fetch(`/api/arcyou/chat/room/${id}/messages?limit=50`, { method: 'GET' });
                    if (res.ok) {
                      const body = (await res.json()) as {
                        success: boolean;
                        data?: { messages?: Array<{ id: number; userId: string; content: unknown; createdAt?: string }> };
                      };
                      const items = body?.data?.messages ?? [];
                      if (items.length > 0) {
                        // 서버는 DESC 반환 → ASC로 정렬하여 앞쪽에 배치
                        const asc = [...items].reverse();
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
                          return next.length > 0 ? [...next, ...prev] : prev;
                        });
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
              isJoinedRef.current = !!data?.success;
              setReady(!!data?.success);
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
                    if (typeof data.message.id === 'number') {
                      lastMessageIdRef.current = data.message.id;
                      persistedIdSetRef.current.add(data.message.id);
                    }
                    scheduleAck();
                    return copy;
                  }
                }
                // 중복 방지: 이미 존재하는 서버 id면 상태만 delivered로 승격
                if (typeof data.message.id === 'number' && persistedIdSetRef.current.has(data.message.id)) {
                  const idx = prev.findIndex((m) => m.id === data.message.id);
                  if (idx >= 0) {
                    const copy = prev.slice();
                    copy[idx] = { ...copy[idx], status: 'delivered', createdAt };
                    return copy;
                  }
                  return prev;
                }
                const next: ArcyouChatMessage = {
                  id: data.message.id,
                  roomId: id,
                  userId: String(data.message.user_id),
                  type: 'text',
                  content: contentText,
                  status: 'delivered',
                  createdAt,
                };
                const out = [...prev, next];
                if (typeof data.message.id === 'number') {
                  lastMessageIdRef.current = data.message.id;
                  persistedIdSetRef.current.add(data.message.id);
                }
                scheduleAck();
                return out;
              });
              return;
            }
            if (data.op === 'room' && data.event === 'sent') {
              const res = data as {
                success: boolean;
                messageId?: number;
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
                    res.success && typeof res.messageId === 'number'
                      ? res.messageId
                      : target.id,
                  status: res.success ? 'sent' : 'failed',
                };
                const nextMap = { ...pendingMapRef.current };
                delete nextMap[res.tempId!];
                pendingMapRef.current = nextMap;
                if (res.success && typeof res.messageId === 'number') {
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
    };
  }, [id, wsUrl]);

  // roomId 변경 시 메시지 로컬 상태 초기화 (의존성 최소화)
  useEffect(() => {
    pendingMapRef.current = {};
    lastMessageIdRef.current = null;
    setMessages([]);
  }, [id]);

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
        <ArcYouChatMessageList messages={messages} currentUserId={currentUserId} />
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


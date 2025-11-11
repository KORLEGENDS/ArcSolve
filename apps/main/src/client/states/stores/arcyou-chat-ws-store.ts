import type { ArcyouChatMessage } from '@/client/components/arc/ArcYou/ArcYouChat/components/ArcYouChatMessage';
import { clientEnv } from '@/share/configs/environments/client-constants';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'joining'
  | 'ready'
  | 'closed'
  | 'error';

type WsEvent =
  | { op: 'auth'; success: boolean; userId?: string; error?: string }
  | { op: 'join'; success: boolean; room_id?: string; error?: string }
  | {
      op: 'event';
      type: 'message.created';
      roomId: string;
      message: {
        id: number;
        user_id: string;
        content: unknown;
        created_at?: string;
        temp_id?: string;
      };
      timestamp: string;
      source: 'backfill' | 'live';
    }
  | {
      op: 'send';
      success: boolean;
      message_id?: number;
      temp_id?: string;
      error?: string;
    }
  | {
      op: 'ack';
      success: boolean;
      room_id?: string;
      last_read_message_id?: number;
      error?: string;
    }
  | { op: string; [k: string]: unknown };

interface ArcYouChatWsState {
  status: ConnectionStatus;
  socket: WebSocket | null;
  roomId: string | null;
  userId: string | null;
  lastReadByRoom: Record<string, number>;
  messagesByRoom: Record<string, ArcyouChatMessage[]>;
  pendingByTempId: Record<string, { roomId: string; index: number }>;
  // actions
  connect: (roomId: string) => Promise<void>;
  sendMessage: (text: string) => void;
  ackIfNeeded: (roomId: string) => void;
  disconnect: () => void;
}

function toDisplayText(content: unknown): string {
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
}

function nowIso(): string {
  return new Date().toISOString();
}

export const useArcyouChatWsStore = create<ArcYouChatWsState>()(
  subscribeWithSelector((set, get) => ({
    status: 'idle',
    socket: null,
    roomId: null,
    userId: null,
    lastReadByRoom: {},
    messagesByRoom: {},
    pendingByTempId: {},

    connect: async (roomId: string) => {
      if (!roomId) return;
      // If already connected to same room, skip
      if (get().status === 'ready' && get().roomId === roomId) return;

      const wsUrl = clientEnv.NEXT_PUBLIC_CHAT_WS_URL;
      if (!wsUrl) {
        set({ status: 'error' });
        return;
      }

      set({ status: 'connecting', roomId });
      let tokenResp: { token: string; expiresIn: string } | null = null;
      try {
        const r = await fetch('/api/ws/token', { method: 'GET' });
        if (!r.ok) {
          set({ status: 'error' });
          return;
        }
        tokenResp = (await r.json()) as { token: string; expiresIn: string };
      } catch {
        set({ status: 'error' });
        return;
      }

      const ws = new WebSocket(wsUrl);
      set({ socket: ws });

      ws.addEventListener('open', () => {
        set({ status: 'authenticating' });
        ws.send(JSON.stringify({ op: 'auth', token: tokenResp!.token }));
      });

      ws.addEventListener('close', () => {
        set({ status: 'closed', socket: null });
      });

      ws.addEventListener('error', () => {
        set({ status: 'error' });
      });

      ws.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse(ev.data as string) as WsEvent;
          const state = get();

          if (data.op === 'auth') {
            if ((data as any).success) {
              const userId = (data as any).userId as string | undefined;
              set({ status: 'joining', userId: userId ?? null });
              state.socket?.send(JSON.stringify({ op: 'join', room_id: state.roomId }));
            } else {
              set({ status: 'error' });
            }
            return;
          }

          if (data.op === 'join') {
            if ((data as any).success) {
              set({ status: 'ready' });
            } else {
              set({ status: 'error' });
            }
            return;
          }

          if (data.op === 'event' && (data as any).type === 'message.created') {
            const evt = data as Extract<WsEvent, { op: 'event' }>;
            const rid = evt.roomId;
            const arr = get().messagesByRoom[rid] ?? [];
            const text = toDisplayText(evt.message.content);
            const createdAt = evt.message.created_at ?? nowIso();

            // Dedup with temp_id if exists
            if (evt.message.temp_id) {
              const key = evt.message.temp_id;
              const pending = get().pendingByTempId[key];
              if (pending && pending.roomId === rid) {
                // upgrade optimistic message
                const copy = arr.slice();
                const idx = pending.index;
                if (copy[idx]) {
                  copy[idx] = {
                    ...copy[idx],
                    id: evt.message.id,
                    status: 'delivered',
                    createdAt,
                  };
                  const nextPending = { ...get().pendingByTempId };
                  delete nextPending[key];
                  set({
                    messagesByRoom: { ...get().messagesByRoom, [rid]: copy },
                    pendingByTempId: nextPending,
                  });
                  return;
                }
              }
            }

            const msg: ArcyouChatMessage = {
              id: evt.message.id,
              roomId: rid,
              userId: evt.message.user_id,
              type: 'text',
              content: text,
              status: 'delivered',
              createdAt,
            };
            set({
              messagesByRoom: {
                ...get().messagesByRoom,
                [rid]: [...arr, msg],
              },
            });
            // ack debounce
            get().ackIfNeeded(rid);
            return;
          }

          if (data.op === 'send') {
            const res = data as Extract<WsEvent, { op: 'send' }>;
            if (!res.temp_id) return;
            const pending = get().pendingByTempId[res.temp_id];
            if (!pending) return;
            const rid = pending.roomId;
            const arr = get().messagesByRoom[rid] ?? [];
            const idx = pending.index;
            if (arr[idx]) {
              const copy = arr.slice();
              if (res.success && res.message_id) {
                copy[idx] = { ...copy[idx], id: res.message_id, status: 'sent' };
              } else {
                copy[idx] = { ...copy[idx], status: 'failed' };
              }
              const nextPending = { ...get().pendingByTempId };
              delete nextPending[res.temp_id];
              set({
                messagesByRoom: { ...get().messagesByRoom, [rid]: copy },
                pendingByTempId: nextPending,
              });
            }
            return;
          }
        } catch {
          // ignore parse errors
        }
      });
    },

    sendMessage: (text: string) => {
      const s = get();
      if (!s.socket || s.socket.readyState !== WebSocket.OPEN) return;
      if (!s.roomId || !s.userId) return;
      const tempId = `temp-${Date.now()}`;
      const rid = s.roomId;
      const optimistic: ArcyouChatMessage = {
        id: tempId,
        roomId: rid,
        userId: s.userId,
        type: 'text',
        content: text,
        status: 'sending',
        createdAt: new Date(),
      };
      const current = get().messagesByRoom[rid] ?? [];
      const index = current.length;
      set({
        messagesByRoom: {
          ...get().messagesByRoom,
          [rid]: [...current, optimistic],
        },
        pendingByTempId: {
          ...get().pendingByTempId,
          [tempId]: { roomId: rid, index },
        },
      });
      s.socket.send(
        JSON.stringify({
          op: 'send',
          room_id: rid,
          content: { text },
          temp_id: tempId,
        }),
      );
    },

    ackIfNeeded: (roomId: string) => {
      const s = get();
      if (!s.socket || s.socket.readyState !== WebSocket.OPEN) return;
      const arr = s.messagesByRoom[roomId] ?? [];
      if (arr.length === 0) return;
      const last = arr[arr.length - 1];
      if (typeof last.id !== 'number') return;
      s.socket.send(
        JSON.stringify({
          op: 'ack',
          room_id: roomId,
          last_read_message_id: last.id,
        }),
      );
    },

    disconnect: () => {
      const s = get();
      try {
        s.socket?.close();
      } catch {
        // ignore
      }
      set({ socket: null, status: 'closed' });
    },
  })),
);



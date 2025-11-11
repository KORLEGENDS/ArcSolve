'use client';

import { useEffect, useMemo } from 'react';
import { useArcyouChatWsStore } from '@/client/states/stores/arcyou-chat-ws-store';
import type { ArcyouChatMessage } from '@/client/components/arc/ArcYou/ArcYouChat/components/ArcYouChatMessage';
import type { ConnectionStatus } from '@/client/states/stores/arcyou-chat-ws-store';

export interface UseArcYouWebSocketResult {
  status: ConnectionStatus;
  roomId: string | null;
  currentUserId: string | null;
  messages: ArcyouChatMessage[];
  sendMessage: (text: string) => void;
}

export function useArcYouWebSocket(): UseArcYouWebSocketResult {
  const status = useArcyouChatWsStore((s) => s.status);
  const connect = useArcyouChatWsStore((s) => s.connect);
  const sendMessage = useArcyouChatWsStore((s) => s.sendMessage);
  const roomId = useArcyouChatWsStore((s) => s.roomId);
  const userId = useArcyouChatWsStore((s) => s.userId);
  const messagesByRoom = useArcyouChatWsStore((s) => s.messagesByRoom);

  // roomId from URL query
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const rid = params.get('roomId');
      if (rid) {
        void connect(rid);
      }
    } catch {
      // ignore
    }
  }, [connect]);

  const messages = useMemo<ArcyouChatMessage[]>(() => {
    if (!roomId) return [];
    return messagesByRoom[roomId] ?? [];
  }, [roomId, messagesByRoom]);

  return {
    status,
    roomId,
    currentUserId: userId,
    messages,
    sendMessage,
  };
}



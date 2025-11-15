'use client';

import { cn } from '@/client/components/ui/utils';
import { useArcYouChatRoom, useChatRoomMembers } from '@/client/states/queries/arcyou/useArcyouChat';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from './components/ArcYouChatInput/ArcYouChatInput';
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

  // 채팅방 WebSocket 연결 및 메시지 관리
  const { messages, currentUserId, ready, sendMessage, readByUser, setReadByUser } =
    useArcYouChatRoom(id);

  // 채팅방 멤버 목록 (이름/아바타 등)
  const { data: members } = useChatRoomMembers(id);

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

    return withMeta;
  }, [messages, members, readByUser, id]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const messageValue = formData.get('message') as string;
    if (messageValue.trim()) {
      sendMessage(messageValue);
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


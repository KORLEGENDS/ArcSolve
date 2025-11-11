'use client';

import { ArcWorkDynamic, type ArcWorkProps } from '@/client/components/arc/ArcWork';
import { ArcYouChatRoom, type ArcyouChatMessage } from '@/client/components/arc/ArcYou/ArcYouChat';
import type { TabNode } from 'flexlayout-react';
import { useCallback, useState } from 'react';

interface ArcWorkWithChatRoomProps extends Omit<ArcWorkProps, 'factory'> {
  // ArcWork의 factory prop을 제외한 모든 props
}

export function ArcWorkWithChatRoom(props: ArcWorkWithChatRoomProps) {
  // 더미 메시지 데이터
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  const [messages, setMessages] = useState<ArcyouChatMessage[]>([
    {
      id: 1,
      roomId: 'demo-room',
      userId: 'user-2',
      type: 'text',
      content: '오늘 점심 뭐 드셨어요?',
      status: 'read',
      createdAt: tenMinutesAgo,
    },
    {
      id: 2,
      roomId: 'demo-room',
      userId: 'user-1',
      type: 'text',
      content: '파스타 먹었어요. 맛있었는데요!',
      status: 'delivered',
      createdAt: fiveMinutesAgo,
    },
    {
      id: 3,
      roomId: 'demo-room',
      userId: 'user-2',
      type: 'text',
      content: '부럽네요 😊',
      status: 'read',
      createdAt: now,
    },
  ]);

  const currentUserId = 'user-1';

  const handleSubmit = useCallback((message: string) => {
    const newMessage: ArcyouChatMessage = {
      id: Date.now(),
      roomId: 'demo-room',
      userId: currentUserId,
      type: 'text',
      content: message,
      status: 'sent',
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  const factory = useCallback(
    (node: TabNode) => {
      const component = node.getComponent();

      if (component === 'arcyou-chat-room') {
        return (
          <div className="h-full w-full">
            <ArcYouChatRoom
              messages={messages}
              currentUserId={currentUserId}
              onSubmit={handleSubmit}
            />
          </div>
        );
      }

      // 기본 placeholder 처리
      if (component === 'placeholder') {
        return <div className="p-4">{node.getName()}</div>;
      }

      return null;
    },
    [messages, handleSubmit]
  );

  return <ArcWorkDynamic {...props} factory={factory} />;
}


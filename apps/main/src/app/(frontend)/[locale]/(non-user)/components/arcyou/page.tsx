'use client';

import {
  ArcYouChatRoom,
  ArcYouChatRoomList,
  type ArcYouChatRoomListItemProps,
  type ArcyouChatMessage,
} from '@/client/components/arc/ArcYou/ArcYouChat';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { useState } from 'react';

export default function ArcYouDemoPage() {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  // 채팅방별 메시지 데이터
  const [roomMessages, setRoomMessages] = useState<Record<string, ArcyouChatMessage[]>>({
    'room-1': [
      {
        id: 3,
        roomId: 'room-1',
        userId: 'user-2',
        type: 'text' as const,
        content: '오늘 점심 뭐 드셨어요?',
        status: 'read' as const,
        createdAt: tenMinutesAgo,
      },
      {
        id: 4,
        roomId: 'room-1',
        userId: 'user-1',
        type: 'text' as const,
        content: '파스타 먹었어요. 맛있었는데요!',
        status: 'delivered' as const,
        createdAt: fiveMinutesAgo,
      },
      {
        id: 5,
        roomId: 'room-1',
        userId: 'user-2',
        type: 'text' as const,
        content: '부럽네요 😊',
        status: 'read' as const,
        createdAt: now,
      },
      {
        id: 6,
        roomId: 'room-1',
        userId: 'user-1',
        type: 'text' as const,
        content:
          '이것은 매우 긴 메시지입니다. 여러 줄에 걸쳐서 표시되는 메시지의 예시입니다. 텍스트가 길어질 경우 자동으로 줄바꿈이 되고, 메시지 박스의 최대 너비는 70%로 제한됩니다.',
        status: 'sent' as const,
        createdAt: now,
      },
      {
        id: 7,
        roomId: 'room-1',
        userId: 'user-1',
        type: 'text' as const,
        content: '이전 메시지에 대한 답장입니다.',
        replyToMessageId: 3,
        status: 'sent' as const,
        createdAt: now,
      },
    ],
    'room-2': [
      {
        id: 20,
        roomId: 'room-2',
        userId: 'user-3',
        type: 'text' as const,
        content: '안녕하세요!',
        status: 'read' as const,
        createdAt: twoHoursAgo,
      },
      {
        id: 21,
        roomId: 'room-2',
        userId: 'user-1',
        type: 'text' as const,
        content: '네, 안녕하세요!',
        status: 'read' as const,
        createdAt: oneHourAgo,
      },
    ],
    'room-3': [
      {
        id: 30,
        roomId: 'room-3',
        userId: 'user-4',
        type: 'text' as const,
        content: '프로젝트 진행 상황 공유드립니다.',
        status: 'read' as const,
        createdAt: oneHourAgo,
      },
    ],
  });

  // 채팅방 목록 데이터
  const [rooms] = useState<ArcYouChatRoomListItemProps[]>([
    {
      id: 'room-1',
      name: '친구 1',
      description: '부럽네요 😊',
      onClick: () => setSelectedRoomId('room-1'),
      menuOptions: [
        {
          label: '대화방 정보',
          onClick: () => console.log('친구 1 - 대화방 정보'),
        },
        {
          label: '알림 끄기',
          onClick: () => console.log('친구 1 - 알림 끄기'),
        },
        {
          label: '대화방 나가기',
          onClick: () => console.log('친구 1 - 대화방 나가기'),
          separator: true,
        },
      ],
    },
    {
      id: 'room-2',
      name: '친구 2',
      description: '네, 안녕하세요!',
      onClick: () => setSelectedRoomId('room-2'),
      menuOptions: [
        {
          label: '대화방 정보',
          onClick: () => console.log('친구 2 - 대화방 정보'),
        },
        {
          label: '알림 끄기',
          onClick: () => console.log('친구 2 - 알림 끄기'),
        },
        {
          label: '대화방 나가기',
          onClick: () => console.log('친구 2 - 대화방 나가기'),
          separator: true,
        },
      ],
    },
    {
      id: 'room-3',
      name: '프로젝트 팀',
      description: '프로젝트 진행 상황 공유드립니다.',
      onClick: () => setSelectedRoomId('room-3'),
      menuOptions: [
        {
          label: '대화방 정보',
          onClick: () => console.log('프로젝트 팀 - 대화방 정보'),
        },
        {
          label: '알림 끄기',
          onClick: () => console.log('프로젝트 팀 - 알림 끄기'),
        },
        {
          label: '대화방 나가기',
          onClick: () => console.log('프로젝트 팀 - 대화방 나가기'),
          separator: true,
        },
      ],
    },
  ]);

  const [selectedRoomId, setSelectedRoomId] = useState<string>('room-1');

  const currentMessages = roomMessages[selectedRoomId] || [];

  const handleSubmit = (message: string) => {
    const newMessage: ArcyouChatMessage = {
      id: Date.now(),
      roomId: selectedRoomId,
      userId: 'user-1',
      type: 'text',
      content: message,
      status: 'sent',
      createdAt: new Date(),
    };
    setRoomMessages((prev) => ({
      ...prev,
      [selectedRoomId]: [...(prev[selectedRoomId] || []), newMessage],
    }));
  };

  return (
    <main className="min-h-screen w-full p-6">
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>ArcYouChat 데모</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 h-[600px]">
              {/* 좌측: 채팅방 목록 */}
              <div className="w-64 border-r border-border overflow-y-auto">
                <div className="p-2">
                  <ArcYouChatRoomList rooms={rooms} />
                </div>
              </div>
              {/* 우측: 선택된 채팅방 */}
              <div className="flex-1 p-4 border rounded-lg bg-muted/30">
                <ArcYouChatRoom id={selectedRoomId} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}


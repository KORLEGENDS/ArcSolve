'use client';

import {
  ArcYouChatRoomList,
  type ArcYouChatRoomListItemProps,
  type ArcYouChatRoomMenuOption,
} from '@/client/components/arc/ArcYou/ArcYouChat';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { useState } from 'react';

export default function ArcYouChatRoomListDemoPage() {
  const [selectedAction, setSelectedAction] = useState<string>('');

  const handleMenuAction = (roomTitle: string, action: string) => {
    setSelectedAction(`${roomTitle} - ${action}`);
    console.log(`Room: ${roomTitle}, Action: ${action}`);
  };

  const rooms: ArcYouChatRoomListItemProps[] = [
    {
      title: '친구 1',
      description: '부럽네요 😊',
      menuOptions: [
        {
          label: '대화방 정보',
          onClick: () => handleMenuAction('친구 1', '대화방 정보'),
        },
        {
          label: '알림 끄기',
          onClick: () => handleMenuAction('친구 1', '알림 끄기'),
        },
        {
          label: '대화방 나가기',
          onClick: () => handleMenuAction('친구 1', '대화방 나가기'),
          separator: true,
        },
      ],
    },
    {
      title: '친구 2',
      description: '네, 안녕하세요!',
      menuOptions: [
        {
          label: '대화방 정보',
          onClick: () => handleMenuAction('친구 2', '대화방 정보'),
        },
        {
          label: '알림 끄기',
          onClick: () => handleMenuAction('친구 2', '알림 끄기'),
        },
        {
          label: '대화방 나가기',
          onClick: () => handleMenuAction('친구 2', '대화방 나가기'),
          separator: true,
        },
      ],
    },
    {
      title: '프로젝트 팀',
      description: '프로젝트 진행 상황 공유드립니다.',
      menuOptions: [
        {
          label: '대화방 정보',
          onClick: () => handleMenuAction('프로젝트 팀', '대화방 정보'),
        },
        {
          label: '알림 끄기',
          onClick: () => handleMenuAction('프로젝트 팀', '알림 끄기'),
        },
        {
          label: '대화방 나가기',
          onClick: () => handleMenuAction('프로젝트 팀', '대화방 나가기'),
          separator: true,
        },
      ],
    },
    {
      title: '메뉴 없는 채팅방',
      description: '메뉴 옵션이 없는 경우입니다.',
    },
  ];

  return (
    <main className="min-h-screen w-full p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>ArcYouChatRoomList 데모</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/30">
                <ArcYouChatRoomList rooms={rooms} />
              </div>
              {selectedAction && (
                <div className="p-3 bg-muted rounded-md text-sm">
                  <strong>선택된 액션:</strong> {selectedAction}
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                <p>• 각 채팅방 항목에 마우스를 올리면 ... 아이콘이 나타납니다.</p>
                <p>• ... 아이콘을 클릭하면 메뉴 옵션이 표시됩니다.</p>
                <p>• 채팅방 항목을 클릭하면 선택됩니다.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}


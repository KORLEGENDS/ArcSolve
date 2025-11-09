'use client';

import {
  ArcYouChatRoomList,
  type ArcYouChatRoomListItemProps,
} from '@/client/components/arc/ArcYou/ArcYouChat';
import { Input } from '@/client/components/ui/input';
import * as React from 'react';

export function RightSidebarContent() {
  const rooms: ArcYouChatRoomListItemProps[] = React.useMemo(
    () => [
      {
        title: '친구 1',
        description: '부럽네요 😊',
        onClick: () => console.log('친구 1 채팅방 선택'),
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
        title: '친구 2',
        description: '네, 안녕하세요!',
        onClick: () => console.log('친구 2 채팅방 선택'),
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
        title: '프로젝트 팀',
        description: '프로젝트 진행 상황 공유드립니다.',
        onClick: () => console.log('프로젝트 팀 채팅방 선택'),
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
      {
        title: '디자인 팀',
        description: '새로운 디자인 가이드라인 공유',
        onClick: () => console.log('디자인 팀 채팅방 선택'),
        menuOptions: [
          {
            label: '대화방 정보',
            onClick: () => console.log('디자인 팀 - 대화방 정보'),
          },
          {
            label: '알림 끄기',
            onClick: () => console.log('디자인 팀 - 알림 끄기'),
          },
          {
            label: '대화방 나가기',
            onClick: () => console.log('디자인 팀 - 대화방 나가기'),
            separator: true,
          },
        ],
      },
      {
        title: '개발 팀',
        description: '코드 리뷰 요청',
        onClick: () => console.log('개발 팀 채팅방 선택'),
        menuOptions: [
          {
            label: '대화방 정보',
            onClick: () => console.log('개발 팀 - 대화방 정보'),
          },
          {
            label: '알림 끄기',
            onClick: () => console.log('개발 팀 - 알림 끄기'),
          },
          {
            label: '대화방 나가기',
            onClick: () => console.log('개발 팀 - 대화방 나가기'),
            separator: true,
          },
        ],
      },
    ],
    []
  );

  return (
    <div className="h-full w-full flex flex-col">
      {/* 검색 바 */}
        <Input type="search" placeholder="채팅방 검색..." className="w-full" />
      {/* 채팅방 목록 */}
      <div className="flex-1 overflow-y-auto p-2 w-full">
        <ArcYouChatRoomList rooms={rooms} />
      </div>
    </div>
  );
}


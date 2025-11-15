'use client';

import * as React from 'react';

import { cn } from '@/client/components/ui/utils';
import { useArcyouChat } from '@/client/states/queries/arcyou/useArcyouChat';
import { useServiceEnsureOpenTab, useServiceStartAddTabDrag } from '@/client/states/stores/service-store';

import {
  ArcYouChatRoomListItem,
  type ArcYouChatRoomListItemProps,
} from './components/ArcYouChatRoomListItem';

export interface ArcYouChatRoomListProps {
  type: 'direct' | 'group';
  className?: string;
}

const STATUS_BASE_CLASS = 'flex items-center justify-center py-8 text-sm w-full';

export function ArcYouChatRoomList({
  type,
  className,
}: ArcYouChatRoomListProps): React.ReactElement {
  const ensureOpen = useServiceEnsureOpenTab();
  const startAddTabDrag = useServiceStartAddTabDrag();
  const { data, isLoading, error } = useArcyouChat(type);

  const normalizedRooms = React.useMemo<ArcYouChatRoomListItemProps[]>(() => {
    if (!data) return [];

    return data.map<ArcYouChatRoomListItemProps>((room) => ({
      id: room.id,
      name: room.name,
      description: room.description ?? undefined,
      lastMessageId: room.lastMessageId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      deletedAt: null,
      onClick: () => {
        console.log(`채팅방 선택: ${room.name} (${room.id})`);
      },
      menuOptions: [
        {
          label: '대화방 정보',
          onClick: () => {
            console.log(`대화방 정보: ${room.name} (${room.id})`);
          },
        },
        {
          label: '알림 끄기',
          onClick: () => {
            console.log(`알림 끄기: ${room.name} (${room.id})`);
          },
        },
        {
          label: '대화방 나가기',
          onClick: () => {
            console.log(`대화방 나가기: ${room.name} (${room.id})`);
          },
          separator: true,
        },
      ],
    }));
  }, [data]);

  const renderStatus = (message: string, isError = false) => (
    <div
      className={cn(
        STATUS_BASE_CLASS,
        isError ? 'text-destructive' : 'text-muted-foreground',
        className
      )}
    >
      {message}
    </div>
  );

  if (isLoading) {
    return renderStatus('채팅 목록을 불러오는 중...');
  }

  if (error) {
    return renderStatus('채팅 목록을 불러오는 중 오류가 발생했습니다.', true);
  }

  if (normalizedRooms.length === 0) {
    return renderStatus('참여 중인 채팅이 없습니다.');
  }

  return (
    <div className={cn('w-full flex flex-col', className)}>
      {normalizedRooms.map((room) => {
        const id = room.id;
        const targetType = 'arcyou-chat-room';
        const name = room.name;

        return (
          <div
            key={room.id}
            draggable
            onDragStart={(e) => {
              // 통합 드래그 시작(존재 시 move, 미존재 시 add). 레이아웃 미존재 시 내부에서 폴백 처리.
              startAddTabDrag(e, { id, type: targetType, name });
            }}
            onDoubleClick={() => {
              ensureOpen({ id, type: targetType, name });
            }}
          >
            <ArcYouChatRoomListItem {...room} />
          </div>
        );
      })}
    </div>
  );
}


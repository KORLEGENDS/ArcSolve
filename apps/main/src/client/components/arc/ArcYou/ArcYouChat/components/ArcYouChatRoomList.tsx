'use client';

import * as React from 'react';

import { cn } from '@/client/components/ui/utils';
import { useServiceEnsureOpenTab, useServiceStartAddTabDrag } from '@/client/states/stores/service-store';

import {
  ArcYouChatRoomListItem,
  type ArcYouChatRoomListItemProps,
} from './ArcYouChatRoomListItem';

export interface ArcYouChatRoomListProps {
  rooms: ArcYouChatRoomListItemProps[];
  className?: string;
}

export function ArcYouChatRoomList({
  rooms,
  className,
}: ArcYouChatRoomListProps): React.ReactElement {
  const ensureOpen = useServiceEnsureOpenTab();
  const startAddTabDrag = useServiceStartAddTabDrag();

  return (
    <div className={cn('w-full flex flex-col', className)}>
      {rooms.map((room) => {
        const id = `chat:room:${room.id}`;
        const type = 'arcyou-chat-room';
        const name = room.name;
        const content = { roomId: room.id };

        return (
          <div
            key={room.id}
            draggable
            onDragStart={(e) => {
              // 통합 드래그 시작(존재 시 move, 미존재 시 add). 레이아웃 미존재 시 내부에서 폴백 처리.
              startAddTabDrag(e, { id, type, name, content });
            }}
            onDoubleClick={() => {
              ensureOpen({ id, type, name, content });
            }}
          >
            <ArcYouChatRoomListItem
              id={room.id}
              name={room.name}
              description={room.description}
              lastMessageId={room.lastMessageId}
              createdAt={room.createdAt}
              updatedAt={room.updatedAt}
              deletedAt={room.deletedAt}
              icon={room.icon}
              className={room.className}
              onClick={room.onClick}
              menuOptions={room.menuOptions}
            />
          </div>
        );
      })}
    </div>
  );
}


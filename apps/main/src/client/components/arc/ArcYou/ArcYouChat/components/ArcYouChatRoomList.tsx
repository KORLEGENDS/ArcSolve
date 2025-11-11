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
      {rooms.map((room, index) => (
        <div
          key={room.title || index}
          draggable
          onDragStart={(e) => {
            const id = `chat:room:${room.title || index}`;
            const type = 'arcyou-chat-room';
            const name = room.title || id;
            const content = { title: room.title, index };
            // 통합 드래그 시작(존재 시 move, 미존재 시 add). 레이아웃 미존재 시 내부에서 폴백 처리.
            startAddTabDrag(e, { id, type, name, content });
          }}
          onDoubleClick={() => {
            const id = `chat:room:${room.title || index}`;
            const type = 'arcyou-chat-room';
            const name = room.title || id;
            const content = { title: room.title, index };
            ensureOpen({ id, type, name, content });
          }}
        >
          <ArcYouChatRoomListItem
            title={room.title}
            description={room.description}
            icon={room.icon}
            className={room.className}
            onClick={room.onClick}
            menuOptions={room.menuOptions}
          />
        </div>
      ))}
    </div>
  );
}


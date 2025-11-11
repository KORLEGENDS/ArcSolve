'use client';

import * as React from 'react';

import { cn } from '@/client/components/ui/utils';

import {
    ArcYouChatRoomListItem,
    type ArcYouChatRoomListItemProps,
} from './components/ArcYouChatRoomListItem/ArcYouChatRoomListItem';

export interface ArcYouChatRoomListProps {
  rooms: ArcYouChatRoomListItemProps[];
  className?: string;
}

export function ArcYouChatRoomList({
  rooms,
  className,
}: ArcYouChatRoomListProps): React.ReactElement {
  return (
    <div className={cn('w-full flex flex-col', className)}>
      {rooms.map((room, index) => (
        <ArcYouChatRoomListItem
          key={room.title || index}
          title={room.title}
          description={room.description}
          icon={room.icon}
          className={room.className}
          onClick={room.onClick}
          menuOptions={room.menuOptions}
        />
      ))}
    </div>
  );
}


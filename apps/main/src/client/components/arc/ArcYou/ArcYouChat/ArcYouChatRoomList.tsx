'use client';

import * as React from 'react';

import { cn } from '@/client/components/ui/utils';
import { useArcyouChat } from '@/client/states/queries/arcyou/useArcyouChat';
import {
  useArcWorkEnsureOpenTab,
  setArcWorkTabDragData,
} from '@/client/states/stores/arcwork-layout-store';

import {
  ArcYouChatRoomListItem,
  type ArcYouChatRoomListItemProps,
} from './components/ArcYouChatRoomListItem';

export interface ArcYouChatRoomListProps {
  type: 'direct' | 'group';
  className?: string;
}

const STATUS_BASE_CLASS = 'flex items-center justify-center py-8 text-sm w-full';

/**
 * 메시지 content JSON에서 프리뷰 텍스트를 추출합니다.
 * @param content 메시지 content (JSON 객체, 예: { text: "..." } 또는 { url: "...", alt: "..." })
 * @returns 프리뷰 텍스트 문자열 (없으면 null)
 */
function getMessagePreview(content: unknown): string | null {
  if (!content || typeof content !== 'object') {
    return null;
  }

  // text 타입: content.text 반환
  if ('text' in content && typeof content.text === 'string') {
    return content.text;
  }

  // image 타입: "[이미지]" 반환
  if ('url' in content || 'imageUrl' in content) {
    return '[이미지]';
  }

  // file 타입: "[파일] {파일명}" 반환
  if ('fileName' in content || 'fileUrl' in content) {
    let fileName = '파일';
    if ('fileName' in content && typeof content.fileName === 'string') {
      fileName = content.fileName;
    } else if ('name' in content && typeof content.name === 'string') {
      fileName = content.name;
    }
    return `[파일] ${fileName}`;
  }

  // system 타입: "[시스템 메시지]" 반환
  if ('type' in content && content.type === 'system') {
    return '[시스템 메시지]';
  }

  // 알 수 없는 타입: null 반환
  return null;
}

export function ArcYouChatRoomList({
  type,
  className,
}: ArcYouChatRoomListProps): React.ReactElement {
  const ensureOpen = useArcWorkEnsureOpenTab();
  const { data, isLoading, error } = useArcyouChat(type);

  const normalizedRooms = React.useMemo<ArcYouChatRoomListItemProps[]>(() => {
    if (!data) return [];

    return data.map<ArcYouChatRoomListItemProps>((room) => ({
      id: room.id,
      name: room.name,
      lastMessage: room.lastMessage ? getMessagePreview(room.lastMessage.content) : null,
      imageUrl: room.imageUrl,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      deletedAt: null,
      unreadCount: room.unreadCount,
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
              // ArcWork external drag용 payload만 설정합니다.
              setArcWorkTabDragData(e, { id, type: targetType, name });
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


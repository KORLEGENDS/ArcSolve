'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/client/components/ui/popover';
import { cn } from '@/client/components/ui/utils';
import * as React from 'react';

// Types
export type MessageType = 'text' | 'image' | 'file' | 'system';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ArcyouChatMessage {
  id: string;
  roomId: string;
  userId: string;
  type: MessageType;
  content: string;
  replyToMessageId?: string | null;
  status: MessageStatus;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  /**
   * 이 메시지를 아직 읽지 않은 다른 사용자 수
   * - 클라이언트에서 room.read 이벤트와 멤버 목록을 기반으로 계산
   */
  unreadCount?: number;
  /**
   * 이 메시지를 아직 읽지 않은 사용자 목록
   * - popover/hovercard에서 사용자 이름/아바타를 표시할 때 사용
   */
  unreadUsers?: Array<{
    userId: string;
    name: string;
    imageUrl?: string | null;
  }>;
}

export interface ArcYouChatMessageProps {
  message: ArcyouChatMessage;
  isOwnMessage?: boolean;
  className?: string;
}

export function ArcYouChatMessage({
  message,
  isOwnMessage = false,
  className,
}: ArcYouChatMessageProps): React.ReactElement {
  // 텍스트 타입만 처리
  if (message.type !== 'text') {
    return (
      <div className={cn('text-sm text-muted-foreground p-3', className)}>
        지원하지 않는 메시지 타입입니다.
      </div>
    );
  }

  // 삭제된 메시지 처리
  if (message.deletedAt) {
    return (
      <div className={cn('text-sm text-muted-foreground p-3', className)}>
        삭제된 메시지입니다.
      </div>
    );
  }

  const timeString = new Date(message.createdAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const unreadCount = message.unreadCount ?? 0;
  const unreadUsers = message.unreadUsers ?? [];
  const hasUnreadInfo = unreadCount > 0 && unreadUsers.length > 0;

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const trimmed = name.trim();
    if (!trimmed) return '?';
    return trimmed[0]?.toUpperCase() ?? '?';
  };

  return (
    <div
      className={cn(
        'group flex items-end gap-2 py-2',
        isOwnMessage ? 'justify-end' : 'justify-start',
        className
      )}
    >
      {/* 메시지 박스 */}
      <div
        className={cn(
          'max-w-[70%] rounded-xl px-3 py-2 text-sm',
          isOwnMessage ? 'bg-primary order-2' : 'bg-muted order-1'
        )}
      >
        <div className="wrap-break-word whitespace-pre-wrap">{message.content}</div>
        {message.replyToMessageId && (
          <div className="mt-1 text-xs opacity-70">답장: {message.replyToMessageId}</div>
        )}
      </div>
      {/* 시간: 메시지 박스 hover 시에만 표시 */}
      <div
        className={cn(
          'flex flex-col gap-1 text-xs text-muted-foreground whitespace-nowrap opacity-0 transition-opacity duration-200',
          'group-hover:opacity-100',
          isOwnMessage ? 'items-start order-1' : 'items-end order-2'
        )}
      >
        {/* 1행: 읽지 않은 사용자 수 (있을 때만 표시) */}
        {hasUnreadInfo ? (
          (() => {
            if (process.env.NODE_ENV !== 'production' && isOwnMessage) {
              console.debug('[ArcYouChatMessage] unread info', {
                messageId: message.id,
                unreadCount,
                unreadUserIds: unreadUsers.map((u) => u.userId),
              });
            }
            return null;
          })() || (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center justify-center rounded-full px-2 py-px text-[0.65rem] font-medium',
                  'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {unreadCount}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align={isOwnMessage ? 'start' : 'end'}
              side={isOwnMessage ? 'left' : 'right'}
              className="p-2 w-56"
            >
              <div className="mb-1 text-xs font-medium text-foreground">
                읽지 않은 사용자
              </div>
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                {unreadUsers.map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center gap-2 text-xs text-foreground"
                  >
                    <Avatar className="size-6">
                      {user.imageUrl && (
                        <AvatarImage src={user.imageUrl} alt={user.name || 'user'} />
                      )}
                      <AvatarFallback className="text-[0.6rem] font-medium">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                      {user.name || '알 수 없는 사용자'}
                    </span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )) : null}
        {/* 2행: 시간 */}
        <div className="flex items-center gap-1">
          <span>{timeString}</span>
        </div>
      </div>
    </div>
  );
}


'use client';

import { cn } from '@/client/components/ui/utils';
import * as React from 'react';

// Types
export type MessageType = 'text' | 'image' | 'file' | 'system';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ArcyouChatMessage {
  id: string | number;
  roomId: string;
  userId: string;
  type: MessageType;
  content: string;
  replyToMessageId?: string | number | null;
  status: MessageStatus;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  deletedAt?: Date | string | null;
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

  const statusIcon =
    isOwnMessage &&
    (message.status === 'sending'
      ? '전송 중'
      : message.status === 'sent'
        ? '✓'
        : message.status === 'delivered'
          ? '✓✓'
          : message.status === 'read'
            ? '✓✓'
            : message.status === 'failed'
              ? '✗'
              : '');

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
        <div className="flex items-center gap-1">
          <span>{timeString}</span>
          {isOwnMessage && statusIcon && <span className="text-[0.625rem]">{statusIcon}</span>}
        </div>
      </div>
    </div>
  );
}


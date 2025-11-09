'use client';

import { cn } from '@/client/components/ui/utils';
import * as React from 'react';
import styles from './ArcYouChatMessage.module.css';

// Types
export type MessageType = 'text' | 'image' | 'file' | 'system';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface UserChatMessage {
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
  message: UserChatMessage;
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
      <div className={cn(styles.errorMessage, className)}>
        지원하지 않는 메시지 타입입니다.
      </div>
    );
  }

  // 삭제된 메시지 처리
  if (message.deletedAt) {
    return (
      <div className={cn(styles.errorMessage, className)}>
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
        styles.container,
        isOwnMessage ? styles.containerOwn : styles.containerOther,
        className
      )}
    >
      {/* 메시지 박스 */}
      <div
        className={cn(
          styles.messageBox,
          isOwnMessage ? styles.messageBoxOwn : styles.messageBoxOther
        )}
      >
        <div className={styles.content}>{message.content}</div>
        {message.replyToMessageId && (
          <div className={styles.replyInfo}>답장: {message.replyToMessageId}</div>
        )}
      </div>
      {/* 시간: 메시지 박스 hover 시에만 표시 */}
      <div
        className={cn(
          styles.timeContainer,
          isOwnMessage ? styles.timeContainerOwn : styles.timeContainerOther
        )}
      >
        <div className={styles.timeWrapper}>
          <span>{timeString}</span>
          {isOwnMessage && statusIcon && <span className={styles.statusIcon}>{statusIcon}</span>}
        </div>
      </div>
    </div>
  );
}


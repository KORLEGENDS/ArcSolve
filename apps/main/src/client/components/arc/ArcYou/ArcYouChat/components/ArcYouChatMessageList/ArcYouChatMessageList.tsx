'use client';

import { cn } from '@/client/components/ui/utils';
import { StickToBottom } from 'use-stick-to-bottom';
import type { UserChatMessage } from '../ArcYouChatMessage/ArcYouChatMessage';
import { ArcYouChatMessage } from '../ArcYouChatMessage/ArcYouChatMessage';
import styles from './ArcYouChatMessageList.module.css';

// Types
export interface ArcYouChatMessageListProps {
  messages: UserChatMessage[];
  currentUserId: string;
  className?: string;
}

export function ArcYouChatMessageList({
  messages,
  currentUserId,
  className,
}: ArcYouChatMessageListProps): React.ReactElement {
  return (
    <StickToBottom
      className={cn(styles.container, className)}
      initial="smooth"
      resize="smooth"
      role="log"
    >
      <StickToBottom.Content className={styles.content}>
        <div className={styles.messagesWrapper}>
          {messages.map((message) => (
            <ArcYouChatMessage
              key={message.id}
              message={message}
              isOwnMessage={message.userId === currentUserId}
            />
          ))}
        </div>
      </StickToBottom.Content>
    </StickToBottom>
  );
}


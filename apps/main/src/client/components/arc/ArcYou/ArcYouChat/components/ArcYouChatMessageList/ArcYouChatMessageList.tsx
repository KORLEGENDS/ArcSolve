'use client';

import { cn } from '@/client/components/ui/utils';
import { StickToBottom } from 'use-stick-to-bottom';
import type { ArcyouChatMessage } from '../ArcYouChatMessage/ArcYouChatMessage';
import { ArcYouChatMessage } from '../ArcYouChatMessage/ArcYouChatMessage';

// Types
export interface ArcYouChatMessageListProps {
  messages: ArcyouChatMessage[];
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
      className={cn('h-full overflow-y-auto', className)}
      initial="smooth"
      resize="smooth"
      role="log"
    >
      <StickToBottom.Content className="flex flex-col gap-2 pb-[120px] pt-3">
        <div className="px-3">
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


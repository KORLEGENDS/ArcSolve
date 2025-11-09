'use client';

import { cn } from '@/client/components/ui/utils';
import { useRef, useState } from 'react';
import { Input } from '../ArcYouChatInput/ArcYouChatInput';
import type { UserChatMessage } from '../ArcYouChatMessage/ArcYouChatMessage';
import { ArcYouChatMessageList } from '../ArcYouChatMessageList/ArcYouChatMessageList';
import styles from './ArcYouChatRoom.module.css';

export interface ArcYouChatRoomProps {
  messages: UserChatMessage[];
  currentUserId: string;
  onSubmit?: (message: string) => void;
  className?: string;
}

export function ArcYouChatRoom({
  messages,
  currentUserId,
  onSubmit,
  className,
}: ArcYouChatRoomProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const messageValue = formData.get('message') as string;
    if (messageValue.trim()) {
      onSubmit?.(messageValue);
      setMessage('');
    }
  };

  return (
    <div ref={rootRef} className={cn(styles.arcChatRoomContainer, className)}>
      <div className={styles.chatArea}>
        <ArcYouChatMessageList messages={messages} currentUserId={currentUserId} />
      </div>
      <div className={styles.inputWrapper} data-arc-input-wrapper="1">
        <Input
          onSubmit={handleSubmit}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="메시지를 입력하세요..."
          submitDisabled={!message.trim()}
        />
      </div>
    </div>
  );
}


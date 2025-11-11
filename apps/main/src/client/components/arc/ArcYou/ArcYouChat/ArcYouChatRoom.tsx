'use client';

import { cn } from '@/client/components/ui/utils';
import { useRef, useState } from 'react';
import { Input } from './components/ArcYouChatInput/ArcYouChatInput';
import type { ArcyouChatMessage } from './components/ArcYouChatMessage';
import { ArcYouChatMessageList } from './components/ArcYouChatMessageList';

export interface ArcYouChatRoomProps {
  messages: ArcyouChatMessage[];
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
    <div ref={rootRef} className={cn('flex flex-col h-full w-full relative', className)}>
      <div className="flex-1 min-h-0">
        <ArcYouChatMessageList messages={messages} currentUserId={currentUserId} />
      </div>
      <div
        className="w-full max-w-2xl pt-0 px-2 pb-2 bg-transparent absolute left-0 right-0 bottom-0 mx-auto z-20"
        data-arc-input-wrapper="1"
      >
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


'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAIChat, useAIConversation } from '@/client/states/queries/ai/useAI';
import styles from './ArcAI.module.css';
import { ArcAIInput } from './components/ArcAIInput/ArcAIInput';
import { ArcAIMessageList } from './components/ArcAIMessageList/ArcAIMessageList';

export interface ArcAIProps {
  /** AI 세션으로 사용할 document.documentId */
  documentId: string;
}

export const ArcAI = ({ documentId }: ArcAIProps) => {
  // 서버에 저장된 이전 대화 히스토리 로드 (Redis → Postgres)
  const { messages: initialMessages, isLoading: isLoadingHistory } =
    useAIConversation(documentId);

  // AI SDK useChat 기반 스트리밍 훅
  const { messages, sendMessage, status } = useAIChat({
    documentId,
    initialMessages,
    // 현재는 스트림 재개(resume) 기능을 사용하지 않습니다.
    // 필요 시 resumable-stream 패턴을 도입한 뒤 true로 전환합니다.
    resume: false,
  });

  const [draft, setDraft] = useState('');
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [didScrollAfterHistory, setDidScrollAfterHistory] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text) return;

      // 마지막 메시지 1개를 서버로 전송하면,
      // 나머지 히스토리는 서버에서 Redis/PG를 통해 복원합니다.
      void sendMessage({ text });
      setDraft('');
    },
    [draft, sendMessage],
  );

  // 2) 이전 대화 히스토리를 모두 불러온 직후 한 번만 맨 아래로 스크롤
  useEffect(() => {
    if (
      !isLoadingHistory &&
      !didScrollAfterHistory &&
      (initialMessages?.length ?? 0) > 0
    ) {
      setScrollTrigger((prev) => prev + 1);
      setDidScrollAfterHistory(true);
    }
  }, [isLoadingHistory, didScrollAfterHistory, initialMessages]);

  return (
    <div className={styles.container}>
      <div className={styles.chatArea}>
        <ArcAIMessageList
          messages={messages}
          scrollTrigger={scrollTrigger}
          emptyTitle={
            isLoadingHistory ? '대화 히스토리를 불러오는 중입니다.' : undefined
          }
        />
      </div>

      <div className={styles.inputWrapper}>
        <ArcAIInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onSubmit={handleSubmit}
          submitDisabled={
            draft.trim().length === 0 || status === 'streaming'
          }
        />
      </div>
    </div>
  );
};

export default ArcAI;


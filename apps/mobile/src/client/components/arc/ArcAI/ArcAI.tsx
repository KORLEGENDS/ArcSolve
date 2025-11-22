/**
 * ArcAI 메인 컴포넌트
 * AI 채팅 인터페이스
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAIChat, useAIConversation } from '@/client/states/queries/ai/useAI';
import { ArcAIInput } from './components/ArcAIInput/ArcAIInput';
import { ArcAIMessageList } from './components/ArcAIMessageList/ArcAIMessageList';

export interface ArcAIProps {
  /** AI 세션으로 사용할 document.documentId */
  documentId: string;
}

export function ArcAI({ documentId }: ArcAIProps) {
  // 서버에 저장된 이전 대화 히스토리 로드
  const { messages: initialMessages, isLoading: isLoadingHistory } =
    useAIConversation(documentId);

  // AI SDK 기반 스트리밍 훅
  const { messages, sendMessage, status, stop, regenerate, setMessages } =
    useAIChat({
      documentId,
      initialMessages,
      resume: false,
    });

  const [draft, setDraft] = useState('');
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [didScrollAfterHistory, setDidScrollAfterHistory] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const isStoppable = status === 'submitted' || status === 'streaming';

  const handleStartEdit = useCallback(
    (messageId: string, initialText: string) => {
      setEditingMessageId(messageId);
      setEditingText(initialText);
    },
    []
  );

  const handleChangeEditText = useCallback((value: string) => {
    setEditingText(value);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingText('');
  }, []);

  const handleRetryAssistant = useCallback(
    (messageId: string) => {
      regenerate({ messageId });
    },
    [regenerate]
  );

  const handleConfirmEdit = useCallback(
    (messageId: string) => {
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === messageId);
        if (index === -1) return prev;

        const target = prev[index];
        if (target.role !== 'user') return prev;

        // 대상 user 메시지의 text 파츠만 수정
        const newParts = target.parts.map((part: any) =>
          part.type === 'text' && typeof part.text === 'string'
            ? { ...part, text: editingText }
            : part
        );

        // 수정 대상 이후의 메시지는 모두 잘라내고, 해당 시점부터 다시 생성
        const head = prev.slice(0, index);
        const updatedTarget = { ...target, parts: newParts };
        return [...head, updatedTarget];
      });

      regenerate({ messageId });
      setEditingMessageId(null);
      setEditingText('');
    },
    [editingText, regenerate, setMessages]
  );

  const handleSubmit = useCallback(
    (e: { preventDefault: () => void }) => {
      e.preventDefault();

      // 응답이 진행 중일 때는 새 전송을 막습니다.
      if (isStoppable) return;

      const text = draft.trim();
      if (!text) return;

      // 마지막 메시지 1개를 서버로 전송하면,
      // 나머지 히스토리는 서버에서 Redis/PG를 통해 복원합니다.
      void sendMessage({ text });
      setDraft('');
    },
    [draft, isStoppable, sendMessage]
  );

  // 이전 대화 히스토리를 모두 불러온 직후 한 번만 맨 아래로 스크롤
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
    <View style={styles.container}>
      <View style={styles.chatArea}>
        <ArcAIMessageList
          messages={messages}
          aiStatus={status}
          emptyTitle={
            isLoadingHistory ? '대화 히스토리를 불러오는 중입니다.' : undefined
          }
        />
      </View>

      <View style={styles.inputWrapper}>
        <ArcAIInput
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          submitMode={isStoppable ? 'stop' : 'send'}
          onClickSubmitButton={() => {
            if (isStoppable) {
              stop();
            }
          }}
          submitDisabled={isStoppable ? false : draft.trim().length === 0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  chatArea: {
    flex: 1,
  },
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
});


'use client';

import { useChat } from '@ai-sdk/react';
import { useQuery } from '@tanstack/react-query';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useEffect } from 'react';

import {
  aiQueryOptions,
  type DocumentAIConversationResponse,
} from '@/share/libs/react-query/query-options';

export interface UseAIConversationResult {
  data: DocumentAIConversationResponse | undefined;
  messages: UIMessage[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<DocumentAIConversationResponse>;
}

/**
 * 특정 documentId에 대한 AI 대화 히스토리를 불러오는 훅
 * - GET /api/document/ai/[documentId] 호출
 * - 서버에서는 Redis → Postgres 순으로 로드
 */
export function useAIConversation(documentId: string): UseAIConversationResult {
  const query = useQuery(aiQueryOptions.conversation(documentId));

  const refetch = async () => {
    const res = await query.refetch();
    if (res.data) return res.data;
    throw res.error ?? new Error('AI 대화 히스토리 조회에 실패했습니다.');
  };

  return {
    data: query.data,
    messages: query.data?.messages ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}

export interface UseAIChatOptions {
  /**
   * document 기반 AI 세션의 ID
   */
  documentId: string;
  /**
   * 서버에서 미리 불러온 초기 메시지들
   * - 보통 useAIConversation(documentId).messages 를 그대로 전달
   */
  initialMessages?: UIMessage[];
  /**
   * 중단된 스트림을 자동으로 재개할지 여부
   */
  resume?: boolean;
}

export function useAIChat(options: UseAIChatOptions) {
  const { documentId, initialMessages, resume } = options;

  const chat = useChat({
    id: documentId,
    messages: initialMessages ?? [],
    // 현재는 서버에서 스트림 복원용 GET 라우트를 따로 구현하지 않았으므로
    // 기본값은 false 로 두고, 필요 시 명시적으로 true 로 넘깁니다.
    resume: resume ?? false,
    transport: new DefaultChatTransport({
      api: `/api/document/ai/${encodeURIComponent(documentId)}/stream`,
      /**
       * ArcSolve 서버의 /api/document/ai/[documentId]/stream POST 스펙에 맞게
       * 새 메시지(마지막 메시지 1개)만 전송합니다.
       *
       * 나머지 이전 히스토리는 서버에서 Redis/PG 를 통해 복원합니다.
       */
      prepareSendMessagesRequest: ({ messages }) => {
        const last = messages[messages.length - 1];

        return {
          body: {
            messages: last ? [last] : [],
          },
        };
      },
    }),
  });

  // 서버에서 불러온 초기 히스토리가 준비되면 useChat 상태에 주입
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      chat.setMessages(initialMessages);
    }
  }, [initialMessages, chat.setMessages]);

  return chat;
}





/**
 * AI 채팅 관련 훅
 * React Native 환경에 맞게 구현
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
import { aiQueryOptions, type DocumentAIConversationResponse } from '@/share/libs/react-query/query-options/ai';
import type { UIMessage } from 'ai';
import { API_BASE_URL } from '@/share/configs/environments/client-constants';
import { useAuthStore } from '@/client/states/stores/auth-store';

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

export interface UseAIChatResult {
  messages: UIMessage[];
  sendMessage: (options: { text: string }) => Promise<void>;
  status: 'idle' | 'submitted' | 'streaming' | 'error';
  stop: () => void;
  regenerate: (options?: { messageId?: string }) => void;
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>;
}

/**
 * AI 채팅 훅 (React Native 환경)
 * 스트리밍 처리를 위한 커스텀 구현
 */
export function useAIChat(options: UseAIChatOptions): UseAIChatResult {
  const { documentId, initialMessages = [], resume = false } = options;
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [status, setStatus] = useState<'idle' | 'submitted' | 'streaming' | 'error'>('idle');
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // 초기 메시지가 변경되면 상태 업데이트
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const sendMessage = useCallback(async ({ text }: { text: string }) => {
    if (!text.trim()) return;

    const userMessage: UIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      parts: [{ type: 'text', text }],
    };

    // 사용자 메시지 추가
    setMessages((prev) => [...prev, userMessage]);
    setStatus('submitted');

    const controller = new AbortController();
    setAbortController(controller);

    try {
      // 액세스 토큰 포함 (전역 상태에서 가져오기)
      const accessToken = useAuthStore.getState().accessToken;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/document/ai/${encodeURIComponent(documentId)}/stream`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: [...messages, userMessage],
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      setStatus('streaming');

      // 스트림 읽기
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let assistantMessage: UIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        parts: [{ type: 'text', text: '' }],
      };

      setMessages((prev) => [...prev, assistantMessage]);

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setStatus('idle');
              return;
            }

            try {
              const chunk = JSON.parse(data);
              if (chunk.type === 'text-delta' && chunk.textDelta) {
                assistantMessage = {
                  ...assistantMessage,
                  parts: [
                    {
                      type: 'text',
                      text: (assistantMessage.parts[0] as any)?.text + chunk.textDelta,
                    },
                  ],
                };
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = assistantMessage;
                  return updated;
                });
              }
            } catch (e) {
              // JSON 파싱 실패 무시
            }
          }
        }
      }

      setStatus('idle');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      setStatus('error');
      console.error('AI chat error:', error);
    } finally {
      setAbortController(null);
    }
  }, [documentId, messages]);

  const stop = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setStatus('idle');
    }
  }, [abortController]);

  const regenerate = useCallback((options?: { messageId?: string }) => {
    // 재생성 로직 구현
    const messageId = options?.messageId;
    if (messageId) {
      // 특정 메시지 이후의 메시지 제거하고 재생성
      const index = messages.findIndex((m) => m.id === messageId);
      if (index !== -1) {
        setMessages((prev) => prev.slice(0, index));
        // 마지막 사용자 메시지로 재전송
        const lastUserMessage = messages[index - 1];
        if (lastUserMessage && lastUserMessage.role === 'user') {
          const text = (lastUserMessage.parts[0] as any)?.text;
          if (text) {
            void sendMessage({ text });
          }
        }
      }
    }
  }, [messages, sendMessage]);

  return {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    setMessages,
  };
}


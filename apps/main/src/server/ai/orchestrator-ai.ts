import {
  loadConversationWithCache,
  saveConversationSnapshot,
  saveLastAiUserMessage,
} from '@/server/ai/io-ai';
import { SYSTEM_PROMPT } from '@/server/ai/prompt-ai';
import { createDocumentAiTools } from '@/server/ai/tools-ai';
import { throwApi } from '@/server/api/errors';
import { DocumentAiRepository } from '@/share/schema/repositories/document-ai-repository';
import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createIdGenerator,
  stepCountIs,
  streamText,
  type UIMessage,
  validateUIMessages,
} from 'ai';

interface CreateChatStreamParams {
  documentId: string;
  userId: string;
  newMessages: UIMessage[];
}

/**
 * 문서 AI 채팅 스트림 생성 및 오케스트레이션
 */
export async function createDocumentChatStream(params: CreateChatStreamParams) {
  const { documentId, userId, newMessages } = params;
  const repository = new DocumentAiRepository();

  // 1. 이전 히스토리 로드 (Redis → 없으면 Postgres)
  const previousMessages = await loadConversationWithCache({
    documentId,
    userId,
    repository,
  });

  const allMessages: UIMessage[] = [...previousMessages, ...newMessages];

  if (allMessages.length === 0) {
    throwApi('BAD_REQUEST', '유효한 메시지가 없습니다.');
  }

  // 2. AI SDK의 validateUIMessages로 메시지 검증
  let validatedMessages: UIMessage[];
  try {
    validatedMessages = await validateUIMessages({
      messages: allMessages,
    });
  } catch (error: unknown) {
    console.error('메시지 검증 실패:', error);
    console.error('메시지 내용:', JSON.stringify(allMessages, null, 2));
    throwApi('BAD_REQUEST', '메시지 형식이 올바르지 않습니다.', {
      details: String(error),
    });
  }

  if (validatedMessages.length === 0) {
    throwApi('BAD_REQUEST', '유효한 메시지가 없습니다.');
  }

  // 3. AI 스트리밍 생성
  const result = streamText({
    model: openai('gpt-5.1'),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(validatedMessages),
    tools: createDocumentAiTools(userId),
    // 무한 루프 방지를 위해 도구 호출 횟수 제한
    stopWhen: stepCountIs(8),
  });

  // 스트림이 완료되어도 메시지가 저장되도록 consumeStream 호출
  result.consumeStream();

  const idGenerator = createIdGenerator({
    prefix: 'msg',
    size: 16,
  });

  // 4. 스트림 응답 생성 및 반환
  return result.toUIMessageStreamResponse({
    originalMessages: allMessages,
    generateMessageId: idGenerator,
    onError: (err) => {
      console.error('[DocumentAiService] Streaming error:', err);

      if (err == null) {
        return '알 수 없는 오류가 발생했습니다.';
      }

      if (typeof err === 'string') {
        return err;
      }

      if (err instanceof Error) {
        if (err.message.includes('rate limit')) {
          return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        }
        if (err.message.includes('invalid')) {
          return '잘못된 요청입니다. 입력을 확인해주세요.';
        }
        return err.message;
      }

      return JSON.stringify(err);
    },
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return {
          createdAt: Date.now(),
          model: 'gpt-5.1',
        };
      }
      if (part.type === 'finish') {
        return {
          totalTokens: part.totalUsage?.totalTokens,
          inputTokens: part.totalUsage?.inputTokens,
          outputTokens: part.totalUsage?.outputTokens,
        };
      }
      return undefined;
    },
    onFinish: async ({ messages: completedMessages }) => {
      try {
        await repository.replaceConversationForOwner({
          documentId,
          userId,
          messages: completedMessages,
        });

        // 전체 대화 스냅샷을 Redis 에도 반영
        await saveConversationSnapshot({
          userId,
          documentId,
          messages: completedMessages,
        });

        const lastUserMessage = [...completedMessages]
          .filter((msg) => msg.role === 'user')
          .at(-1);

        if (lastUserMessage) {
          await saveLastAiUserMessage({
            userId,
            documentId,
            message: lastUserMessage,
          });
        }
      } catch (err) {
        console.error('[DocumentAiService] 대화 저장/캐시 중 오류:', err);
      }
    },
  });
}

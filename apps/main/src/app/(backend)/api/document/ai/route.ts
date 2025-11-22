import {
  loadConversationWithCache,
  saveConversationSnapshot,
  saveLastAiUserMessage,
} from '@/server/ai/document-ai-cache';
import { callEmbedSearchTool, callTextSearchTool, callTreeListTool } from '@/server/ai/sidecar-tools';
import { ApiException, throwApi } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { DocumentAiRepository } from '@/share/schema/repositories/document-ai-repository';
import { openai } from '@ai-sdk/openai';
import { auth } from '@auth';
import {
  convertToModelMessages,
  createIdGenerator,
  stepCountIs,
  streamText,
  type UIMessage,
  validateUIMessages,
} from 'ai';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

// 스트리밍 응답 최대 시간 (초)
export const maxDuration = 60;

const AI_CHAT_MIME_TYPE = 'application/vnd.arc.ai-chat+json';

const embedSearchInputSchema = z.object({
  query: z
    .string()
    .min(1, '검색 질의는 비어 있을 수 없습니다.')
    .describe(
      '파일/청크 내부에 실제로 등장하는 문장·키워드 등 구체적인 검색어를 그대로 입력하세요. (예: "벡터 DB 인덱스 구조")',
    ),
  topK: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(5)
    .describe('최대 반환 개수'),
});

const textSearchInputSchema = z.object({
  query: z
    .string()
    .min(1, '검색 질의는 비어 있을 수 없습니다.')
    .describe(
      '파일/청크에 포함된 단어·문장을 그대로 적은 검색어를 입력하세요. 목적/명령이 아닌, 찾고 싶은 실제 텍스트여야 합니다.',
    ),
  topK: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(5)
    .describe('최대 반환 개수'),
});

const treeListInputSchema = z.object({
  rootPath: z
    .string()
    .default('root')
    .describe("문서 트리의 루트 경로 (예: 'root', 'root.folder')"),
  maxDepth: z
    .number()
    .int()
    .min(0)
    .max(10)
    .default(2)
    .describe('rootPath 기준으로 내려갈 최대 깊이'),
});

const SYSTEM_PROMPT = `
당신은 사용자의 개인 지식 베이스(두 번째 뇌)를 탐색하는 RAG 에이전트입니다.

당신은 다음 도구에 접근할 수 있습니다:
- embedSearch: 임베딩 기반 의미 검색 (요약/개방형 질문에 적합)
- textSearch: 키워드/문구 기준의 텍스트 검색 (정확한 단어 검색에 적합)
- treeList: 사용자의 문서 트리 구조를 나열

- 규칙:
- 질문이 업로드된 문서/노트/PDF 등의 내용에 의존하는 것 같다면,
  반드시 먼저 embedSearch 또는 textSearch, 필요 시 treeList 를 사용하여
  관련 문맥을 조회한 뒤 그 결과를 바탕으로 답변하세요.
- 일반적인 상식/프로그래밍 등, 저장된 문서와 무관한 질문이라면
  굳이 도구를 호출하지 말고 모델만으로 답변해도 됩니다.
- 어떤 도구를 쓸지 애매하다면:
  - 요약/개념 설명/의미 기반 질문: embedSearch를 우선 사용
  - 특정 단어/문구가 포함된 부분을 찾는 질문: textSearch를 우선 사용
- embedSearch/textSearch를 호출할 때 query 필드에는 문서 안에 실제로 등장하는
  문장·단어·키워드를 그대로 넣고, "이 파일 내용을 찾아줘" 같은 목적/명령은 넣지 마세요.
- 도구에서 의미 있는 결과를 찾지 못한 경우,
  "현재 저장된 문서에서 관련 정보를 찾을 수 없다"는 점을 명시하고,
  그 이후의 일반적인 추론/설명은 추측임을 분명히 표기하세요.
- 모든 답변은 자연스러운 한국어로 작성하십시오.
`.trim();

const requestBodySchema = z.object({
  documentId: z.string().uuid(),
  messages: z.array(z.unknown()) as z.ZodType<UIMessage[]>,
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return error('UNAUTHORIZED', '인증이 필요합니다.', {
        user: session?.user
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
      });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return error('BAD_REQUEST', 'documentId 쿼리 파라미터가 필요합니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    const repository = new DocumentAiRepository();
    const messages = await loadConversationWithCache({
      documentId,
      userId,
      repository,
    });

    return ok(
      {
        documentId,
        mimeType: AI_CHAT_MIME_TYPE,
        messages,
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: 'AI 대화 히스토리를 성공적으로 조회했습니다.',
      },
    );
  } catch (err) {
    console.error('[GET /api/document/ai] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', 'AI 대화 히스토리 조회 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throwApi('UNAUTHORIZED', '인증이 필요합니다.');
    }

    const userId = session.user.id;

    const raw = (await request.json().catch(() => undefined)) as unknown;
    const parsed = requestBodySchema.safeParse(raw);

    if (!parsed.success) {
      throwApi('BAD_REQUEST', '요청 본문이 올바르지 않습니다.', {
        issues: parsed.error.flatten(),
      });
    }

    const { documentId, messages: newMessages } = parsed.data;

    const repository = new DocumentAiRepository();

    // 이전 히스토리 로드 (Redis → 없으면 Postgres)
    const previousMessages = await loadConversationWithCache({
      documentId,
      userId,
      repository,
    });

    const allMessages: UIMessage[] = [...previousMessages, ...newMessages];

    if (allMessages.length === 0) {
      throwApi('BAD_REQUEST', '유효한 메시지가 없습니다.');
    }

    // AI SDK의 validateUIMessages로 메시지 검증
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

    const result = streamText({
      model: openai('gpt-5.1'),
      system: SYSTEM_PROMPT,
      messages: convertToModelMessages(validatedMessages),
      tools: {
        embedSearch: {
          description:
            '사용자의 문서에서 의미(임베딩) 기반 검색을 수행합니다.',
          inputSchema: embedSearchInputSchema,
          execute: async ({ query, topK }) => {
            const results = await callEmbedSearchTool({
              userId,
              query,
              topK,
            });
            return { results };
          },
        },
        textSearch: {
          description:
            '사용자의 문서에서 키워드/문구 기반 텍스트 검색을 수행합니다.',
          inputSchema: textSearchInputSchema,
          execute: async ({ query, topK }) => {
            const results = await callTextSearchTool({
              userId,
              query,
              topK,
            });
            return { results };
          },
        },
        treeList: {
          description: '사용자의 문서 트리 구조를 조회합니다.',
          inputSchema: treeListInputSchema,
          execute: async ({ rootPath, maxDepth }) => {
            const items = await callTreeListTool({
              userId,
              rootPath,
              maxDepth,
            });
            return { items };
          },
        },
      },
      // 무한 루프 방지를 위해 도구 호출 횟수 제한
      stopWhen: stepCountIs(8),
    });

    // 스트림이 완료되어도 메시지가 저장되도록 consumeStream 호출
    result.consumeStream();

    const idGenerator = createIdGenerator({
      prefix: 'msg',
      size: 16,
    });

    const errorHandler = (err: unknown): string => {
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
    };

    return result.toUIMessageStreamResponse({
      originalMessages: allMessages,
      generateMessageId: idGenerator,
      onError: (err) => {
        console.error('[POST /api/document/ai] Streaming error:', err);
        return errorHandler(err);
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
          console.error(
            '[POST /api/document/ai] 대화 저장/캐시 중 오류:',
            err,
          );
        }
      },
    });
  } catch (err) {
    console.error('[POST /api/document/ai] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', 'AI 대화 처리 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}



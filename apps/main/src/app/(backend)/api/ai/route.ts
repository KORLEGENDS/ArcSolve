import { loadChat, loadUserChats, saveChat } from "@/server/ai/chat-store";
import {
  callEmbedSearchTool,
  callTextSearchTool,
  callTreeListTool,
} from "@/server/ai/sidecar-tools";
import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createIdGenerator,
  stepCountIs,
  streamText,
  type UIMessage,
  validateUIMessages,
} from "ai";
import { z } from "zod";

// 스트리밍 응답 최대 시간 (초)
export const maxDuration = 60;

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

function isValidUUID(value: string | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value,
  );
}

const embedSearchInputSchema = z.object({
  query: z
    .string()
    .min(1, "검색 질의는 비어 있을 수 없습니다.")
    .describe(
      "파일/청크 내부에 실제로 등장하는 문장·키워드 등 구체적인 검색어를 그대로 입력하세요. (예: \"벡터 DB 인덱스 구조\")",
    ),
  topK: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(5)
    .describe("최대 반환 개수"),
  pathPrefix: z
    .string()
    .optional()
    .describe("ltree 기반 Document.path prefix (예: 'root.demo')"),
});

const textSearchInputSchema = z.object({
  query: z
    .string()
    .min(1, "검색 질의는 비어 있을 수 없습니다.")
    .describe(
      "파일/청크에 포함된 단어·문장을 그대로 적은 검색어를 입력하세요. 목적/명령이 아닌, 찾고 싶은 실제 텍스트여야 합니다.",
    ),
  topK: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(5)
    .describe("최대 반환 개수"),
  pathPrefix: z
    .string()
    .optional()
    .describe("ltree 기반 Document.path prefix (예: 'root.demo')"),
});

const treeListInputSchema = z.object({
  rootPath: z
    .string()
    .default("root")
    .describe("문서 트리의 루트 경로 (예: 'root', 'root.folder')"),
  maxDepth: z
    .number()
    .int()
    .min(0)
    .max(10)
    .default(2)
    .describe("rootPath 기준으로 내려갈 최대 깊이"),
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

// 채팅 목록 조회
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? "default";

  try {
    const chats = await loadUserChats(userId);
    return Response.json({ chats });
  } catch (error) {
    console.error("채팅 목록 불러오기 실패:", error);
    return Response.json(
      { error: "채팅 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const {
    messages,
    chatId,
    userId,
    pathPrefix,
  }: {
    messages?: UIMessage[];
    chatId?: string;
    userId?: string;
    pathPrefix?: string;
  } = await req.json();

  let allMessages: UIMessage[];

  if (chatId) {
    // 기존 채팅 불러오기
    const previousMessages = await loadChat(chatId);
    // 새 메시지가 있으면 추가
    if (messages && messages.length > 0) {
      allMessages = [...previousMessages, ...messages];
    } else {
      allMessages = previousMessages;
    }
  } else {
    // 새 채팅이거나 메시지가 제공된 경우
    allMessages = messages || [];
  }

  // 메시지가 없으면 에러 반환
  if (allMessages.length === 0) {
    return Response.json(
      { error: "유효한 메시지가 없습니다." },
      { status: 400 },
    );
  }

  // AI SDK의 validateUIMessages로 메시지 검증
  // validateUIMessages는 메시지가 올바른 형식인지 검증하고 변환합니다
  let validatedMessages: UIMessage[];
  try {
    validatedMessages = await validateUIMessages({
      messages: allMessages,
    });
  } catch (error) {
    console.error("메시지 검증 실패:", error);
    console.error("메시지 내용:", JSON.stringify(allMessages, null, 2));
    return Response.json(
      { error: "메시지 형식이 올바르지 않습니다.", details: String(error) },
      { status: 400 },
    );
  }

  // 검증 후 메시지가 없으면 에러 반환
  if (validatedMessages.length === 0) {
    return Response.json(
      { error: "유효한 메시지가 없습니다." },
      { status: 400 },
    );
  }

  // TODO: 실제 서비스에서는 인증 정보를 기반으로 userId를 결정해야 함
  const effectiveUserId = isValidUUID(userId) ? userId : DEFAULT_USER_ID;

  const result = streamText({
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(validatedMessages),
    tools: {
      embedSearch: {
        description:
          "사용자의 문서에서 의미(임베딩) 기반 검색을 수행합니다.",
        inputSchema: embedSearchInputSchema,
        execute: async ({ query, topK, pathPrefix: localPathPrefix }) => {
          const results = await callEmbedSearchTool({
            userId: effectiveUserId,
            query,
            topK,
            pathPrefix: localPathPrefix ?? pathPrefix,
          });
          return { results };
        },
      },
      textSearch: {
        description:
          "사용자의 문서에서 키워드/문구 기반 텍스트 검색을 수행합니다.",
        inputSchema: textSearchInputSchema,
        execute: async ({ query, topK, pathPrefix: localPathPrefix }) => {
          const results = await callTextSearchTool({
            userId: effectiveUserId,
            query,
            topK,
            pathPrefix: localPathPrefix ?? pathPrefix,
          });
          return { results };
        },
      },
      treeList: {
        description: "사용자의 문서 트리 구조를 조회합니다.",
        inputSchema: treeListInputSchema,
        execute: async ({ rootPath, maxDepth }) => {
          const items = await callTreeListTool({
            userId: effectiveUserId,
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

  // 에러 핸들러 함수
  function errorHandler(error: unknown): string {
    if (error == null) {
      return "알 수 없는 오류가 발생했습니다.";
    }

    if (typeof error === "string") {
      return error;
    }

    if (error instanceof Error) {
      // 에러 타입에 따른 구체적인 메시지 반환
      if (error.message.includes("rate limit")) {
        return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
      }
      if (error.message.includes("invalid")) {
        return "잘못된 요청입니다. 입력을 확인해주세요.";
      }
      return error.message;
    }

    return JSON.stringify(error);
  }

  return result.toUIMessageStreamResponse({
    originalMessages: allMessages,
    // 서버 측 일관된 메시지 ID 생성
    generateMessageId: createIdGenerator({
      prefix: "msg",
      size: 16,
    }),
    // 에러 처리
    onError: (error) => {
      console.error("스트리밍 중 오류 발생:", error);
      return errorHandler(error);
    },
    // 메시지 메타데이터 추가
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return {
          createdAt: Date.now(),
          model: "gpt-4o",
        };
      }
      if (part.type === "finish") {
        return {
          totalTokens: part.totalUsage?.totalTokens,
          inputTokens: part.totalUsage?.inputTokens,
          outputTokens: part.totalUsage?.outputTokens,
        };
      }
      return undefined;
    },
    onFinish: async ({ messages: completedMessages }) => {
      if (chatId) {
        try {
          await saveChat({
            chatId,
            messages: completedMessages,
          });
        } catch (error) {
          console.error("메시지 저장 실패:", error);
        }
      }
    },
  });
}

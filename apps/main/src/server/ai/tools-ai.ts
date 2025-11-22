import { callEmbedSearchTool, callTextSearchTool, callTreeListTool } from '@/server/ai/sidecar';
import { z } from 'zod';
import { TOOL_DESCRIPTIONS } from './prompt-ai';

/**
 * AI 도구 입력 스키마 정의
 */

export const embedSearchInputSchema = z.object({
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

export const textSearchInputSchema = z.object({
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

export const treeListInputSchema = z.object({
  rootPath: z
    .string()
    .default('')
    .describe(
      "조회할 문서 트리의 시작 경로. 빈 문자열이면 모든 문서를 조회합니다. 경로는 점(.)으로 구분된 계층 구조입니다 (예: 'test', 'test.folder'). 'root' 같은 가상 루트는 사용하지 않습니다.",
    ),
  maxDepth: z
    .number()
    .int()
    .min(0)
    .max(10)
    .default(4)
    .describe('rootPath 기준으로 내려갈 최대 깊이. 0이면 rootPath 바로 하위만 조회합니다.'),
});

/**
 * AI SDK용 도구 정의 생성
 */
export function createDocumentAiTools(userId: string) {
  return {
    embedSearch: {
      description: TOOL_DESCRIPTIONS.embedSearch,
      inputSchema: embedSearchInputSchema,
      execute: async ({ query, topK }: { query: string; topK: number }) => {
        const results = await callEmbedSearchTool({
          userId,
          query,
          topK,
        });
        return { results };
      },
    },
    textSearch: {
      description: TOOL_DESCRIPTIONS.textSearch,
      inputSchema: textSearchInputSchema,
      execute: async ({ query, topK }: { query: string; topK: number }) => {
        const results = await callTextSearchTool({
          userId,
          query,
          topK,
        });
        return { results };
      },
    },
    treeList: {
      description: TOOL_DESCRIPTIONS.treeList,
      inputSchema: treeListInputSchema,
      execute: async ({ rootPath, maxDepth }: { rootPath: string; maxDepth: number }) => {
        const items = await callTreeListTool({
          userId,
          rootPath,
          maxDepth,
        });
        return { items };
      },
    },
  };
}

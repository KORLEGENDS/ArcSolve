/**
 * AI (document 기반 대화) 관련 Query Options
 */

import { TIMEOUT } from '@/share/configs/constants/time-constants';
import {
  documentAiSessionCreateRequestSchema,
  type DocumentAiSessionCreateRequest,
} from '@/share/schema/zod/document-ai-zod';
import { queryOptions } from '@tanstack/react-query';
import type { UIMessage } from 'ai';

import { createApiMutation, createApiQueryOptions } from '../query-builder';
import { queryKeys } from '../query-keys';

export type DocumentAIConversationResponse = {
  documentId: string;
  mimeType: string;
  messages: UIMessage[];
};

export interface DocumentDTO {
  documentId: string;
  name: string;
  path: string;
  parentPath: string;
  kind: 'folder' | 'document';
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetailResponse {
  document: DocumentDTO;
}

export const aiQueryOptions = {
  /**
   * ArcAI 세션 문서 생성
   * - POST /api/document/ai
   */
  createSession: createApiMutation<
    DocumentDTO,
    DocumentDetailResponse,
    DocumentAiSessionCreateRequest
  >(
    () => '/api/document/ai',
    (data) => data.document,
    {
      method: 'POST',
      bodyExtractor: (variables) =>
        documentAiSessionCreateRequestSchema.parse(variables),
    },
  ),

  /**
   * 특정 documentId 에 대한 AI 대화 히스토리 조회
   * - GET /api/document/ai/[documentId]
   * - 서버 표준 응답(ok) 래퍼를 query-builder 가 언래핑합니다.
   */
  conversation: (documentId: string) =>
    queryOptions({
      queryKey: queryKeys.ai.conversation(documentId),
      ...createApiQueryOptions<
        DocumentAIConversationResponse,
        DocumentAIConversationResponse
      >(
        `/api/document/ai/${encodeURIComponent(documentId)}`,
        (data) => data,
        {
          staleTime: TIMEOUT.CACHE.SHORT,
          gcTime: TIMEOUT.CACHE.MEDIUM,
        },
      ),
    }),
} as const;


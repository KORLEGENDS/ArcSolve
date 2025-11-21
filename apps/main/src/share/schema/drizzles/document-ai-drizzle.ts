import type { UIMessage } from 'ai';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { documents } from './document-drizzle';

/**
 * AI 문서(document.kind='document', mimeType='application/vnd.arc.ai-chat+json' 예상)의
 * 채팅 메시지/파트를 저장하기 위한 전용 스키마입니다.
 *
 * 논리 포맷은 AI SDK의 UIMessage[]를 기준으로 유지하고,
 * 물리 스키마는 message / part 단위로 정규화하여 저장합니다.
 */

// 메시지 역할 (UIMessage.role)
export const documentAiMessageRoleEnum = pgEnum('document_ai_message_role', [
  'user',
  'assistant',
  'system',
  'tool',
]);

// UIMessage.metadata 에서 주로 사용할 필드 타입 (필요 시 확장)
export type DocumentAiMessageMetadata = {
  model?: string;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  createdAt?: number;
};

// UIMessage 파트 타입 (정밀 타입은 상위 레이어에서 관리하고, 여기서는 구조화 JSON 만 보장)
export type DocumentAiPartPayload =
  | UIMessage['parts'][number]
  | Record<string, unknown>;

/**
 * document_ai_message
 *
 * - 한 개의 UIMessage 를 한 row 로 저장
 * - parts 는 별도의 document_ai_part 테이블에 저장
 */
export const documentAiMessages = pgTable(
  'document_ai_message',
  {
    documentAiMessageId: uuid('document_ai_message_id')
      .primaryKey()
      .defaultRandom()
      .notNull(),

    // 어떤 문서(AI 세션)에 속한 메시지인지
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.documentId, { onDelete: 'cascade' }),

    // UIMessage.id (클라이언트/서버 공통 메시지 식별자)
    uiMessageId: text('ui_message_id').notNull(),

    // 'user' | 'assistant' | 'system' | 'tool'
    role: documentAiMessageRoleEnum('role').notNull(),

    // 한 문서 내에서의 메시지 순서 (0, 1, 2, ...)
    index: integer('index').notNull(),

    // UIMessage.metadata
    metadata: jsonb('metadata').$type<DocumentAiMessageMetadata | null>(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    // 한 문서 내에서 메시지 순서 유니크 (soft delete 제외)
    documentIndexUnique: uniqueIndex(
      'document_ai_message_document_id_index_deleted_null_idx',
    )
      .on(table.documentId, table.index)
      .where(sql`deleted_at IS NULL`),
    // UIMessage.id 기준으로도 빠르게 조회 가능하도록 인덱스
    uiMessageIdIndex: index('document_ai_message_ui_message_id_idx').on(
      table.uiMessageId,
    ),
  }),
);

/**
 * document_ai_part
 *
 * - 한 개의 UIMessage.parts[i] 를 한 row 로 저장
 * - type + payload(jsonb) 조합으로 각 파트의 세부 구조를 보존
 */
export const documentAiParts = pgTable('document_ai_part', {
  documentAiPartId: uuid('document_ai_part_id')
    .primaryKey()
    .defaultRandom()
    .notNull(),

  documentAiMessageId: uuid('document_ai_message_id')
    .notNull()
    .references(() => documentAiMessages.documentAiMessageId, {
      onDelete: 'cascade',
    }),

  // 메시지 내에서 파트 순서 (0, 1, 2, ...)
  index: integer('index').notNull(),

  // UI 파트 타입 (예: 'text', 'file', 'tool-call', 'tool-result', 'data-weather', ...)
  type: text('type').notNull(),

  // 파트 전체 payload – 타입별 세부 구조까지 포함
  payload: jsonb('payload').$type<DocumentAiPartPayload>().notNull(),
});

// Types
export type DocumentAiMessage = typeof documentAiMessages.$inferSelect;
export type NewDocumentAiMessage = typeof documentAiMessages.$inferInsert;

export type DocumentAiPart = typeof documentAiParts.$inferSelect;
export type NewDocumentAiPart = typeof documentAiParts.$inferInsert;



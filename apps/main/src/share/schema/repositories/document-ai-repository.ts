import { throwApi } from '@/server/api/errors';
import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import {
  documentAiMessages,
  documentAiParts,
  documents,
} from '@/share/schema/drizzles';
import type { UIMessage } from 'ai';
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
} from 'drizzle-orm';
import type { DB } from './base-repository';

const AI_CHAT_MIME_TYPE = 'application/vnd.arc.ai-chat+json';

export type DocumentAiConversation = UIMessage[];

type MessageRow = {
  documentAiMessageId: string;
  uiMessageId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  index: number;
  metadata: unknown | null;
};

type PartRow = {
  documentAiMessageId: string;
  index: number;
  payload: unknown;
};

/**
 * document_ai_message / document_ai_part 테이블을 사용하여
 * 특정 문서(documentId)의 AI 대화 히스토리를
 * UIMessage[] 형태로 저장/조회하는 리포지토리입니다.
 *
 * - 권한/소유권: document.userId 기준으로 검증
 * - 문서 타입: kind='document' && mimeType=AI_CHAT_MIME_TYPE 인 경우에만 허용
 */
export class DocumentAiRepository {
  constructor(private readonly database: DB = defaultDb) {}

  private async assertAiDocumentOwner(params: {
    documentId: string;
    userId: string;
  }): Promise<void> {
    const { documentId, userId } = params;

    const [row] = await this.database
      .select({
        documentId: documents.documentId,
        userId: documents.userId,
        kind: documents.kind,
        mimeType: documents.mimeType,
        deletedAt: documents.deletedAt,
      })
      .from(documents)
      .where(
        and(
          eq(documents.documentId, documentId),
          eq(documents.userId, userId),
          isNull(documents.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throwApi('NOT_FOUND', '문서를 찾을 수 없습니다.', { documentId, userId });
    }

    if (row.kind !== 'document' || row.mimeType !== AI_CHAT_MIME_TYPE) {
      throwApi('BAD_REQUEST', 'AI 채팅 문서가 아닙니다.', {
        documentId,
        userId,
        kind: row.kind,
        mimeType: row.mimeType,
      });
    }
  }

  /**
   * 주어진 문서의 AI 대화 전체를 UIMessage[] 형태로 조회합니다.
   * - 메시지는 index ASC 순서로 정렬됩니다.
   */
  async loadConversationForOwner(params: {
    documentId: string;
    userId: string;
  }): Promise<DocumentAiConversation> {
    const { documentId, userId } = params;

    await this.assertAiDocumentOwner({ documentId, userId });

    const messageRows = await this.database
      .select({
        documentAiMessageId: documentAiMessages.documentAiMessageId,
        uiMessageId: documentAiMessages.uiMessageId,
        role: documentAiMessages.role,
        index: documentAiMessages.index,
        metadata: documentAiMessages.metadata,
      })
      .from(documentAiMessages)
      .where(eq(documentAiMessages.documentId, documentId))
      .orderBy(asc(documentAiMessages.index));

    if (messageRows.length === 0) {
      return [];
    }

    const messageIds = messageRows.map(
      (row) => row.documentAiMessageId,
    );

    const partRows = await this.database
      .select({
        documentAiMessageId: documentAiParts.documentAiMessageId,
        index: documentAiParts.index,
        payload: documentAiParts.payload,
      })
      .from(documentAiParts)
      .where(inArray(documentAiParts.documentAiMessageId, messageIds))
      .orderBy(
        asc(documentAiParts.documentAiMessageId),
        asc(documentAiParts.index),
      );

    const partsByMessageId = new Map<string, PartRow[]>();
    for (const part of partRows) {
      const list = partsByMessageId.get(part.documentAiMessageId) ?? [];
      list.push(part);
      partsByMessageId.set(part.documentAiMessageId, list);
    }

    const messages: UIMessage[] = messageRows.map((row: MessageRow) => {
      const partList = partsByMessageId.get(row.documentAiMessageId) ?? [];
      const sorted = partList
        .slice()
        .sort((a, b) => a.index - b.index);

      const parts = sorted.map((p) => p.payload) as UIMessage['parts'];

      const base: UIMessage = {
        id: row.uiMessageId,
        role: row.role,
        parts,
      };

      if (row.metadata != null) {
        (base as any).metadata = row.metadata;
      }

      return base;
    });

    return messages;
  }

  /**
   * 주어진 문서의 AI 대화 전체를 UIMessage[] 기준으로 덮어씁니다.
   *
   * - 트랜잭션 내에서 기존 document_ai_message / document_ai_part 를 모두 삭제한 뒤
   *   새 messages / parts 를 index 순서대로 삽입합니다.
   */
  async replaceConversationForOwner(params: {
    documentId: string;
    userId: string;
    messages: DocumentAiConversation;
  }): Promise<void> {
    const { documentId, userId, messages } = params;

    await this.assertAiDocumentOwner({ documentId, userId });

    await this.database.transaction(async (tx) => {
      // 기존 대화 히스토리 제거 (parts 는 FK(onDelete: cascade) 로 함께 삭제)
      await tx
        .delete(documentAiMessages)
        .where(eq(documentAiMessages.documentId, documentId));

      if (messages.length === 0) {
        return;
      }

      for (let i = 0; i < messages.length; i += 1) {
        const message = messages[i];

        if (!message.id) {
          throwApi('BAD_REQUEST', 'UIMessage.id 가 누락되었습니다.', {
            index: i,
            documentId,
            userId,
          });
        }

        const [inserted] = await tx
          .insert(documentAiMessages)
          .values({
            documentId,
            uiMessageId: message.id,
            role: message.role as MessageRow['role'],
            index: i,
            // metadata 필드는 선택 사항이므로 any 캐스팅으로 유연하게 처리
            metadata:
              (message as any).metadata != null
                ? ((message as any).metadata as unknown)
                : null,
          })
          .returning({
            documentAiMessageId: documentAiMessages.documentAiMessageId,
          });

        if (!inserted) {
          throw new Error('AI 메시지 저장에 실패했습니다.');
        }

        const parts = Array.isArray(message.parts)
          ? (message.parts as UIMessage['parts'])
          : [];

        if (parts.length === 0) {
          continue;
        }

        await tx.insert(documentAiParts).values(
          parts.map((part, partIndex) => ({
            documentAiMessageId: inserted.documentAiMessageId,
            index: partIndex,
            // 타입 필드는 payload 내부에도 포함되므로 여기서는 주로 인덱싱/디버깅용
            type:
              typeof (part as any).type === 'string'
                ? ((part as any).type as string)
                : 'unknown',
            payload: part as unknown,
          })),
        );
      }
    });
  }
}



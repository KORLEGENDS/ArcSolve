import { sql } from 'drizzle-orm';
import {
  bigint,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

// ltree custom type for hierarchical document paths
const ltree = customType<{ data: string }>({
  dataType() {
    return 'ltree';
  },
});

/**
 * document.kind
 *
 * - 'folder'   : 폴더 노드 (트리 구조 전용)
 * - 'document' : 실제 콘텐츠/파일/노트 등을 담는 리프 노드
 *
 * 실제 동작(노트/드로우/PDF/YouTube 등)은 모두 mimeType 기반으로 분기합니다.
 */
export const documentKindEnum = pgEnum('document_kind', ['folder', 'document']);

export const documentRelationTypeEnum = pgEnum('document_relation_type', [
  'reference',
  'summary',
  'translation',
  'duplicate',
]);

export const documentUploadStatusEnum = pgEnum('document_upload_status', [
  'pending',
  'uploading',
  'uploaded',
  'upload_failed',
]);

export const documentProcessingStatusEnum = pgEnum('document_processing_status', [
  'pending',
  'processing',
  'processed',
  'failed',
]);

export const documents = pgTable(
  'document',
  {
    documentId: uuid('document_id')
      .primaryKey()
      .notNull()
      .defaultRandom(),

    // owner (tenant 기준)
    userId: uuid('user_id').notNull(),

    /**
     * 표시용 문서 이름
     * - path는 ltree용 slug 경로이므로, 실제 UI에서는 항상 name을 사용합니다.
     * - name은 UTF-8 전체 범위를 허용하며, 한글/이모지 등도 그대로 저장합니다.
     */
    name: text('name'),

    // hierarchical path within the user's namespace
    path: ltree('path').notNull(),

    kind: documentKindEnum('kind').notNull(),

    /**
     * MIME 타입
     * - file 문서: 실제 파일 MIME (예: 'application/pdf', 'video/youtube')
     * - note 문서: 노트 타입 구분 (예: 'application/vnd.arc.note+plate', 'application/vnd.arc.note+draw')
   * - folder 문서:
   *   - 기존 데이터: null (도메인 정보 없음, 기본적으로 document 도메인으로 취급)
   *   - 신규 데이터:
   *     - 노트/파일 트리용 폴더: 'application/vnd.arc.folder+document'
   *     - AI 트리용 폴더: 'application/vnd.arc.folder+ai'
     */
    mimeType: text('mime_type'),

    /**
     * 파일 크기 (bytes)
     * - file 문서: 실제 파일 크기
     * - note/folder 문서: null
     */
    fileSize: bigint('file_size', { mode: 'number' }),

    /**
     * 스토리지 키 또는 외부 URL
     * - file 문서: R2 스토리지 키 또는 외부 URL (예: YouTube URL)
     * - note/folder 문서: null
     */
    storageKey: text('storage_key'),

    // 업로드 상태 (note/folder 등 비파일 문서는 기본적으로 'uploaded' 상태로 간주)
    uploadStatus: documentUploadStatusEnum('upload_status')
      .default('uploaded')
      .notNull(),

    /**
     * 전처리(파싱/임베딩 등) 상태
     * - 파일 업로드 이후, 백엔드 전처리 파이프라인의 진행 상태를 나타냅니다.
     * - note/folder 등 비파일 문서는 생성 시점에 'processed' 로 간주할 수 있습니다.
     */
    processingStatus: documentProcessingStatusEnum('processing_status')
      .default('pending')
      .notNull(),

    // points to the latest content version (nullable for empty documents)
    latestContentId: uuid('latest_content_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    // per-user unique path for non-deleted documents
    userPathUnique: uniqueIndex('document_user_id_path_deleted_null_idx')
      .on(table.userId, table.path)
      .where(sql`deleted_at IS NULL`),

    // subtree queries on path (ltree)
    pathGistIdx: index('document_path_gist_idx').using('gist', table.path),
  })
);

export const documentContents = pgTable(
  'document_content',
  {
    documentContentId: uuid('document_content_id')
      .primaryKey()
      .notNull()
      .defaultRandom(),

    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.documentId, { onDelete: 'cascade' }),

    // author of this specific version (may differ from owner)
    userId: uuid('user_id').notNull(),

    // arbitrary structured contents (text, parsed pdf, transcription, etc.)
    contents: jsonb('contents'),

    // monotonically increasing version per document (1, 2, 3, ...)
    version: integer('version').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    // unique version per document for non-deleted rows
    documentVersionUnique: uniqueIndex(
      'document_content_document_id_version_deleted_null_idx'
    )
      .on(table.documentId, table.version)
      .where(sql`deleted_at IS NULL`),
  })
);

export const documentRelations = pgTable(
  'document_relation',
  {
    documentRelationId: uuid('document_relation_id')
      .primaryKey()
      .notNull()
      .defaultRandom(),

    baseDocumentId: uuid('base_document_id')
      .notNull()
      .references(() => documents.documentId, { onDelete: 'cascade' }),

    relatedDocumentId: uuid('related_document_id')
      .notNull()
      .references(() => documents.documentId, { onDelete: 'cascade' }),

    relationType: documentRelationTypeEnum('relation_type').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    // unique edge per type for non-deleted relations
    pairUnique: uniqueIndex(
      'document_relation_base_related_type_deleted_null_idx'
    )
      .on(table.baseDocumentId, table.relatedDocumentId, table.relationType)
      .where(sql`deleted_at IS NULL`),
  })
);

export const documentChunks = pgTable(
  'document_chunk',
  {
    documentChunkId: uuid('document_chunk_id')
      .primaryKey()
      .notNull()
      .defaultRandom(),

    documentContentId: uuid('document_content_id')
      .notNull()
      .references(() => documentContents.documentContentId, {
        onDelete: 'cascade',
      }),

    // optional position of the chunk within the original content
    position: integer('position'),

    chunkContent: text('chunk_content').notNull(),

    // pgvector column for semantic search (configure dimensions as needed)
    chunkEmbedding: vector('chunk_embedding', { dimensions: 256 }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    // vector similarity index; requires pgvector extension
    chunkEmbeddingIvfflatIdx: index('document_chunk_embedding_ivfflat_idx')
      .using('ivfflat', table.chunkEmbedding.op('vector_cosine_ops'))
      .with({ lists: 100 }),
  })
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type DocumentUploadStatus =
  (typeof documentUploadStatusEnum.enumValues)[number];

export type DocumentProcessingStatus =
  (typeof documentProcessingStatusEnum.enumValues)[number];

export type DocumentContent = typeof documentContents.$inferSelect;
export type NewDocumentContent = typeof documentContents.$inferInsert;

export type DocumentRelation = typeof documentRelations.$inferSelect;
export type NewDocumentRelation = typeof documentRelations.$inferInsert;

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;



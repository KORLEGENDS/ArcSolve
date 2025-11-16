import { throwApi } from '@/server/api/errors';
import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import type { Document, DocumentFileMeta, DocumentUploadStatus } from '@/share/schema/drizzles';
import { documents } from '@/share/schema/drizzles';
import { and, eq, isNull } from 'drizzle-orm';
import type { DatabaseError } from 'pg';
import type { DB } from './base-repository';

function isDatabaseError(error: unknown): error is DatabaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in (error as { code?: unknown }) &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

/**
 * ltree 라벨 한 개를 안전한 형식으로 정규화합니다.
 * - 허용 문자: a-z, 0-9, _
 * - 첫 글자가 숫자/기타인 경우 n_ prefix 부여
 */
function toLtreeLabel(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return 'unnamed';
  let label = trimmed
    .normalize('NFKD')
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');

  if (!label) label = 'unnamed';
  if (!/[a-z]/.test(label[0])) {
    label = `n_${label}`;
  }
  return label;
}

/**
 * 클라이언트에서 전달된 경로 문자열을 ltree 경로로 정규화합니다.
 *
 * - 입력은 이미 ltree 스타일(`segment.segment2`)을 가정하지만,
 *   방어적으로 각 세그먼트를 `toLtreeLabel`로 한 번 더 정규화합니다.
 * - 빈 문자열/공백은 루트(빈 경로)로 간주합니다.
 */
function normalizeLtreePath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) return '';

  const segments = trimmed.split('.').filter(Boolean);
  if (segments.length === 0) return '';

  const labels = segments.map((segment) => toLtreeLabel(segment));
  return labels.join('.');
}

export type CreatePendingFileInput = {
  documentId: string;
  userId: string;
  name: string;
  parentPath: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
};

export class DocumentRepository {
  constructor(private readonly database: DB = defaultDb) {}

  /**
   * 업로드용 파일 문서를 생성합니다.
   * - kind = 'file'
   * - uploadStatus = 'pending'
   * - fileMeta에 초기 메타데이터 저장
   */
  async createPendingFileForUpload(input: CreatePendingFileInput): Promise<Document> {
    const label = toLtreeLabel(input.name);
    // 클라이언트는 ltree 기반 경로를 사용하며, 서버에서 한 번 더 정규화합니다.
    const parentLtreePath = normalizeLtreePath(input.parentPath);
    const path = parentLtreePath ? `${parentLtreePath}.${label}` : label;

    const fileMeta: DocumentFileMeta = {
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      storageKey: input.storageKey,
    };

    try {
      const [row] = await this.database
        .insert(documents)
        .values({
          documentId: input.documentId,
          userId: input.userId,
          path,
          kind: 'file',
          fileMeta,
          uploadStatus: 'pending',
        })
        .returning();

      if (!row) {
        throw new Error('문서 생성에 실패했습니다.');
      }

      return row;
    } catch (error) {
      if (isDatabaseError(error) && error.code === '23505') {
        // user_id + path 유니크 제약 위반
        throwApi('CONFLICT', '같은 경로에 이미 문서가 존재합니다.', {
          userId: input.userId,
          parentPath: input.parentPath,
          name: input.name,
        });
      }
      throw error;
    }
  }

  async findByIdForOwner(documentId: string, userId: string): Promise<Document | null> {
    const [row] = await this.database
      .select()
      .from(documents)
      .where(and(eq(documents.documentId, documentId), eq(documents.userId, userId)));

    if (!row) return null;
    return row;
  }

  /**
   * 특정 사용자의 문서 목록을 kind 기준으로 조회합니다.
   * - deleted_at IS NULL 인 문서만 반환합니다.
   * - 현재는 ArcWork 파일 매니저용으로 kind = 'file' 조회에 주로 사용됩니다.
   */
  async listByOwner(
    userId: string,
    options?: {
      kind?: Document['kind'];
    }
  ): Promise<Document[]> {
    const rows = await this.database
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          isNull(documents.deletedAt),
          options?.kind ? eq(documents.kind, options.kind) : undefined
        )
      );

    return rows;
  }

  async updateUploadStatusAndMeta(params: {
    documentId: string;
    userId: string;
    uploadStatus: DocumentUploadStatus;
    fileMeta?: DocumentFileMeta;
  }): Promise<Document> {
    const updates: Partial<typeof documents.$inferInsert> = {
      uploadStatus: params.uploadStatus,
    };

    if (params.fileMeta !== undefined) {
      updates.fileMeta = params.fileMeta;
    }

    const [row] = await this.database
      .update(documents)
      .set(updates)
      .where(and(eq(documents.documentId, params.documentId), eq(documents.userId, params.userId)))
      .returning();

    if (!row) {
      throwApi('NOT_FOUND', '문서를 찾을 수 없습니다.', {
        documentId: params.documentId,
        userId: params.userId,
      });
    }

    return row;
  }
}



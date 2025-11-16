import { throwApi } from '@/server/api/errors';
import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import { documents } from '@/share/schema/drizzles';
import type { Document, DocumentFileMeta, DocumentUploadStatus } from '@/share/schema/drizzles';
import type { DB } from './base-repository';
import type { DatabaseError } from 'pg';
import { and, eq } from 'drizzle-orm';

function isDatabaseError(error: unknown): error is DatabaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in (error as { code?: unknown }) &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

function toLtreeLabel(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return 'unnamed';
  // 허용 문자: a-z, 0-9, _
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
    const path =
      input.parentPath && input.parentPath.trim().length > 0
        ? `${input.parentPath}.${label}`
        : label;

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



import { throwApi } from '@/server/api/errors';
import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import type {
  Document,
  DocumentContent,
  DocumentUploadStatus,
} from '@/share/schema/drizzles';
import { documentContents, documents } from '@/share/schema/drizzles';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { DatabaseError } from 'pg';
import slugify from 'slugify';
import type { DB } from './base-repository';

/**
 * 노트(contents) 기반으로 MIME 타입을 추론합니다.
 * - draw 씬(type = 'draw')이면 application/vnd.arc.note+draw
 * - 그 외(Slate/Plate 배열 또는 기타 값)는 application/vnd.arc.note+plate 로 간주합니다.
 */
function inferNoteMimeTypeFromContents(contents: unknown): string {
  if (
    contents &&
    typeof contents === 'object' &&
    !Array.isArray(contents) &&
    (contents as { type?: unknown }).type === 'draw'
  ) {
    return 'application/vnd.arc.note+draw';
  }

  // 기본값: Plate 기반 텍스트 노트
  return 'application/vnd.arc.note+plate';
}

function isDatabaseError(error: unknown): error is DatabaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in (error as { code?: unknown }) &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

/**
 * ltree 라벨 한 개를 안전한 ASCII slug로 정규화합니다.
 *
 * 정책
 * - UI에 표시되는 이름은 Document.name(UTF-8 전체 범위)에서 관리하고,
 * - path는 ltree 전용 slug 경로로만 사용합니다.
 *
 * 규칙
 * - slugify를 사용해 다국어를 가능한 한 ASCII로 변환합니다.
 * - 허용 문자: a-z, 0-9, _
 * - 첫 글자가 문자가 아닌 경우 n_ prefix 부여
 * - slugify/정규화 이후에도 비어 있으면 'unnamed'를 사용합니다.
 */
function toLtreeLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'unnamed';

  // 1) slugify로 1차 ASCII 슬러그 생성
  let slug = slugify(trimmed, {
    lower: true,
    strict: true,
    locale: 'ko',
  });

  // 2) ltree 규칙에 맞게 후처리 (하이픈 -> 언더스코어 등)
  slug = slug.replace(/-/g, '_');
  slug = slug.replace(/[^a-z0-9_]/g, '');
  slug = slug.replace(/^_+|_+$/g, '');
  slug = slug.replace(/_{2,}/g, '_');

  if (!slug) {
    // slugify가 아무 것도 만들지 못한 극단적인 경우
    return 'unnamed';
  }

  if (!/[a-z]/.test(slug[0])) {
    slug = `n_${slug}`;
  }

  return slug;
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

export type CreateExternalFileInput = {
  userId: string;
  parentPath: string;
  name: string;
  mimeType: string;
  storageKey: string;
};

export type CreateNoteInput = {
  userId: string;
  parentPath: string;
  name: string;
  /**
   * 노트 에디터의 초기 contents(JSON)
   * - Plate 에디터 등에서 직렬화된 값을 그대로 저장합니다.
   */
  initialContents?: unknown;
};

export class DocumentRepository {
  constructor(private readonly database: DB = defaultDb) {}

  /**
   * 주어진 경로에 해당하는 folder 문서를 보장합니다.
   *
   * - path가 빈 문자열인 경우(루트)는 아무 것도 하지 않습니다.
   * - 이미 존재하는 경우 그대로 반환합니다.
   * - 존재하지 않으면 kind = 'folder' 문서를 생성합니다.
   */
  private async ensureFolderForOwner(
    database: DB,
    userId: string,
    rawPath: string
  ): Promise<Document | null> {
    const normalizedPath = normalizeLtreePath(rawPath);
    if (!normalizedPath) return null;

    const [existing] = await database
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          eq(documents.path, normalizedPath),
          isNull(documents.deletedAt)
        )
      );

    if (existing) return existing;

    try {
      const segments = (normalizedPath as string).split('.').filter(Boolean);
      const lastSegment = segments[segments.length - 1] ?? 'unnamed';

      const [row] = await database
        .insert(documents)
        .values({
          userId,
          path: normalizedPath,
          // 서버에서 보장하는 폴더이므로 path의 마지막 세그먼트를 이름으로 사용합니다.
          name: lastSegment,
          kind: 'folder',
          uploadStatus: 'uploaded',
          mimeType: null,
          fileSize: null,
          storageKey: null,
        })
        .returning();

      return row ?? null;
    } catch (error) {
      if (isDatabaseError(error) && error.code === '23505') {
        // user_id + path 유니크 제약 위반 → 이미 다른 요청에서 생성된 경우이므로 무시합니다.
        const [existingOnConflict] = await database
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.userId, userId),
              eq(documents.path, normalizedPath),
              isNull(documents.deletedAt)
            )
          );
        return existingOnConflict ?? null;
      }
      throw error;
    }
  }

  /**
   * 상위 경로와 이름을 기반으로 folder 문서를 생성합니다.
   * - 이미 존재하면 기존 문서를 반환합니다.
   */
  async createFolderForOwner(input: {
    userId: string;
    parentPath: string;
    name: string;
  }): Promise<Document> {
    const label = toLtreeLabel(input.name);
    const parentLtreePath = normalizeLtreePath(input.parentPath);
    const path = parentLtreePath ? `${parentLtreePath}.${label}` : label;

    try {
      const [row] = await this.database
        .insert(documents)
        .values({
          userId: input.userId,
          path,
          name: input.name,
          kind: 'folder',
          uploadStatus: 'uploaded',
          mimeType: null,
          fileSize: null,
          storageKey: null,
        })
        .returning();

      if (!row) {
        throw new Error('폴더 생성에 실패했습니다.');
      }

      return row;
    } catch (error) {
      if (isDatabaseError(error) && error.code === '23505') {
        // user_id + path 유니크 제약 위반 → 이미 동일 경로의 폴더가 존재하는 경우,
        // ensureFolderForOwner를 통해 기존 폴더를 반환합니다.
    const folder = await this.ensureFolderForOwner(this.database, input.userId, path);
        if (folder) {
          return folder;
        }

        throwApi('CONFLICT', '같은 경로에 이미 폴더가 존재합니다.', {
        userId: input.userId,
        parentPath: input.parentPath,
        name: input.name,
      });
    }
      throw error;
    }
  }

  /**
   * 업로드용 파일 문서를 생성합니다.
   * - kind = 'file'
   * - uploadStatus = 'pending'
   * - mimeType / fileSize / storageKey에 초기 메타데이터 저장
   */
  async createPendingFileForUpload(input: CreatePendingFileInput): Promise<Document> {
    const label = toLtreeLabel(input.name);
    // 클라이언트는 ltree 기반 경로를 사용하며, 서버에서 한 번 더 정규화합니다.
    const parentLtreePath = normalizeLtreePath(input.parentPath);
    const path = parentLtreePath ? `${parentLtreePath}.${label}` : label;

    // 부모 경로가 있는 경우, 해당 경로에 folder 문서를 보장합니다.
    if (parentLtreePath) {
      await this.ensureFolderForOwner(this.database, input.userId, parentLtreePath);
    }

    try {
      const [row] = await this.database
        .insert(documents)
        .values({
          documentId: input.documentId,
          userId: input.userId,
          path,
          name: input.name,
          kind: 'file',
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          storageKey: input.storageKey,
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

  /**
   * 외부 리소스(YouTube 등)를 나타내는 파일 문서를 생성합니다.
   * - kind = 'file'
   * - uploadStatus = 'uploaded'
   * - mimeType / storageKey만 설정합니다.
   */
  async createExternalFile(input: CreateExternalFileInput): Promise<Document> {
    const label = toLtreeLabel(input.name);
    const parentLtreePath = normalizeLtreePath(input.parentPath);
    const path = parentLtreePath ? `${parentLtreePath}.${label}` : label;

    // 부모 경로가 있는 경우, 해당 경로에 folder 문서를 보장합니다.
    if (parentLtreePath) {
      await this.ensureFolderForOwner(this.database, input.userId, parentLtreePath);
    }

    try {
      const [row] = await this.database
        .insert(documents)
        .values({
          userId: input.userId,
          path,
          name: input.name,
          kind: 'file',
          mimeType: input.mimeType,
          fileSize: null,
          storageKey: input.storageKey,
          uploadStatus: 'uploaded',
        })
        .returning();

      if (!row) {
        throw new Error('외부 파일 문서 생성에 실패했습니다.');
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

  /**
   * 노트 문서를 생성하고 초기 콘텐츠 버전을 함께 생성합니다.
   *
   * - kind = 'note'
   * - uploadStatus = 'uploaded'
   * - mimeType / fileSize / storageKey = null
   * - document_content.version = 1
   * - documents.latestContentId = 생성된 content 행을 가리키도록 설정
   */
  async createNoteForOwner(input: CreateNoteInput): Promise<{
    document: Document;
    content: DocumentContent;
  }> {
    const label = toLtreeLabel(input.name);
    const parentLtreePath = normalizeLtreePath(input.parentPath);
    const path = parentLtreePath ? `${parentLtreePath}.${label}` : label;

    return this.database.transaction(async (tx) => {
      // 부모 경로가 있는 경우, 해당 경로에 folder 문서를 보장합니다.
      if (parentLtreePath) {
        await this.ensureFolderForOwner(tx, input.userId, parentLtreePath);
      }

      const noteMimeType = inferNoteMimeTypeFromContents(input.initialContents);

      const [createdDocument] = await tx
        .insert(documents)
        .values({
          userId: input.userId,
          path,
          name: input.name,
          kind: 'note',
          uploadStatus: 'uploaded',
          mimeType: noteMimeType,
          fileSize: null,
          storageKey: null,
        })
        .returning();

      if (!createdDocument) {
        throw new Error('노트 문서 생성에 실패했습니다.');
      }

      const [createdContent] = await tx
        .insert(documentContents)
        .values({
          documentId: createdDocument.documentId,
          userId: input.userId,
          contents: (input.initialContents ?? null) as unknown,
          version: 1,
        })
        .returning();

      if (!createdContent) {
        throw new Error('노트 콘텐츠 생성에 실패했습니다.');
      }

      const [updatedDocument] = await tx
        .update(documents)
        .set({
          latestContentId: createdContent.documentContentId,
        })
        .where(
          and(
            eq(documents.documentId, createdDocument.documentId),
            eq(documents.userId, input.userId),
          ),
        )
        .returning();

      if (!updatedDocument) {
        throw new Error('노트 문서 상태 업데이트에 실패했습니다.');
      }

      return {
        document: updatedDocument,
        content: createdContent,
      };
    });
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
   * 문서를 최신 콘텐츠 버전과 함께 조회합니다.
   * - kind에 관계없이 documentId 기준으로 latestContentId를 따라갑니다.
   */
  async findWithLatestContentForOwner(
    documentId: string,
    userId: string,
  ): Promise<{ document: Document; content: DocumentContent | null } | null> {
    const [doc] = await this.database
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.documentId, documentId),
          eq(documents.userId, userId),
          isNull(documents.deletedAt),
        ),
      );

    if (!doc) return null;

    if (!doc.latestContentId) {
      return { document: doc, content: null };
    }

    const [content] = await this.database
      .select()
      .from(documentContents)
      .where(
        and(
          eq(documentContents.documentContentId, doc.latestContentId),
          isNull(documentContents.deletedAt),
        ),
      );

    return { document: doc, content: content ?? null };
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

  /**
   * 문서 메타데이터(name 등)를 업데이트합니다.
   * - kind 제약은 두지 않고, 주어진 필드만 부분 업데이트합니다.
   */
  async updateDocumentMetaForOwner(params: {
    documentId: string;
    userId: string;
    name?: string;
  }): Promise<Document> {
    const updates: Partial<typeof documents.$inferInsert> = {};

    if (typeof params.name === 'string') {
      updates.name = params.name;
    }

    updates.updatedAt = new Date();

    const [row] = await this.database
      .update(documents)
      .set(updates)
      .where(
        and(
          eq(documents.documentId, params.documentId),
          eq(documents.userId, params.userId),
          isNull(documents.deletedAt),
        ),
      )
      .returning();

    if (!row) {
      throwApi('NOT_FOUND', '문서를 찾을 수 없습니다.', {
        documentId: params.documentId,
        userId: params.userId,
      });
    }

    return row;
  }

  /**
   * 문서 콘텐츠 버전을 추가하고 latestContentId를 갱신합니다.
   * - kind에 관계없이 documentId 기준으로 새로운 버전을 생성합니다.
   */
  async appendContentVersionForOwner(params: {
    documentId: string;
    userId: string;
    contents: unknown;
  }): Promise<{
    document: Document;
    content: DocumentContent;
  }> {
    const { documentId, userId } = params;

    return this.database.transaction(async (tx) => {
      const [doc] = await tx
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.documentId, documentId),
            eq(documents.userId, userId),
            isNull(documents.deletedAt),
          ),
        );

      if (!doc) {
        throwApi('NOT_FOUND', '문서를 찾을 수 없습니다.', {
          documentId,
          userId,
        });
      }

      const [latest] = await tx
        .select()
        .from(documentContents)
        .where(
          and(
            eq(documentContents.documentId, documentId),
            isNull(documentContents.deletedAt),
          ),
        )
        .orderBy(desc(documentContents.version))
        .limit(1);

      const nextVersion = (latest?.version ?? 0) + 1;

      const [createdContent] = await tx
        .insert(documentContents)
        .values({
          documentId,
          userId,
          contents: params.contents as unknown,
          version: nextVersion,
        })
        .returning();

      if (!createdContent) {
        throw new Error('노트 콘텐츠 버전 생성에 실패했습니다.');
      }

      const updates: Partial<typeof documents.$inferInsert> = {
        latestContentId: createdContent.documentContentId,
        updatedAt: new Date(),
      };

      // 노트 문서의 경우, 콘텐츠 타입 변화(Slate ↔ Draw)에 따라 mimeType도 동기화합니다.
      if (doc.kind === 'note') {
        updates.mimeType = inferNoteMimeTypeFromContents(params.contents);
        updates.fileSize = null;
        updates.storageKey = null;
      }

      const [updatedDocument] = await tx
        .update(documents)
        .set(updates)
        .where(
          and(
            eq(documents.documentId, documentId),
            eq(documents.userId, userId),
          ),
        )
        .returning();

      if (!updatedDocument) {
        throwApi('NOT_FOUND', '문서를 찾을 수 없습니다.', {
          documentId,
          userId,
        });
      }

      return {
        document: updatedDocument,
        content: createdContent,
      };
    });
  }

  /**
   * 문서를 소프트 삭제합니다.
   * - 현재는 단일 문서만 deleted_at을 설정합니다.
   * - subtree 삭제 등은 향후 필요 시 확장합니다.
   */
  async softDeleteDocumentForOwner(params: {
    documentId: string;
    userId: string;
  }): Promise<void> {
    const { documentId, userId } = params;

    const [row] = await this.database
      .update(documents)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documents.documentId, documentId),
          eq(documents.userId, userId),
          isNull(documents.deletedAt),
        ),
      )
      .returning();

    if (!row) {
      throwApi('NOT_FOUND', '문서를 찾을 수 없습니다.', {
        documentId,
        userId,
      });
    }
  }

  async updateUploadStatusAndMeta(params: {
    documentId: string;
    userId: string;
    uploadStatus: DocumentUploadStatus;
    mimeType?: string | null;
    fileSize?: number | null;
    storageKey?: string | null;
  }): Promise<Document> {
    const updates: Partial<typeof documents.$inferInsert> = {
      uploadStatus: params.uploadStatus,
    };

    if (params.mimeType !== undefined) {
      updates.mimeType = params.mimeType;
    }
    if (params.fileSize !== undefined) {
      updates.fileSize = params.fileSize;
    }
    if (params.storageKey !== undefined) {
      updates.storageKey = params.storageKey;
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

  /**
   * 문서(및 하위 문서)가 속한 경로를 변경합니다.
   *
   * - documentId가 가리키는 문서의 path를 기준으로 subtree를 계산합니다.
   * - kind가 folder인 경우에는 하위 문서들의 path도 함께 이동합니다.
   * - targetParentPath는 루트('') 또는 ltree 스타일 경로여야 합니다.
   */
  async moveDocumentForOwner(params: {
    documentId: string;
    userId: string;
    targetParentPath: string;
  }): Promise<Document> {
    const { documentId, userId, targetParentPath } = params;

    const current = await this.findByIdForOwner(documentId, userId);
    if (!current) {
      throwApi('NOT_FOUND', '문서를 찾을 수 없습니다.', {
        documentId,
        userId,
      });
    }

    const oldPath = (current.path as unknown as string) ?? '';
    if (!oldPath) {
      throw new Error('유효하지 않은 문서 경로입니다.');
    }

    const normalizedTargetParent = normalizeLtreePath(targetParentPath);

    // 자기 자신 또는 자신의 하위 경로로 이동하는 경우는 의미 없는 이동이므로
    // 서버에서는 에러를 던지지 않고 현재 문서를 그대로 반환합니다.
    if (normalizedTargetParent) {
      const isSame = oldPath === normalizedTargetParent;
      const isDescendant = normalizedTargetParent.startsWith(`${oldPath}.`);
      if (isSame || isDescendant) {
        return current;
      }
    }

    const segments = oldPath.split('.').filter(Boolean);
    const selfLabel = segments[segments.length - 1] ?? toLtreeLabel('unnamed');
    const newBasePath = normalizedTargetParent
      ? `${normalizedTargetParent}.${selfLabel}`
      : selfLabel;

    try {
      const updatedRoot = await this.database.transaction(async (tx) => {
        // 대상 부모 경로가 있는 경우 해당 경로에 folder 문서를 보장합니다.
        if (normalizedTargetParent) {
          await this.ensureFolderForOwner(tx, userId, normalizedTargetParent);
        }

        // 현재 문서를 루트로 하는 subtree 조회 (자기 자신 포함)
        const subtree = await tx
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.userId, userId),
              isNull(documents.deletedAt),
              sql`${documents.path} <@ ${oldPath}::ltree`
            )
          );

        for (const row of subtree) {
          const rowPath = row.path as unknown as string;
          let suffix = '';
          if (rowPath.length > oldPath.length) {
            // "oldPath.xxx" 형태에서 뒤의 부분만 잘라냅니다.
            suffix = rowPath.slice(oldPath.length + 1);
          }
          const newPath = suffix ? `${newBasePath}.${suffix}` : newBasePath;

          await tx
            .update(documents)
            .set({ path: newPath })
            .where(
              and(eq(documents.documentId, row.documentId), eq(documents.userId, userId))
            );
        }

        const [root] = await tx
          .select()
          .from(documents)
          .where(and(eq(documents.documentId, documentId), eq(documents.userId, userId)));

        if (!root) {
          throwApi('NOT_FOUND', '문서를 찾을 수 없습니다.', {
            documentId,
            userId,
          });
        }

        return root;
      });

      return updatedRoot;
    } catch (error) {
      if (isDatabaseError(error) && error.code === '23505') {
        // user_id + path 유니크 제약 위반
        throwApi('CONFLICT', '같은 경로에 이미 문서가 존재합니다.', {
          documentId,
          userId,
          targetParentPath,
        });
      }
      throw error;
    }
  }
}



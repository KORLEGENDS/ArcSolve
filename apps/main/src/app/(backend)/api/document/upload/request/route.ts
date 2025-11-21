import type { ApiException as ApiExceptionType } from '@/server/api/errors';
import { ApiException } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { generateFileStorageKey } from '@/server/database/r2/upload-r2';
import { DocumentRepository } from '@/share/schema/repositories/document-repository';
import {
  documentUploadRequestSchema,
  type DocumentUploadRequest,
} from '@/share/schema/zod/document-upload-zod';
import { generateUUID } from '@/share/share-utils/id-utils';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
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

    const raw = (await request.json().catch(() => ({}))) as unknown;
    const parsed = documentUploadRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return error('BAD_REQUEST', issue?.message ?? '요청 본문이 올바르지 않습니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { issues: parsed.error.issues },
      });
    }

    const body: DocumentUploadRequest = parsed.data;
    const documentId = generateUUID();
    const storageKey = generateFileStorageKey(userId, documentId);

    const repository = new DocumentRepository();
    const document = await repository.createPendingFileForUpload({
      documentId,
      userId,
      name: body.name,
      parentPath: body.parentPath,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      storageKey,
    });

    // UploadProcess는 Redis 기반으로 관리
    const { createUploadProcess } = await import(
      '@/server/database/r2/upload-process-r2'
    );
    const process = await createUploadProcess({
      userId,
      id: document.documentId,
      name: body.name,
      path: document.path as unknown as string,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
      storageKey,
    });

    return ok(
      {
        processId: process.processId,
        documentId: document.documentId,
        expiresAt: process.expiresAt,
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '업로드 프로세스를 생성했습니다.',
      }
    );
  } catch (err) {
    // 서버 측에서만 에러 로그 기록 (클라이언트에 노출 안 됨)
    console.error('[POST /api/document/upload/request] Error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    if (err instanceof (ApiException as unknown as typeof ApiExceptionType)) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '문서 업로드 요청 처리 중 오류가 발생했습니다.');
  }
}



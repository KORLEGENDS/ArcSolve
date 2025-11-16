import { ApiException } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { DocumentRepository } from '@/share/schema/repositories/document-repository';
import {
  documentUploadConfirmRequestSchema,
  type DocumentUploadConfirmRequest,
} from '@/share/schema/zod/document-upload-zod';
import type { DocumentFileMeta } from '@/share/schema/drizzles';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { BUCKET, r2Client } from '@/server/database/r2/client-r2';
import {
  getUploadProcess,
  updateProcessStatus,
} from '@/server/database/r2/upload-process-r2';

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
    const parsed = documentUploadConfirmRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return error('BAD_REQUEST', issue?.message ?? '요청 본문이 올바르지 않습니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { issues: parsed.error.issues },
      });
    }

    const body: DocumentUploadConfirmRequest = parsed.data;
    const process = await getUploadProcess(body.processId);

    if (!process) {
      return error('NOT_FOUND', '업로드 프로세스를 찾을 수 없습니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    if (process.userId !== userId) {
      return error('FORBIDDEN', '이 업로드 프로세스에 대한 권한이 없습니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    if (process.status !== 'uploading') {
      return error('BAD_REQUEST', `잘못된 프로세스 상태입니다: ${process.status}`, {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    const repository = new DocumentRepository();
    const document = await repository.findByIdForOwner(process.id, userId);

    if (!document) {
      return error('NOT_FOUND', '문서를 찾을 수 없습니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    if (document.uploadStatus !== 'uploading') {
      return error(
        'BAD_REQUEST',
        `업로드 완료를 확인할 수 없는 상태입니다: ${document.uploadStatus}`,
        {
          user: { id: userId, email: session.user.email || undefined },
        }
      );
    }

    // 1. R2 HEAD로 실제 객체 존재 및 크기 확인
    let headContentLength: number | undefined;
    try {
      const command = new HeadObjectCommand({
        Bucket: BUCKET,
        Key: process.storageKey,
      });
      const headRes = await r2Client.send(command);
      const len = (headRes as { ContentLength?: number }).ContentLength;
      headContentLength =
        typeof len === 'number' && Number.isFinite(len) ? len : undefined;
    } catch {
      await repository.updateUploadStatusAndMeta({
        documentId: document.documentId,
        userId,
        uploadStatus: 'upload_failed',
      });
      await updateProcessStatus(process.processId, 'upload_failed');
      return error('BAD_REQUEST', '업로드된 파일을 찾을 수 없습니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    if (!headContentLength || headContentLength <= 0) {
      await repository.updateUploadStatusAndMeta({
        documentId: document.documentId,
        userId,
        uploadStatus: 'upload_failed',
      });
      await updateProcessStatus(process.processId, 'upload_failed');
      return error('BAD_REQUEST', '업로드된 파일 크기가 유효하지 않습니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    // 2. 요청된 크기와 실제 크기 비교 (1KB 이상 차이 나면 실패 처리)
    if (Math.abs(headContentLength - process.fileSize) > 1024) {
      await repository.updateUploadStatusAndMeta({
        documentId: document.documentId,
        userId,
        uploadStatus: 'upload_failed',
      });
      await updateProcessStatus(process.processId, 'upload_failed');
      return error(
        'BAD_REQUEST',
        `파일 크기 불일치: 요청(${process.fileSize} bytes) vs 실제(${headContentLength} bytes)`,
        {
          user: { id: userId, email: session.user.email || undefined },
        }
      );
    }

    // TODO: 매직 바이트 기반 MIME 검증 추가 (보안 강화)
    // 현재는 클라이언트에서 전달한 MIME과 사전 정의된 MIME enum만 사용합니다.
    // 필요 시 GetObjectCommand + Range를 사용해 앞부분 바이트를 읽어 검증할 수 있습니다.

    const fileMeta: DocumentFileMeta = {
      ...(document.fileMeta ?? {}),
      fileSize: headContentLength,
      mimeType: process.mimeType,
      storageKey: process.storageKey,
    };

    const updated = await repository.updateUploadStatusAndMeta({
      documentId: document.documentId,
      userId,
      uploadStatus: 'uploaded',
      fileMeta,
    });

    await updateProcessStatus(process.processId, 'uploaded');

    return ok(
      {
        document: {
          documentId: updated.documentId,
          userId: updated.userId,
          path: updated.path,
          name: (updated as { name?: string | null }).name ?? process.name,
          kind: updated.kind,
          uploadStatus: updated.uploadStatus,
          fileMeta: updated.fileMeta,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '파일 업로드가 완료되었습니다.',
      }
    );
  } catch (err) {
    console.error('[POST /api/document/upload/confirm] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '업로드 완료 확인 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}



import { error, ok } from '@/server/api/response';
import { BUCKET, r2Client } from '@/server/database/r2/client-r2';
import { getUploadProcess, updateProcessStatus } from '@/server/database/r2/upload-process-r2';
import { DocumentRepository } from '@/share/schema/repositories/document-repository';
import {
  documentUploadPresignRequestSchema,
  type DocumentUploadPresignRequest,
} from '@/share/schema/zod/document-upload-zod';
import { auth } from '@auth';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
    const parsed = documentUploadPresignRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return error('BAD_REQUEST', issue?.message ?? '요청 본문이 올바르지 않습니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { issues: parsed.error.issues },
      });
    }

    const body: DocumentUploadPresignRequest = parsed.data;
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

    if (process.status !== 'pending') {
      return error('BAD_REQUEST', `이미 처리된 프로세스입니다: ${process.status}`, {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    if (new Date(process.expiresAt) < new Date()) {
      return error('BAD_REQUEST', '업로드 프로세스가 만료되었습니다.', {
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

    if (document.uploadStatus !== 'pending') {
      return error('BAD_REQUEST', `업로드 가능한 상태가 아닙니다: ${document.uploadStatus}`, {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    await repository.updateUploadStatusAndMeta({
      documentId: document.documentId,
      userId,
      uploadStatus: 'uploading',
      mimeType: process.mimeType,
      fileSize: process.fileSize,
      storageKey: process.storageKey,
    });

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: process.storageKey,
      ContentLength: process.fileSize,
      Metadata: {
        userId,
        processId: process.processId,
        documentId: process.id,
        name: process.name,
      },
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });

    await updateProcessStatus(process.processId, 'uploading');

    return ok(
      {
        uploadUrl,
        storageKey: process.storageKey,
        expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '업로드 URL을 발급했습니다.',
      }
    );
  } catch (err) {
    console.error('[POST /api/document/upload/presigned] Error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    const session = await auth().catch(() => null);
    return error('INTERNAL', '업로드 URL 발급 중 오류가 발생했습니다.', {
      user: session?.user?.id
        ? { id: session.user.id, email: session.user.email || undefined }
        : undefined,
    });
  }
}



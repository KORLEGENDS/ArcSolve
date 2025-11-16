import { ApiException } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { DocumentRepository } from '@/share/schema/repositories/document-repository';
import type { DocumentFileMeta } from '@/share/schema/drizzles';
import { documentDownloadUrlResponseSchema } from '@/share/schema/zod/document-upload-zod';
import { uuidSchema } from '@/share/schema/zod/base-zod';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';
import { getCachedDownloadUrl } from '@/server/database/r2/download-url-cache-r2';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
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

    const { documentId } = await context.params;
    const idResult = uuidSchema.safeParse(documentId);
    if (!idResult.success) {
      return error('BAD_REQUEST', '유효하지 않은 문서 ID입니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { issues: idResult.error.issues },
      });
    }

    const repository = new DocumentRepository();
    const document = await repository.findByIdForOwner(idResult.data, userId);

    if (!document) {
      return error('NOT_FOUND', '문서를 찾을 수 없습니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    if (document.kind !== 'file') {
      return error('BAD_REQUEST', '파일 문서가 아니므로 다운로드할 수 없습니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    if (document.uploadStatus !== 'uploaded') {
      return error(
        'BAD_REQUEST',
        `업로드가 완료되지 않은 문서입니다: ${document.uploadStatus}`,
        {
          user: { id: userId, email: session.user.email || undefined },
        }
      );
    }

    const fileMeta = document.fileMeta as DocumentFileMeta | null;
    const storageKey = fileMeta?.storageKey;
    if (!storageKey) {
      return error('INTERNAL', '파일 스토리지 키가 없습니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    const { searchParams } = new URL(request.url);
    const inline = searchParams.get('inline') === '1';
    const filename = searchParams.get('filename') ?? undefined;

    const { url, expiresAt } = await getCachedDownloadUrl(storageKey, {
      filename: filename ?? undefined,
      mimeType: fileMeta?.mimeType ?? undefined,
      inline,
    });

    const payload = { url, expiresAt };
    const parsed = documentDownloadUrlResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return error('INTERNAL', '다운로드 URL 생성 결과 검증에 실패했습니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { issues: parsed.error.issues },
      });
    }

    return ok(parsed.data, {
      user: { id: userId, email: session.user.email || undefined },
      message: '다운로드 URL을 발급했습니다.',
    });
  } catch (err) {
    console.error('[GET /api/document/[documentId]/download-url] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '다운로드 URL 발급 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}



import { ApiException } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import {
  DocumentRepository,
  mapDocumentToDTO,
} from '@/share/schema/repositories/document-repository';
import { uuidSchema } from '@/share/schema/zod/base-zod';
import type { DocumentMoveRequest } from '@/share/schema/zod/document-upload-zod';
import { documentMoveRequestSchema } from '@/share/schema/zod/document-upload-zod';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const raw = (await request.json().catch(() => ({}))) as unknown;
    const parsed = documentMoveRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return error('BAD_REQUEST', issue?.message ?? '요청 본문이 올바르지 않습니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { issues: parsed.error.issues },
      });
    }

    const body: DocumentMoveRequest = parsed.data;

    const repository = new DocumentRepository();
    const moved = await repository.moveDocumentForOwner({
      documentId: idResult.data,
      userId,
      targetParentPath: body.parentPath,
    });

    return ok(
      {
        document: mapDocumentToDTO(moved),
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '문서 경로를 이동했습니다.',
      }
    );
  } catch (err) {
    // 서버 측에서만 에러 로그 기록 (클라이언트에 노출 안 됨)
    console.error('[PATCH /api/document/[documentId]/move] Error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '문서 이동 중 오류가 발생했습니다.');
  }
}



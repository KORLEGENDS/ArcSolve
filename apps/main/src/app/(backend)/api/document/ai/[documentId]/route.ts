import { loadDocumentConversation } from '@/server/ai/document-ai-service';
import { ApiException } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { uuidSchema } from '@/share/schema/zod/base-zod';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

/**
 * 문서 기반 AI 대화 히스토리 조회
 *
 * - GET /api/document/ai/[documentId]
 */
export async function GET(_request: NextRequest, context: RouteContext) {
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

    const data = await loadDocumentConversation({
      documentId: idResult.data,
      userId,
    });

    return ok(data, {
      user: { id: userId, email: session.user.email || undefined },
      message: 'AI 대화 히스토리를 성공적으로 조회했습니다.',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/document/ai/[documentId]] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', 'AI 대화 히스토리 조회 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}



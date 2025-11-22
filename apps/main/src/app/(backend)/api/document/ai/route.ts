import { ApiException, throwApi } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import {
  DocumentRepository,
  mapDocumentToDTO,
} from '@/share/schema/repositories/document-repository';
import {
  documentAiSessionCreateRequestSchema,
  type DocumentAiSessionCreateRequest,
} from '@/share/schema/zod/document-ai-zod';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';

/**
 * ArcAI 세션 문서 생성
 *
 * - POST /api/document/ai
 * - body: { name, parentPath }
 * - response: { document: DocumentDTO }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throwApi('UNAUTHORIZED', '인증이 필요합니다.');
    }

    const userId = session.user.id;

    const raw = (await request.json().catch(() => undefined)) as unknown;
    const parsed = documentAiSessionCreateRequestSchema.safeParse(raw);

    if (!parsed.success) {
      throwApi('BAD_REQUEST', '요청 본문이 올바르지 않습니다.', {
        issues: parsed.error.flatten(),
      });
    }

    const input = parsed.data as DocumentAiSessionCreateRequest;
    const repository = new DocumentRepository();

    const created = await repository.createAiSessionForOwner({
      userId,
      parentPath: input.parentPath,
      name: input.name,
    });

    return ok(
      {
        document: mapDocumentToDTO(created),
      },
      {
        user: {
          id: userId,
          email: session.user.email || undefined,
        },
        message: 'AI 세션 문서를 성공적으로 생성했습니다.',
      },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/document/ai] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', 'AI 세션 문서 생성 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}


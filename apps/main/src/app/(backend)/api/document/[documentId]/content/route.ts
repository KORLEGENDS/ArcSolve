import { ApiException } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { DocumentRepository } from '@/share/schema/repositories/document-repository';
import {
  documentContentResponseSchema,
  documentContentUpdateRequestSchema,
} from '@/share/schema/zod/document-note-zod';
import { uuidSchema } from '@/share/schema/zod/base-zod';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

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

    const repository = new DocumentRepository();
    const result = await repository.findWithLatestContentForOwner(idResult.data, userId);

    if (!result) {
      return error('NOT_FOUND', '문서를 찾을 수 없습니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    const { document, content } = result;

    const payload = {
      documentId: document.documentId,
      contentId: content?.documentContentId ?? null,
      contents: (content as { contents?: unknown })?.contents ?? null,
      version: content?.version ?? null,
      createdAt: content?.createdAt?.toISOString() ?? null,
      updatedAt: content?.updatedAt?.toISOString() ?? null,
    };

    const parsed = documentContentResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return error('INTERNAL', '노트 콘텐츠 응답 검증에 실패했습니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { issues: parsed.error.issues },
      });
    }

    return ok(parsed.data, {
      user: { id: userId, email: session.user.email || undefined },
      message: '노트 콘텐츠를 성공적으로 조회했습니다.',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/document/[documentId]/content] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '노트 콘텐츠 조회 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
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
    const parsed = documentContentUpdateRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return error('BAD_REQUEST', issue?.message ?? '요청 본문이 올바르지 않습니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { issues: parsed.error.issues },
      });
    }

    const repository = new DocumentRepository();
    const result = await repository.appendContentVersionForOwner({
      documentId: idResult.data,
      userId,
      contents: parsed.data.contents,
    });

    const payload = {
      documentId: result.document.documentId,
      contentId: result.content.documentContentId,
      contents: (result.content as { contents?: unknown }).contents ?? null,
      version: result.content.version ?? null,
      createdAt: result.content.createdAt?.toISOString() ?? null,
      updatedAt: result.content.updatedAt?.toISOString() ?? null,
    };

    const validated = documentContentResponseSchema.safeParse(payload);
    if (!validated.success) {
      return error('INTERNAL', '노트 콘텐츠 응답 검증에 실패했습니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { issues: validated.error.issues },
      });
    }

    return ok(validated.data, {
      user: { id: userId, email: session.user.email || undefined },
      message: '노트 콘텐츠를 저장했습니다.',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/document/[documentId]/content] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '노트 콘텐츠 저장 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}



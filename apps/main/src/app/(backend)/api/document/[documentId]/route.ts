import { ApiException } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { DocumentRepository } from '@/share/schema/repositories/document-repository';
import { documentMetaUpdateRequestSchema } from '@/share/schema/zod/document-note-zod';
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
    const document = await repository.findByIdForOwner(idResult.data, userId);

    if (!document) {
      return error('NOT_FOUND', '문서를 찾을 수 없습니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    return ok(
      {
        document: {
          documentId: document.documentId,
          userId: document.userId,
          path: document.path as unknown as string,
          name: (document as { name?: string | null }).name ?? 'unnamed',
          kind: document.kind,
          uploadStatus: document.uploadStatus,
          fileMeta: document.fileMeta,
          createdAt: document.createdAt.toISOString(),
          updatedAt: document.updatedAt.toISOString(),
        },
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '문서 정보를 성공적으로 조회했습니다.',
      },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/document/[documentId]] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '문서 조회 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}

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
    const parsed = documentMetaUpdateRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return error('BAD_REQUEST', issue?.message ?? '요청 본문이 올바르지 않습니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { issues: parsed.error.issues },
      });
    }

    const repository = new DocumentRepository();
    const updated = await repository.updateDocumentMetaForOwner({
      documentId: idResult.data,
      userId,
      name: parsed.data.name,
    });

    return ok(
      {
        document: {
          documentId: updated.documentId,
          userId: updated.userId,
          path: updated.path as unknown as string,
          name: (updated as { name?: string | null }).name ?? 'unnamed',
          kind: updated.kind,
          uploadStatus: updated.uploadStatus,
          fileMeta: updated.fileMeta,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '문서 정보를 업데이트했습니다.',
      },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PATCH /api/document/[documentId]] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '문서 정보 업데이트 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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
    await repository.softDeleteDocumentForOwner({
      documentId: idResult.data,
      userId,
    });

    return ok(
      {},
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '문서를 삭제했습니다.',
      },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[DELETE /api/document/[documentId]] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '문서 삭제 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}



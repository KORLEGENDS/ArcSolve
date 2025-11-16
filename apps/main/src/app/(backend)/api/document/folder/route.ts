import { ApiException } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { DocumentRepository } from '@/share/schema/repositories/document-repository';
import type { DocumentFolderCreateRequest } from '@/share/schema/zod/document-upload-zod';
import { documentFolderCreateRequestSchema } from '@/share/schema/zod/document-upload-zod';
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
    const parsed = documentFolderCreateRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return error('BAD_REQUEST', issue?.message ?? '요청 본문이 올바르지 않습니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { issues: parsed.error.issues },
      });
    }

    const body: DocumentFolderCreateRequest = parsed.data;

    const repository = new DocumentRepository();
    const folder = await repository.createFolderForOwner({
      userId,
      parentPath: body.parentPath,
      name: body.name,
    });

    return ok(
      {
        document: {
          documentId: folder.documentId,
          userId: folder.userId,
          path: folder.path as unknown as string,
          name: (folder as { name?: string | null }).name ?? body.name,
          kind: folder.kind,
          uploadStatus: folder.uploadStatus,
          fileMeta: folder.fileMeta,
          createdAt: folder.createdAt.toISOString(),
          updatedAt: folder.updatedAt.toISOString(),
        },
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '폴더를 생성했습니다.',
      }
    );
  } catch (err) {
    console.error('[POST /api/document/folder] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '폴더 생성 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}



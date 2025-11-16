import { ApiException } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { DocumentRepository } from '@/share/schema/repositories/document-repository';
import type { NextRequest } from 'next/server';
import { auth } from '@auth';

function getFallbackNameFromPath(path: unknown): string {
  if (typeof path !== 'string') return 'unnamed';
  const parts = path.split('.').filter(Boolean);
  return parts[parts.length - 1] || 'unnamed';
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const kindParam = searchParams.get('kind');

    // 현재는 ArcManager 파일 트리(view=files)만 지원합니다.
    // kind 파라미터는 유지하되, 'file' 또는 null인 경우에만 허용합니다.
    if (!(kindParam === null || kindParam === 'file')) {
      return error('BAD_REQUEST', '지원하지 않는 문서 종류입니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { kind: kindParam },
      });
    }

    const repository = new DocumentRepository();
    const allDocuments = await repository.listByOwner(userId);

    // ArcManager 트리용 뷰: file + folder 문서만 반환합니다.
    const documents = allDocuments.filter(
      (doc) => doc.kind === 'file' || doc.kind === 'folder'
    );

    return ok(
      {
        documents: documents.map((doc) => {
          const rawName = (doc as { name?: unknown }).name;
          const name =
            typeof rawName === 'string' && rawName.trim().length > 0
              ? rawName
              : getFallbackNameFromPath(doc.path as unknown as string);

          return {
            documentId: doc.documentId,
            userId: doc.userId,
            path: doc.path,
            name,
            kind: doc.kind,
            uploadStatus: doc.uploadStatus,
            fileMeta: doc.fileMeta,
            createdAt: doc.createdAt.toISOString(),
            updatedAt: doc.updatedAt.toISOString(),
          };
        }),
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '문서 목록을 성공적으로 조회했습니다.',
      }
    );
  } catch (err) {
    console.error('[GET /api/document] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '문서 목록 조회 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}



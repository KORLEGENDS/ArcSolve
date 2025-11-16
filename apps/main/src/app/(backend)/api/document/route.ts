import { ApiException } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { DocumentRepository } from '@/share/schema/repositories/document-repository';
import type { NextRequest } from 'next/server';
import { auth } from '@auth';

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

    // 현재는 file 타입만 공식 지원 (확장 여지를 위해 쿼리 파라미터는 유연하게 처리)
    const kind = kindParam === 'file' || kindParam === null ? 'file' : null;
    if (!kind) {
      return error('BAD_REQUEST', '지원하지 않는 문서 종류입니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { kind: kindParam },
      });
    }

    const repository = new DocumentRepository();
    const documents = await repository.listByOwner(userId, { kind });

    return ok(
      {
        documents: documents.map((doc) => ({
          documentId: doc.documentId,
          userId: doc.userId,
          path: doc.path,
          kind: doc.kind,
          uploadStatus: doc.uploadStatus,
          fileMeta: doc.fileMeta,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        })),
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



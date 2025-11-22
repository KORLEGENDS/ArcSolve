import { ApiException, throwApi } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import {
  DocumentRepository,
  mapDocumentToDTO,
} from '@/share/schema/repositories/document-repository';
import { documentCreateRequestSchema, type DocumentCreateRequest } from '@/share/schema/zod/document-note-zod';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';

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

    const repository = new DocumentRepository();
    const { searchParams } = new URL(request.url);
    const kindParam = searchParams.get('kind');

    // kind 파라미터:
    // - null 또는 'document' : 노트/파일 + document 도메인 폴더 트리
    // - 'ai'                 : AI 세션 + AI 도메인 폴더 트리
    if (
      !(
        kindParam === null ||
        kindParam === 'document' ||
        kindParam === 'ai'
      )
    ) {
      return error('BAD_REQUEST', '지원하지 않는 문서 종류입니다.', {
        user: { id: userId, email: session.user.email || undefined },
        details: { kind: kindParam },
      });
    }

    const allDocuments = await repository.listByOwner(userId);

    const documents = allDocuments.filter((doc) => {
      const mimeType = doc.mimeType ?? undefined;
      const isFolder = doc.kind === 'folder';

      const isNote =
        typeof mimeType === 'string' &&
        mimeType.startsWith('application/vnd.arc.note+');
      const isAiSession =
        typeof mimeType === 'string' &&
        mimeType === 'application/vnd.arc.ai-chat+json';

      const isDocumentFolder =
        isFolder &&
        (mimeType === null ||
          mimeType === 'application/vnd.arc.folder+document');
      const isAiFolder =
        isFolder && mimeType === 'application/vnd.arc.folder+ai';

      const isFileLike =
        typeof mimeType === 'string' &&
        !isNote &&
        !isAiSession &&
        !mimeType.startsWith('application/vnd.arc.folder+');

      if (kindParam === 'ai') {
        // AI 트리: AI 세션 + AI 폴더만 반환
        return isAiFolder || isAiSession;
      }

      // 기본(문서 트리): note + fileLike + document 폴더
      return isDocumentFolder || isNote || isFileLike;
    });

    return ok(
      {
        documents: documents.map((doc) => mapDocumentToDTO(doc)),
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '문서 목록을 성공적으로 조회했습니다.',
      },
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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throwApi('UNAUTHORIZED', '인증이 필요합니다.');
    }

    const userId = session.user.id;

    const raw = (await request.json().catch(() => undefined)) as unknown;
    const parsed = documentCreateRequestSchema.safeParse(raw);

    if (!parsed.success) {
      throwApi('BAD_REQUEST', '요청 본문이 올바르지 않습니다.', {
        issues: parsed.error.flatten(),
      });
    }

    const input = parsed.data as DocumentCreateRequest;
    const repository = new DocumentRepository();

    let created;

    switch (input.kind) {
      case 'note': {
        const result = await repository.createNoteForOwner({
          userId,
          parentPath: input.parentPath,
          name: input.name,
          initialContents: input.contents,
        });
        created = result.document;
        break;
      }
      case 'ai': {
        created = await repository.createAiSessionForOwner({
          userId,
          parentPath: input.parentPath,
          name: input.name,
        });
        break;
      }
      default: {
        throwApi('BAD_REQUEST', '지원하지 않는 문서 종류입니다.', {
          kind: (input as { kind?: unknown })?.kind,
        });
      }
    }

    return ok(
      {
        document: mapDocumentToDTO(created),
      },
      {
        user: {
          id: userId,
          email: session.user.email || undefined,
        },
        message: '문서를 성공적으로 생성했습니다.',
      },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/document] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '문서 생성 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}


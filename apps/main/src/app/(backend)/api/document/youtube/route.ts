import { ApiException, throwApi } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import {
  DocumentRepository,
  mapDocumentToDTO,
} from '@/share/schema/repositories/document-repository';
import {
  type YoutubeDocumentCreateRequest,
  youtubeDocumentCreateRequestSchema,
} from '@/share/schema/zod/document-youtube-zod';
import { fetchYoutubeTitle } from '@/share/share-utils/youtube-utils';
import type { NextRequest } from 'next/server';
import { auth } from '@auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throwApi('UNAUTHORIZED', '인증이 필요합니다.');
    }

    const userId = session.user.id;

    const bodyRaw = (await request.json().catch(() => undefined)) as unknown;
    const parsed = youtubeDocumentCreateRequestSchema.safeParse(bodyRaw);

    if (!parsed.success) {
      throwApi('BAD_REQUEST', '요청 본문이 올바르지 않습니다.', {
        issues: parsed.error.flatten(),
      });
    }

    const input = parsed.data as YoutubeDocumentCreateRequest;

    // 이름 결정: YouTube oEmbed title 시도 → 실패 시 'YouTube'로 fallback
    let finalName: string | null = null;

    const title = await fetchYoutubeTitle(input.url).catch(() => null);
    if (title && title.trim().length > 0) {
      finalName = title.trim();
    }

    if (!finalName) {
      finalName = 'YouTube';
    }

    const repository = new DocumentRepository();
    const created = await repository.createExternalFile({
      userId,
      parentPath: input.parentPath,
      name: finalName,
      mimeType: 'video/youtube',
      storageKey: input.url,
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
        message: 'YouTube 문서를 성공적으로 생성했습니다.',
      },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/document/youtube] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', 'YouTube 문서 생성 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}



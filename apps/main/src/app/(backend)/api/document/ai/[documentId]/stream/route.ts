import { createDocumentChatStream } from '@/server/ai/document-ai-service';
import { ApiException, throwApi } from '@/server/api/errors';
import { error } from '@/server/api/response';
import { uuidSchema } from '@/share/schema/zod/base-zod';
import { auth } from '@auth';
import type { UIMessage } from 'ai';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

// 스트리밍 응답 최대 시간 (초)
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

const requestBodySchema = z.object({
  messages: z.array(z.unknown()) as z.ZodType<UIMessage[]>,
});

/**
 * 문서 기반 AI 채팅 스트림
 *
 * - POST /api/document/ai/[documentId]/stream
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throwApi('UNAUTHORIZED', '인증이 필요합니다.');
    }

    const userId = session.user.id;

    const { documentId } = await context.params;
    const idResult = uuidSchema.safeParse(documentId);
    if (!idResult.success) {
      throwApi('BAD_REQUEST', '유효하지 않은 문서 ID입니다.', {
        issues: idResult.error.flatten(),
      });
    }

    const raw = (await request.json().catch(() => undefined)) as unknown;
    const parsed = requestBodySchema.safeParse(raw);

    if (!parsed.success) {
      throwApi('BAD_REQUEST', '요청 본문이 올바르지 않습니다.', {
        issues: parsed.error.flatten(),
      });
    }

    const { messages: newMessages } = parsed.data;

    return createDocumentChatStream({
      documentId: idResult.data,
      userId,
      newMessages,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[POST /api/document/ai/[documentId]/stream] Error:',
      err,
    );

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', 'AI 대화 처리 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}



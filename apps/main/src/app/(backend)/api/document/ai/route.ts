import {
  createDocumentChatStream,
  loadDocumentConversation,
} from '@/server/ai/document-ai-service';
import { ApiException, throwApi } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { auth } from '@auth';
import type { UIMessage } from 'ai';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

// 스트리밍 응답 최대 시간 (초)
export const maxDuration = 60;

const requestBodySchema = z.object({
  documentId: z.string().uuid(),
  messages: z.array(z.unknown()) as z.ZodType<UIMessage[]>,
});

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
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return error('BAD_REQUEST', 'documentId 쿼리 파라미터가 필요합니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    const data = await loadDocumentConversation({
      documentId,
      userId,
    });

    return ok(data, {
      user: { id: userId, email: session.user.email || undefined },
      message: 'AI 대화 히스토리를 성공적으로 조회했습니다.',
    });
  } catch (err) {
    console.error('[GET /api/document/ai] Error:', err);

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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throwApi('UNAUTHORIZED', '인증이 필요합니다.');
    }

    const userId = session.user.id;

    const raw = (await request.json().catch(() => undefined)) as unknown;
    const parsed = requestBodySchema.safeParse(raw);

    if (!parsed.success) {
      throwApi('BAD_REQUEST', '요청 본문이 올바르지 않습니다.', {
        issues: parsed.error.flatten(),
      });
    }

    const { documentId, messages: newMessages } = parsed.data;

    return createDocumentChatStream({
      documentId,
      userId,
      newMessages,
    });
  } catch (err) {
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

    return error('INTERNAL', 'AI 대화 처리 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}



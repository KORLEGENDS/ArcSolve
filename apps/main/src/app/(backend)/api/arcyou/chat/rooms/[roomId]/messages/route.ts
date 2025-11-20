import { error, ok } from '@/server/api/response';
import { ArcyouChatMessageRepository } from '@/share/schema/repositories/arcyou-chat-message-repository';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ roomId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return error('UNAUTHORIZED', '인증이 필요합니다.');
    }
    const userId = session.user.id;
    const { roomId } = await ctx.params;
    if (!roomId) {
      return error('BAD_REQUEST', 'roomId가 필요합니다.');
    }

    const sp = request.nextUrl.searchParams;
    const beforeCreatedAtRaw = sp.get('before');
    const limitRaw = sp.get('limit');
    const beforeCreatedAt = beforeCreatedAtRaw ? beforeCreatedAtRaw : undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;
    if (limitRaw && (Number.isNaN(limit) || limit! <= 0)) {
      return error('BAD_REQUEST', 'limit은 양의 정수여야 합니다.');
    }

    const repo = new ArcyouChatMessageRepository();
    const rows = await repo.listByRoomId(userId, roomId, { beforeCreatedAt, limit });

    // 최신 우선으로 반환되므로 클라이언트에서 필요시 역순 정렬 가능
    const hasMore = rows.length === Math.min(Math.max(limit ?? 50, 1), 200);
    const nextBefore = rows.length > 0 ? rows[rows.length - 1].createdAt?.toISOString() : undefined;

    return ok(
      {
        messages: rows.map((m) => ({
          id: m.id,
          roomId: m.roomId,
          userId: m.userId,
          content: m.content,
          createdAt: m.createdAt?.toISOString(),
        })),
        hasMore,
        nextBefore,
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '메시지 히스토리를 성공적으로 조회했습니다.',
      },
    );
  } catch (err: any) {
    if (err?.code === 'FORBIDDEN') {
      return error('FORBIDDEN', '권한이 없습니다.');
    }
    return error('INTERNAL', '메시지 조회 중 오류가 발생했습니다.');
  }
}





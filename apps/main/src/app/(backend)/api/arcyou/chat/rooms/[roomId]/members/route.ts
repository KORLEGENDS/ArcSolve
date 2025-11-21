import { error, ok } from '@/server/api/response';
import { ArcyouChatRoomRepository } from '@/share/schema/repositories/arcyou-chat-room-repository';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{
    roomId: string;
  }>;
}

/**
 * GET /api/arcyou/chat/rooms/[roomId]/members
 *
 * 채팅방 멤버 목록을 조회합니다.
 *
 * - 요청 사용자가 해당 채팅방의 멤버가 아닌 경우 FORBIDDEN 에러를 반환합니다.
 * - 각 멤버에 대한 기본 프로필 정보 및 lastReadMessageId 를 포함합니다.
 */
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
    const { roomId } = await context.params;

    if (!roomId) {
      return error('BAD_REQUEST', 'roomId가 필요합니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    const repository = new ArcyouChatRoomRepository();
    const members = await repository.listMembersByRoomId(roomId, userId);

    return ok(
      {
        members: members.map((m) => ({
          userId: m.userId,
          role: m.role,
          lastReadMessageId: m.lastReadMessageId,
          name: m.name,
          email: m.email,
          imageUrl: m.imageUrl,
        })),
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '채팅방 멤버 목록을 성공적으로 조회했습니다.',
      }
    );
  } catch (err) {
    // 서버 측에서만 에러 로그 기록 (클라이언트에 노출 안 됨)
    console.error('[GET /api/arcyou/chat/rooms/[roomId]/members] Error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return error('INTERNAL', '채팅방 멤버 목록 조회 중 오류가 발생했습니다.');
  }
}



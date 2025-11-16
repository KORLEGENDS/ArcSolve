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
 * PATCH /api/arcyou/chat/rooms/[roomId]
 *
 * 채팅방 이름을 수정합니다.
 */
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
    const { roomId } = await context.params;

    if (!roomId) {
      return error('BAD_REQUEST', 'roomId가 필요합니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
    };

    if (typeof body.name !== 'string') {
      return error('BAD_REQUEST', '채팅방 이름은 문자열이어야 합니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    const repository = new ArcyouChatRoomRepository();
    const room = await repository.updateName(roomId, userId, body.name);

    return ok(
      {
        room: {
          id: room.id,
          name: room.name,
          type: room.type,
          imageUrl: room.imageUrl,
          lastMessage: room.lastMessage,
          role: room.role,
          lastReadMessageId: room.lastReadMessageId,
          createdAt: room.createdAt?.toISOString() ?? null,
          updatedAt: room.updatedAt?.toISOString() ?? null,
        },
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '채팅방 이름이 성공적으로 수정되었습니다.',
      }
    );
  } catch (err) {
    return error('INTERNAL', '채팅방 이름 수정 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}



import { error, ok } from '@/share/api/server/response';
import { UserChatRoomRepository } from '@/share/schema/repositories/user-chat-room-repository';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';

/**
 * GET /api/arcyou/chat/rooms
 * 
 * 현재 인증된 사용자의 채팅방 목록을 반환합니다.
 */
export async function GET() {
  try {
    // 인증 확인
    const session = await auth();
    if (!session?.user?.id) {
      return error('UNAUTHORIZED', '인증이 필요합니다.', {
        user: session?.user ? { id: session.user.id, email: session.user.email || undefined } : undefined,
      });
    }

    const userId = session.user.id;

    // 사용자가 멤버인 채팅방 조회
    const repository = new UserChatRoomRepository();
    const rooms = await repository.listByUserId(userId);

    return ok(
      {
        rooms: rooms.map((room) => ({
          id: room.id,
          name: room.name,
          description: room.description,
          lastMessageId: room.lastMessageId,
          role: room.role,
          lastReadMessageId: room.lastReadMessageId,
          createdAt: room.createdAt?.toISOString(),
          updatedAt: room.updatedAt?.toISOString(),
        })),
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '채팅방 목록을 성공적으로 조회했습니다.',
      }
    );
  } catch (err) {
    console.error('[GET /api/arcyou/chat/rooms] Error:', err);
    return error(
      'INTERNAL',
      '채팅방 목록 조회 중 오류가 발생했습니다.',
      {
        details: err instanceof Error ? { message: err.message } : undefined,
      }
    );
  }
}

/**
 * POST /api/arcyou/chat/rooms
 * 
 * 새로운 채팅방을 생성합니다.
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await auth();
    if (!session?.user?.id) {
      return error('UNAUTHORIZED', '인증이 필요합니다.', {
        user: session?.user ? { id: session.user.id, email: session.user.email || undefined } : undefined,
      });
    }

    const userId = session.user.id;

    // 요청 본문 파싱
    const body = await request.json().catch(() => ({}));
    const { name, description } = body;

    // 유효성 검사
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return error('BAD_REQUEST', '채팅방 이름은 필수입니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    if (name.length > 255) {
      return error('BAD_REQUEST', '채팅방 이름은 255자 이하여야 합니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    if (description && typeof description !== 'string') {
      return error('BAD_REQUEST', '설명은 문자열이어야 합니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    // 채팅방 생성
    const repository = new UserChatRoomRepository();
    const room = await repository.create(
      {
        name: name.trim(),
        description: description?.trim() || null,
      },
      userId
    );

    return ok(
      {
        room: {
          id: room.id,
          name: room.name,
          description: room.description,
          lastMessageId: room.lastMessageId,
          role: room.role,
          lastReadMessageId: room.lastReadMessageId,
          createdAt: room.createdAt?.toISOString(),
          updatedAt: room.updatedAt?.toISOString(),
        },
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '채팅방이 성공적으로 생성되었습니다.',
      }
    );
  } catch (err) {
    console.error('[POST /api/arcyou/chat/rooms] Error:', err);
    return error(
      'INTERNAL',
      '채팅방 생성 중 오류가 발생했습니다.',
      {
        details: err instanceof Error ? { message: err.message } : undefined,
      }
    );
  }
}


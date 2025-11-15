import { error, ok } from '@/server/api/response';
import {
  ArcyouChatRoomRepository,
  type ArcyouChatRoomWithMemberInfo,
} from '@/share/schema/repositories/arcyou-chat-room-repository';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';

/**
 * GET /api/arcyou/chat/rooms?type=direct|group
 * 
 * 현재 인증된 사용자의 채팅방 목록을 반환합니다.
 * type 파라미터로 필터링 가능합니다 (direct 또는 group).
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await auth();
    if (!session?.user?.id) {
      return error('UNAUTHORIZED', '인증이 필요합니다.', {
        user: session?.user ? { id: session.user.id, email: session.user.email || undefined } : undefined,
      });
    }

    const userId = session.user.id;

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'direct' | 'group' | null;

    // type 유효성 검사
    if (type && type !== 'direct' && type !== 'group') {
      return error('BAD_REQUEST', 'type은 "direct" 또는 "group"이어야 합니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    // 사용자가 멤버인 채팅방 조회
    const repository = new ArcyouChatRoomRepository();
    const rooms = await repository.listByUserId(userId, type || undefined);

    return ok(
      {
        rooms: rooms.map((room) => ({
          id: room.id,
          name: room.name,
          description: room.description,
          type: room.type,
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
    const { type, name, description, targetUserId, memberIds } = body;

    // 유효성 검사
    if (!type || (type !== 'direct' && type !== 'group')) {
      return error('BAD_REQUEST', 'type은 "direct" 또는 "group"이어야 합니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    if (type === 'direct' && !targetUserId) {
      return error('BAD_REQUEST', 'direct 타입 채팅방은 targetUserId가 필수입니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    if (type === 'group' && (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0)) {
      return error('BAD_REQUEST', 'group 타입 채팅방은 최소 1명의 멤버가 필요합니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

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

    const repository = new ArcyouChatRoomRepository();

    // direct 타입은 기존 방이 있는지 먼저 확인
    if (type === 'direct' && targetUserId) {
      const existingRoom = await repository.findDirectRoomBetweenUsers(
        userId,
        targetUserId
      );
      if (existingRoom) {
        return ok(
          {
            room: serializeRoom(existingRoom),
          },
          {
            user: { id: userId, email: session.user.email || undefined },
            message: '이미 존재하는 1:1 채팅방을 반환했습니다.',
          }
        );
      }
    }

    // 채팅방 생성
    const room = await repository.create(
      {
        type,
        name: name.trim(),
        description: description?.trim() || null,
        targetUserId: type === 'direct' ? targetUserId : undefined,
        memberIds: type === 'group' ? memberIds : undefined,
      },
      userId
    );

    return ok(
      {
        room: serializeRoom(room),
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

function serializeRoom(room: ArcyouChatRoomWithMemberInfo) {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    type: room.type,
    lastMessageId: room.lastMessageId,
    role: room.role,
    lastReadMessageId: room.lastReadMessageId,
    createdAt: room.createdAt?.toISOString(),
    updatedAt: room.updatedAt?.toISOString(),
  };
}


import { error, ok } from '@/share/api/server/response';
import { ApiException } from '@/share/api/server/errors';
import { ArcyouChatRelationRepository } from '@/share/schema/repositories/arcyou-chat-relation-repository';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';

/**
 * GET /api/arcyou/relation
 * 
 * 현재 인증된 사용자의 친구 관계 목록을 반환합니다.
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

    // 친구 관계 목록 조회
    const repository = new ArcyouChatRelationRepository();
    const relationships = await repository.listByUserId(userId);

    return ok(
      {
        relationships: relationships.map((rel) => ({
          userId: rel.userId,
          targetUserId: rel.targetUserId,
          status: rel.status,
          requestedAt: rel.requestedAt?.toISOString() || null,
          respondedAt: rel.respondedAt?.toISOString() || null,
          blockedAt: rel.blockedAt?.toISOString() || null,
          targetUser: {
            id: rel.targetUser.id,
            name: rel.targetUser.name,
            email: rel.targetUser.email,
            imageUrl: rel.targetUser.imageUrl,
          },
          isReceivedRequest: rel.isReceivedRequest ?? false,
        })),
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '친구 관계 목록을 성공적으로 조회했습니다.',
      }
    );
  } catch (err) {
    console.error('[GET /api/arcyou/relation] Error:', err);
    return error(
      'INTERNAL',
      '친구 관계 목록 조회 중 오류가 발생했습니다.',
      {
        details: err instanceof Error ? { message: err.message } : undefined,
      }
    );
  }
}

/**
 * POST /api/arcyou/relation
 * 
 * 친구 요청을 보냅니다.
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
    const { email } = body;

    // 유효성 검사
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return error('BAD_REQUEST', '이메일은 필수입니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    // 친구 요청 보내기
    const repository = new ArcyouChatRelationRepository();
    const relation = await repository.sendFriendRequest(userId, email.trim());

    return ok(
      {
        relation: {
          userId: relation.userId,
          targetUserId: relation.targetUserId,
          status: relation.status,
          requestedAt: relation.requestedAt?.toISOString(),
          respondedAt: relation.respondedAt?.toISOString() || null,
          blockedAt: relation.blockedAt?.toISOString() || null,
        },
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '친구 요청이 성공적으로 전송되었습니다.',
      }
    );
  } catch (err) {
    console.error('[POST /api/arcyou/relation] Error:', err);

    // ApiException 처리
    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(
        err.code,
        err.message,
        {
          user: session?.user?.id ? { id: session.user.id, email: session.user.email || undefined } : undefined,
          details: err.details,
        }
      );
    }

    return error(
      'INTERNAL',
      '친구 요청 전송 중 오류가 발생했습니다.',
      {
        details: err instanceof Error ? { message: err.message } : undefined,
      }
    );
  }
}


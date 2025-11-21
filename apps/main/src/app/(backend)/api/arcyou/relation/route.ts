import { ApiException } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { ArcyouChatRelationRepository } from '@/share/schema/repositories/arcyou-chat-relation-repository';
import { auth } from '@auth';
import type { NextRequest } from 'next/server';

/**
 * GET /api/arcyou/relation?q=검색어
 * 
 * q 파라미터가 있으면 친구 검색, 없으면 친구 관계 목록을 반환합니다.
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

    // 쿼리 파라미터 확인
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('q');

    const repository = new ArcyouChatRelationRepository();

    // 검색어가 있으면 검색, 없으면 목록 조회
    if (searchQuery && searchQuery.trim().length > 0) {
      // 친구 검색
      const relationships = await repository.searchFriends(userId, searchQuery.trim());

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
          message: '친구 검색을 완료했습니다.',
        }
      );
    }

    // 친구 관계 목록 조회
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
    // 서버 측에서만 에러 로그 기록 (클라이언트에 노출 안 됨)
    console.error('[GET /api/arcyou/relation] Error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return error('INTERNAL', '친구 관계 조회 중 오류가 발생했습니다.');
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
    // 서버 측에서만 에러 로그 기록 (클라이언트에 노출 안 됨)
    console.error('[POST /api/arcyou/relation] Error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });

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

    return error('INTERNAL', '친구 요청 전송 중 오류가 발생했습니다.');
  }
}

/**
 * PATCH /api/arcyou/relation
 * 
 * 친구 요청을 수락, 거절, 또는 취소합니다.
 */
export async function PATCH(request: NextRequest) {
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
    const { requesterUserId, targetUserId, action } = body;

    // action이 'cancel'인 경우 취소 처리
    if (action === 'cancel') {
      // 유효성 검사
      if (!targetUserId || typeof targetUserId !== 'string') {
        return error('BAD_REQUEST', 'targetUserId는 필수입니다.', {
          user: { id: userId, email: session.user.email || undefined },
        });
      }

      // 자기 자신에게 요청 방지
      if (userId === targetUserId) {
        return error('BAD_REQUEST', '자기 자신의 요청을 취소할 수 없습니다.', {
          user: { id: userId, email: session.user.email || undefined },
        });
      }

      // 친구 요청 취소
      const repository = new ArcyouChatRelationRepository();
      const relation = await repository.cancelFriendRequest(userId, targetUserId);

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
          message: '친구 요청이 성공적으로 취소되었습니다.',
        }
      );
    }

    // 기존 로직: 수락/거절
    // 유효성 검사
    if (!requesterUserId || typeof requesterUserId !== 'string') {
      return error('BAD_REQUEST', '요청자 ID는 필수입니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    if (!action || (action !== 'accept' && action !== 'reject')) {
      return error('BAD_REQUEST', 'action은 "accept" 또는 "reject"여야 합니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    // 자기 자신에게 요청 방지
    if (userId === requesterUserId) {
      return error('BAD_REQUEST', '자기 자신의 요청을 처리할 수 없습니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    // 친구 요청 수락/거절
    const repository = new ArcyouChatRelationRepository();
    const relation =
      action === 'accept'
        ? await repository.acceptFriendRequest(userId, requesterUserId)
        : await repository.rejectFriendRequest(userId, requesterUserId);

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
        message: action === 'accept' ? '친구 요청을 수락했습니다.' : '친구 요청을 거절했습니다.',
      }
    );
  } catch (err) {
    // 서버 측에서만 에러 로그 기록 (클라이언트에 노출 안 됨)
    console.error('[PATCH /api/arcyou/relation] Error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });

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

    return error('INTERNAL', '친구 요청 처리 중 오류가 발생했습니다.');
  }
}

/**
 * DELETE /api/arcyou/relation
 * 
 * 친구 관계를 삭제합니다.
 */
export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인
    const session = await auth();
    if (!session?.user?.id) {
      return error('UNAUTHORIZED', '인증이 필요합니다.', {
        user: session?.user ? { id: session.user.id, email: session.user.email || undefined } : undefined,
      });
    }

    const userId = session.user.id;

    // 쿼리 파라미터에서 friendUserId 추출
    const { searchParams } = new URL(request.url);
    const friendUserId = searchParams.get('friendUserId');

    // 유효성 검사
    if (!friendUserId || typeof friendUserId !== 'string') {
      return error('BAD_REQUEST', 'friendUserId는 필수입니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    // 자기 자신과의 관계 삭제 방지
    if (userId === friendUserId) {
      return error('BAD_REQUEST', '자기 자신과의 관계를 삭제할 수 없습니다.', {
        user: { id: userId, email: session.user.email || undefined },
      });
    }

    // 친구 관계 삭제
    const repository = new ArcyouChatRelationRepository();
    const deletedCount = await repository.deleteFriendRelation(userId, friendUserId);

    return ok(
      {
        deletedCount,
      },
      {
        user: { id: userId, email: session.user.email || undefined },
        message: '친구 관계가 성공적으로 삭제되었습니다.',
      }
    );
  } catch (err) {
    // 서버 측에서만 에러 로그 기록 (클라이언트에 노출 안 됨)
    console.error('[DELETE /api/arcyou/relation] Error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });

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

    return error('INTERNAL', '친구 관계 삭제 중 오류가 발생했습니다.');
  }
}



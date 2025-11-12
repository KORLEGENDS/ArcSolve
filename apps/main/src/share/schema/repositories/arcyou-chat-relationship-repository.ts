import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import { throwApi } from '@/share/api/server/errors';
import {
  arcyouChatRelationships,
  type ArcyouChatRelationship,
  type NewArcyouChatRelationship,
  users,
} from '@/share/schema/drizzles';
import { and, eq, isNull, or } from 'drizzle-orm';
import type { DB } from './base-repository';
import { UserRepository } from './user-repository';

export class ArcyouChatRelationshipRepository {
  private readonly userRepository: UserRepository;

  constructor(private readonly database: DB = defaultDb) {
    this.userRepository = new UserRepository(database);
  }

  /**
   * email을 기반으로 친구 요청을 보냅니다.
   * @param userId 요청을 보내는 사용자 ID
   * @param targetUserEmail 대상 사용자 email
   * @returns 생성된 관계 데이터
   * @throws ApiException
   *   - NOT_FOUND: 대상 사용자를 찾을 수 없음
   *   - BAD_REQUEST: 자기 자신에게 요청을 보낼 수 없음
   *   - CONFLICT: 이미 존재하는 관계가 있음
   */
  async sendFriendRequest(
    userId: string,
    targetUserEmail: string
  ): Promise<ArcyouChatRelationship> {
    return await this.database.transaction(async (tx) => {
      // 1. email로 대상 사용자 조회
      const targetUser = await this.userRepository.getByEmail(targetUserEmail);
      if (!targetUser) {
        throwApi('NOT_FOUND', '해당 이메일의 사용자를 찾을 수 없습니다.', {
          email: targetUserEmail,
        });
      }

      const targetUserId = targetUser.id;

      // 2. 자기 자신에게 요청 방지
      if (userId === targetUserId) {
        throwApi('BAD_REQUEST', '자기 자신에게 친구 요청을 보낼 수 없습니다.');
      }

      // 3. 이미 존재하는 관계 확인 (양방향 확인)
      // userId -> targetUserId 또는 targetUserId -> userId 관계가 이미 존재하는지 확인
      const existingRelationships = await tx
        .select()
        .from(arcyouChatRelationships)
        .where(
          or(
            // userId가 요청자이고 targetUserId가 대상인 경우
            and(
              eq(arcyouChatRelationships.userId, userId),
              eq(arcyouChatRelationships.targetUserId, targetUserId)
            ),
            // targetUserId가 요청자이고 userId가 대상인 경우 (역방향)
            and(
              eq(arcyouChatRelationships.userId, targetUserId),
              eq(arcyouChatRelationships.targetUserId, userId)
            )
          )
        )
        .limit(1);

      if (existingRelationships.length > 0) {
        const existing = existingRelationships[0];
        const statusMessage =
          existing.status === 'pending'
            ? '이미 친구 요청이 대기 중입니다.'
            : existing.status === 'accepted'
              ? '이미 친구 관계입니다.'
              : existing.status === 'blocked'
                ? '차단된 사용자입니다.'
                : '이미 거절된 요청입니다.';

        throwApi('CONFLICT', statusMessage, {
          existingStatus: existing.status,
          relationshipId: {
            userId: existing.userId,
            targetUserId: existing.targetUserId,
          },
        });
      }

      // 4. 새로운 관계 생성 (pending 상태)
      const newRelationship: NewArcyouChatRelationship = {
        userId,
        targetUserId,
        status: 'pending',
        requestedAt: new Date(),
        respondedAt: null,
        blockedAt: null,
      };

      const [created] = await tx
        .insert(arcyouChatRelationships)
        .values(newRelationship)
        .returning();

      if (!created) {
        throwApi('INTERNAL', '친구 요청 생성에 실패했습니다.');
      }

      return created;
    });
  }
}


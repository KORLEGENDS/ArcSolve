import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import { throwApi } from '@/share/api/server/errors';
import {
  arcyouChatRelations,
  users,
  type ArcyouChatRelation,
  type NewArcyouChatRelation,
} from '@/share/schema/drizzles';
import { and, eq, or } from 'drizzle-orm';
import type { DB } from './base-repository';
import { UserRepository } from './user-repository';

/**
 * 관계 데이터와 대상 사용자 정보를 결합한 타입
 * isReceivedRequest: 현재 사용자가 요청을 받은 경우 true (수락/거부 가능)
 */
export type RelationshipWithTargetUser = ArcyouChatRelation & {
  targetUser: {
    id: string;
    name: string;
    email: string;
    imageUrl: string | null;
  };
  /**
   * 현재 사용자가 요청을 받은 경우 true
   * pending 상태에서 수락/거부 버튼을 표시할지 결정하는 데 사용
   */
  isReceivedRequest?: boolean;
};

export class ArcyouChatRelationRepository {
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
  ): Promise<ArcyouChatRelation> {
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
      const existingRelations = await tx
        .select()
        .from(arcyouChatRelations)
        .where(
          or(
            // userId가 요청자이고 targetUserId가 대상인 경우
            and(
              eq(arcyouChatRelations.userId, userId),
              eq(arcyouChatRelations.targetUserId, targetUserId)
            ),
            // targetUserId가 요청자이고 userId가 대상인 경우 (역방향)
            and(
              eq(arcyouChatRelations.userId, targetUserId),
              eq(arcyouChatRelations.targetUserId, userId)
            )
          )
        )
        .limit(1);

      if (existingRelations.length > 0) {
        const existing = existingRelations[0];
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
          relationId: {
            userId: existing.userId,
            targetUserId: existing.targetUserId,
          },
        });
      }

      // 4. 새로운 관계 생성 (pending 상태)
      const newRelation: NewArcyouChatRelation = {
        userId,
        targetUserId,
        status: 'pending',
        requestedAt: new Date(),
        respondedAt: null,
        blockedAt: null,
      };

      const [created] = await tx
        .insert(arcyouChatRelations)
        .values(newRelation)
        .returning();

      if (!created) {
        throwApi('INTERNAL', '친구 요청 생성에 실패했습니다.');
      }

      return created;
    });
  }

  /**
   * 사용자의 친구 관계 목록을 조회합니다.
   * userId가 요청자이거나 대상인 모든 관계를 조회하고, 대상 사용자 정보를 포함합니다.
   * pending/accepted 상태만 포함하고, pending 상태에서 요청 방향 정보를 포함합니다.
   * @param userId 사용자 ID
   * @returns 친구 관계 목록 (대상 사용자 정보 포함, pending/accepted만)
   */
  async listByUserId(userId: string): Promise<RelationshipWithTargetUser[]> {

    // userId가 요청자인 경우: targetUserId에 해당하는 사용자 정보 가져오기
    const forwardRelations = await this.database
      .select({
        userId: arcyouChatRelations.userId,
        targetUserId: arcyouChatRelations.targetUserId,
        status: arcyouChatRelations.status,
        requestedAt: arcyouChatRelations.requestedAt,
        respondedAt: arcyouChatRelations.respondedAt,
        blockedAt: arcyouChatRelations.blockedAt,
        targetUser: {
          id: users.id,
          name: users.name,
          email: users.email,
          imageUrl: users.imageUrl,
        },
      })
      .from(arcyouChatRelations)
      .innerJoin(users, eq(arcyouChatRelations.targetUserId, users.id))
      .where(eq(arcyouChatRelations.userId, userId));

    // userId가 대상인 경우 (역방향): userId에 해당하는 사용자 정보 가져오기
    const reverseRelations = await this.database
      .select({
        userId: arcyouChatRelations.userId,
        targetUserId: arcyouChatRelations.targetUserId,
        status: arcyouChatRelations.status,
        requestedAt: arcyouChatRelations.requestedAt,
        respondedAt: arcyouChatRelations.respondedAt,
        blockedAt: arcyouChatRelations.blockedAt,
        targetUser: {
          id: users.id,
          name: users.name,
          email: users.email,
          imageUrl: users.imageUrl,
        },
      })
      .from(arcyouChatRelations)
      .innerJoin(users, eq(arcyouChatRelations.userId, users.id))
      .where(eq(arcyouChatRelations.targetUserId, userId));

    // 정방향 관계: 내가 보낸 요청 (isReceivedRequest: false)
    const normalizedForward = forwardRelations.map((rel) => ({
      userId: rel.userId,
      targetUserId: rel.targetUserId,
      status: rel.status,
      requestedAt: rel.requestedAt,
      respondedAt: rel.respondedAt,
      blockedAt: rel.blockedAt,
      targetUser: rel.targetUser,
      isReceivedRequest: false, // 내가 보낸 요청
    }));

    // 역방향 관계: 내가 받은 요청 (isReceivedRequest: true)
    // 역방향 관계를 정방향으로 변환하되, 원본 정보 유지
    const normalizedReverse = reverseRelations.map((rel) => ({
      userId: rel.targetUserId, // 원래 targetUserId가 이제 userId가 됨
      targetUserId: rel.userId, // 원래 userId가 이제 targetUserId가 됨
      status: rel.status,
      requestedAt: rel.requestedAt,
      respondedAt: rel.respondedAt,
      blockedAt: rel.blockedAt,
      targetUser: rel.targetUser, // 원래 요청자가 이제 targetUser가 됨
      isReceivedRequest: true, // 내가 받은 요청
    }));

    // 두 결과를 합쳐서 pending / accepted 상태만 반환
    const allRelations = [...normalizedForward, ...normalizedReverse];

    const filtered = allRelations.filter(
      (rel) => rel.status === 'pending' || rel.status === 'accepted'
    );

    return filtered;
  }

  /**
   * 친구 요청을 수락합니다.
   * 현재 사용자가 받은 요청을 수락합니다.
   * @param userId 현재 사용자 ID (요청을 받은 사람)
   * @param requesterUserId 요청을 보낸 사용자 ID
   * @returns 업데이트된 관계 데이터
   * @throws ApiException
   *   - NOT_FOUND: 해당 관계를 찾을 수 없음
   *   - BAD_REQUEST: 이미 처리된 요청이거나 수락할 수 없는 상태
   */
  async acceptFriendRequest(
    userId: string,
    requesterUserId: string
  ): Promise<ArcyouChatRelation> {
    return await this.database.transaction(async (tx) => {
      // DB에서는 userId가 요청자, targetUserId가 받은 사람
      const [existing] = await tx
        .select()
        .from(arcyouChatRelations)
        .where(
          and(
            eq(arcyouChatRelations.userId, requesterUserId),
            eq(arcyouChatRelations.targetUserId, userId)
          )
        )
        .limit(1);

      if (!existing) {
        throwApi('NOT_FOUND', '해당 친구 요청을 찾을 수 없습니다.', {
          requesterUserId,
          userId,
        });
      }

      if (existing.status !== 'pending') {
        throwApi(
          'BAD_REQUEST',
          existing.status === 'accepted'
            ? '이미 수락된 요청입니다.'
            : existing.status === 'rejected'
              ? '이미 거절된 요청입니다.'
              : '수락할 수 없는 상태의 요청입니다.',
          {
            currentStatus: existing.status,
          }
        );
      }

      const [updated] = await tx
        .update(arcyouChatRelations)
        .set({
          status: 'accepted',
          respondedAt: new Date(),
        })
        .where(
          and(
            eq(arcyouChatRelations.userId, requesterUserId),
            eq(arcyouChatRelations.targetUserId, userId)
          )
        )
        .returning();

      if (!updated) {
        throwApi('INTERNAL', '친구 요청 수락에 실패했습니다.');
      }

      return updated;
    });
  }

  /**
   * 친구 요청을 거절합니다.
   * 현재 사용자가 받은 요청을 거절합니다.
   * @param userId 현재 사용자 ID (요청을 받은 사람)
   * @param requesterUserId 요청을 보낸 사용자 ID
   * @returns 업데이트된 관계 데이터
   * @throws ApiException
   *   - NOT_FOUND: 해당 관계를 찾을 수 없음
   *   - BAD_REQUEST: 이미 처리된 요청이거나 거절할 수 없는 상태
   */
  async rejectFriendRequest(
    userId: string,
    requesterUserId: string
  ): Promise<ArcyouChatRelation> {
    return await this.database.transaction(async (tx) => {
      // DB에서는 userId가 요청자, targetUserId가 받은 사람
      const [existing] = await tx
        .select()
        .from(arcyouChatRelations)
        .where(
          and(
            eq(arcyouChatRelations.userId, requesterUserId),
            eq(arcyouChatRelations.targetUserId, userId)
          )
        )
        .limit(1);

      if (!existing) {
        throwApi('NOT_FOUND', '해당 친구 요청을 찾을 수 없습니다.', {
          requesterUserId,
          userId,
        });
      }

      if (existing.status !== 'pending') {
        throwApi(
          'BAD_REQUEST',
          existing.status === 'accepted'
            ? '이미 수락된 요청입니다.'
            : existing.status === 'rejected'
              ? '이미 거절된 요청입니다.'
              : '거절할 수 없는 상태의 요청입니다.',
          {
            currentStatus: existing.status,
          }
        );
      }

      const [updated] = await tx
        .update(arcyouChatRelations)
        .set({
          status: 'rejected',
          respondedAt: new Date(),
        })
        .where(
          and(
            eq(arcyouChatRelations.userId, requesterUserId),
            eq(arcyouChatRelations.targetUserId, userId)
          )
        )
        .returning();

      if (!updated) {
        throwApi('INTERNAL', '친구 요청 거절에 실패했습니다.');
      }

      return updated;
    });
  }

  /**
   * 친구 관계를 삭제합니다.
   * 양방향 관계를 모두 삭제합니다 (userId -> targetUserId 또는 targetUserId -> userId).
   * @param userId 현재 사용자 ID
   * @param friendUserId 친구 사용자 ID
   * @returns 삭제된 관계 수
   * @throws ApiException
   *   - NOT_FOUND: 해당 친구 관계를 찾을 수 없음
   */
  async deleteFriendRelation(
    userId: string,
    friendUserId: string
  ): Promise<number> {
    return await this.database.transaction(async (tx) => {
      // 양방향 관계 확인
      const existingRelations = await tx
        .select()
        .from(arcyouChatRelations)
        .where(
          or(
            // userId -> friendUserId
            and(
              eq(arcyouChatRelations.userId, userId),
              eq(arcyouChatRelations.targetUserId, friendUserId)
            ),
            // friendUserId -> userId (역방향)
            and(
              eq(arcyouChatRelations.userId, friendUserId),
              eq(arcyouChatRelations.targetUserId, userId)
            )
          )
        );

      if (existingRelations.length === 0) {
        throwApi('NOT_FOUND', '해당 친구 관계를 찾을 수 없습니다.', {
          userId,
          friendUserId,
        });
      }

      // 양방향 관계 모두 삭제
      const deleted1 = await tx
        .delete(arcyouChatRelations)
        .where(
          and(
            eq(arcyouChatRelations.userId, userId),
            eq(arcyouChatRelations.targetUserId, friendUserId)
          )
        );

      const deleted2 = await tx
        .delete(arcyouChatRelations)
        .where(
          and(
            eq(arcyouChatRelations.userId, friendUserId),
            eq(arcyouChatRelations.targetUserId, userId)
          )
        );

      return (deleted1.rowCount || 0) + (deleted2.rowCount || 0);
    });
  }

  /**
   * 친구 요청을 취소합니다.
   * 현재 사용자가 보낸 pending 상태의 요청을 삭제합니다.
   * @param userId 현재 사용자 ID (요청을 보낸 사람)
   * @param targetUserId 대상 사용자 ID
   * @returns 삭제된 관계 데이터
   * @throws ApiException
   *   - NOT_FOUND: 해당 친구 요청을 찾을 수 없음
   *   - BAD_REQUEST: 이미 처리된 요청이거나 취소할 수 없는 상태
   */
  async cancelFriendRequest(
    userId: string,
    targetUserId: string
  ): Promise<ArcyouChatRelation> {
    return await this.database.transaction(async (tx) => {
      // userId가 요청자이고 targetUserId가 대상인 관계 확인
      const [existing] = await tx
        .select()
        .from(arcyouChatRelations)
        .where(
          and(
            eq(arcyouChatRelations.userId, userId),
            eq(arcyouChatRelations.targetUserId, targetUserId)
          )
        )
        .limit(1);

      if (!existing) {
        throwApi('NOT_FOUND', '해당 친구 요청을 찾을 수 없습니다.', {
          userId,
          targetUserId,
        });
      }

      if (existing.status !== 'pending') {
        throwApi(
          'BAD_REQUEST',
          existing.status === 'accepted'
            ? '이미 수락된 요청입니다.'
            : existing.status === 'rejected'
              ? '이미 거절된 요청입니다.'
              : '취소할 수 없는 상태의 요청입니다.',
          {
            currentStatus: existing.status,
          }
        );
      }

      const [deleted] = await tx
        .delete(arcyouChatRelations)
        .where(
          and(
            eq(arcyouChatRelations.userId, userId),
            eq(arcyouChatRelations.targetUserId, targetUserId)
          )
        )
        .returning();

      if (!deleted) {
        throwApi('INTERNAL', '친구 요청 취소에 실패했습니다.');
      }

      return deleted;
    });
  }
}


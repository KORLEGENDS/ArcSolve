import { throwApi } from '@/server/api/errors';
import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import { arcyouChatMembers, arcyouChatRooms, outbox, users } from '@/share/schema/drizzles';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ArcyouChatRelationRepository } from './arcyou-chat-relation-repository';
import type { DB } from './base-repository';

export type ArcyouChatRoomWithMemberInfo = {
  id: string;
  name: string;
  description: string | null;
  type: 'direct' | 'group';
  lastMessageId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  role: 'owner' | 'manager' | 'participant';
  lastReadMessageId: string | null;
};

export type ArcyouChatRoomMemberWithUser = {
  userId: string;
  role: 'owner' | 'manager' | 'participant';
  lastReadMessageId: string | null;
  name: string;
  email: string;
  imageUrl: string | null;
};

export type CreateChatRoomInput = {
  type: 'direct' | 'group';
  name: string;
  description?: string | null;
  targetUserId?: string; // direct 타입일 때 필수
  memberIds?: string[]; // group 타입일 때 필수 (최소 1명)
};

export class ArcyouChatRoomRepository {
  private readonly relationRepository: ArcyouChatRelationRepository;

  constructor(private readonly database: DB = defaultDb) {
    this.relationRepository = new ArcyouChatRelationRepository(database);
  }

  /**
   * 사용자가 멤버인 채팅방 목록을 조회합니다.
   * @param userId 사용자 ID
   * @param type 채팅방 타입 필터 (선택사항)
   * @returns 채팅방 목록 (최신 업데이트 순)
   */
  async listByUserId(
    userId: string,
    type?: 'direct' | 'group'
  ): Promise<ArcyouChatRoomWithMemberInfo[]> {
    const rooms = await this.database
      .select({
        id: arcyouChatRooms.id,
        name: arcyouChatRooms.name,
        description: arcyouChatRooms.description,
        type: arcyouChatRooms.type,
        lastMessageId: arcyouChatRooms.lastMessageId,
        createdAt: arcyouChatRooms.createdAt,
        updatedAt: arcyouChatRooms.updatedAt,
        role: arcyouChatMembers.role,
        lastReadMessageId: arcyouChatMembers.lastReadMessageId,
      })
      .from(arcyouChatMembers)
      .innerJoin(arcyouChatRooms, eq(arcyouChatMembers.roomId, arcyouChatRooms.id))
      .where(
        and(
          eq(arcyouChatMembers.userId, userId),
          isNull(arcyouChatMembers.deletedAt),
          type ? eq(arcyouChatRooms.type, type) : undefined
        )
      )
      .orderBy(desc(sql`COALESCE(${arcyouChatRooms.updatedAt}, ${arcyouChatRooms.createdAt})`));

    return rooms;
  }

  /**
   * 두 사용자가 이미 참여 중인 direct 채팅방을 조회합니다.
   * @returns 존재하면 채팅방 정보, 없으면 null
   */
  async findDirectRoomBetweenUsers(
    userId: string,
    targetUserId: string
  ): Promise<ArcyouChatRoomWithMemberInfo | null> {
    const targetMember = alias(arcyouChatMembers, 'target_member');

    const [room] = await this.database
      .select({
        id: arcyouChatRooms.id,
        name: arcyouChatRooms.name,
        description: arcyouChatRooms.description,
        type: arcyouChatRooms.type,
        lastMessageId: arcyouChatRooms.lastMessageId,
        createdAt: arcyouChatRooms.createdAt,
        updatedAt: arcyouChatRooms.updatedAt,
        role: arcyouChatMembers.role,
        lastReadMessageId: arcyouChatMembers.lastReadMessageId,
      })
      .from(arcyouChatMembers)
      .innerJoin(arcyouChatRooms, eq(arcyouChatMembers.roomId, arcyouChatRooms.id))
      .innerJoin(
        targetMember,
        and(
          eq(targetMember.roomId, arcyouChatMembers.roomId),
          eq(targetMember.userId, targetUserId),
          isNull(targetMember.deletedAt)
        )
      )
      .where(
        and(
          eq(arcyouChatMembers.userId, userId),
          isNull(arcyouChatMembers.deletedAt),
          eq(arcyouChatRooms.type, 'direct')
        )
      )
      .limit(1);

    return room ?? null;
  }

  /**
   * 새로운 채팅방을 생성하고 멤버를 추가합니다.
   * @param input 채팅방 생성 정보
   * @param creatorId 생성자 사용자 ID
   * @returns 생성된 채팅방 정보 (멤버 정보 포함)
   * @throws ApiException
   *   - BAD_REQUEST: direct 타입일 때 targetUserId가 없거나, group 타입일 때 memberIds가 없거나 비어있음
   *   - BAD_REQUEST: 친구 관계가 아닌 사용자 포함
   */
  async create(input: CreateChatRoomInput, creatorId: string): Promise<ArcyouChatRoomWithMemberInfo> {
    return await this.database.transaction(async (tx) => {
      // direct 타입 검증
      if (input.type === 'direct') {
        if (!input.targetUserId) {
          throwApi('BAD_REQUEST', 'direct 타입 채팅방은 targetUserId가 필수입니다.');
        }
        if (input.targetUserId === creatorId) {
          throwApi('BAD_REQUEST', '자기 자신과의 1:1 채팅방을 생성할 수 없습니다.');
        }
        // 친구 관계 확인
        const relations = await this.relationRepository.listByUserId(creatorId);
        const isFriend = relations.some(
          (rel) => rel.status === 'accepted' && rel.targetUser.id === input.targetUserId
        );
        if (!isFriend) {
          throwApi('BAD_REQUEST', '친구 관계가 아닌 사용자와는 1:1 채팅방을 생성할 수 없습니다.');
        }
      }

      // group 타입 검증
      if (input.type === 'group') {
        if (!input.memberIds || input.memberIds.length === 0) {
          throwApi('BAD_REQUEST', 'group 타입 채팅방은 최소 1명의 멤버가 필요합니다.');
        }
        // 모든 멤버가 친구인지 확인
        const relations = await this.relationRepository.listByUserId(creatorId);
        const friendIds = new Set(
          relations.filter((rel) => rel.status === 'accepted').map((rel) => rel.targetUser.id)
        );
        for (const memberId of input.memberIds) {
          if (memberId === creatorId) {
            throwApi('BAD_REQUEST', '자기 자신을 멤버로 추가할 수 없습니다.');
          }
          if (!friendIds.has(memberId)) {
            throwApi('BAD_REQUEST', `친구 관계가 아닌 사용자를 멤버로 추가할 수 없습니다.`);
          }
        }
      }

      // 채팅방 생성
      const [room] = await tx
        .insert(arcyouChatRooms)
        .values({
          type: input.type,
          name: input.name,
          description: input.description ?? null,
        })
        .returning();

      if (!room) {
        throw new Error('채팅방 생성에 실패했습니다.');
      }

      // 멤버 추가
      const memberIdsToAdd: string[] = [];
      if (input.type === 'direct') {
        // direct: 생성자 + 대상 사용자
        memberIdsToAdd.push(creatorId, input.targetUserId!);
      } else {
        // group: 생성자 + 멤버들
        memberIdsToAdd.push(creatorId, ...input.memberIds!);
      }

      await tx.insert(arcyouChatMembers).values(
        memberIdsToAdd.map((userId) => ({
          roomId: room.id,
          userId,
          role: (userId === creatorId ? 'owner' : 'participant') as 'owner' | 'participant',
        }))
      );

      // 생성된 채팅방 정보 반환 (멤버 정보 포함)
      const [member] = await tx
        .select({
          id: arcyouChatRooms.id,
          name: arcyouChatRooms.name,
          description: arcyouChatRooms.description,
          type: arcyouChatRooms.type,
          lastMessageId: arcyouChatRooms.lastMessageId,
          createdAt: arcyouChatRooms.createdAt,
          updatedAt: arcyouChatRooms.updatedAt,
          role: arcyouChatMembers.role,
          lastReadMessageId: arcyouChatMembers.lastReadMessageId,
        })
        .from(arcyouChatMembers)
        .innerJoin(arcyouChatRooms, eq(arcyouChatMembers.roomId, arcyouChatRooms.id))
        .where(
          and(
            eq(arcyouChatMembers.roomId, room.id),
            eq(arcyouChatMembers.userId, creatorId)
          )
        )
        .limit(1);

      if (!member) {
        throw new Error('채팅방 멤버 정보 조회에 실패했습니다.');
      }

      // Outbox에 room.created 이벤트 적재 (WS를 통해 방 목록에 새 방 추가)
      try {
        await tx.insert(outbox).values({
          type: 'room.created',
          roomId: room.id,
          payload: {
            op: 'rooms',
            event: 'room.created',
            type: 'room.created',
            roomId: room.id,
            room: {
              id: room.id,
              name: room.name,
              description: room.description,
              type: room.type,
              lastMessageId: room.lastMessageId ?? null,
              createdAt: room.createdAt?.toISOString() ?? new Date().toISOString(),
              updatedAt: room.updatedAt?.toISOString() ?? null,
            },
            // 방 멤버 userId 목록 (room-created 브로드캐스트 대상)
            recipients: memberIdsToAdd,
          },
          status: 'pending',
          attempts: 0,
          nextAttemptAt: new Date(),
        });
      } catch {
        // Outbox 적재 실패는 채팅방 생성 자체를 막지 않는다.
        // 필요시 로깅/모니터링 연동 가능.
      }

      return member;
    });
  }

  /**
   * 채팅방 멤버 목록을 조회합니다.
   *
   * - 요청 사용자가 해당 채팅방의 멤버가 아닌 경우 FORBIDDEN 에러를 발생시킵니다.
   * - 각 멤버에 대한 기본 프로필 정보와 읽음 위치(lastReadMessageId)를 함께 반환합니다.
   */
  async listMembersByRoomId(
    roomId: string,
    requesterUserId: string
  ): Promise<ArcyouChatRoomMemberWithUser[]> {
    // 요청 사용자가 해당 방의 멤버인지 검증
    const [membership] = await this.database
      .select({
        userId: arcyouChatMembers.userId,
      })
      .from(arcyouChatMembers)
      .where(
        and(
          eq(arcyouChatMembers.roomId, roomId),
          eq(arcyouChatMembers.userId, requesterUserId),
          isNull(arcyouChatMembers.deletedAt)
        )
      )
      .limit(1);

    if (!membership) {
      throwApi('FORBIDDEN', '채팅방 멤버가 아닙니다.');
    }

    const members = await this.database
      .select({
        userId: arcyouChatMembers.userId,
        role: arcyouChatMembers.role,
        lastReadMessageId: arcyouChatMembers.lastReadMessageId,
        name: users.name,
        email: users.email,
        imageUrl: users.imageUrl,
      })
      .from(arcyouChatMembers)
      .innerJoin(users, eq(arcyouChatMembers.userId, users.id))
      .where(
        and(
          eq(arcyouChatMembers.roomId, roomId),
          isNull(arcyouChatMembers.deletedAt)
        )
      )
      .orderBy(arcyouChatMembers.createdAt);

    return members;
  }

  /**
   * 채팅방 이름을 수정합니다.
   *
   * - 호출자는 해당 채팅방의 멤버여야 합니다.
   * - 이름은 1~255자의 문자열이어야 합니다.
   *
   * @param roomId 채팅방 ID
   * @param userId 요청 사용자 ID
   * @param name 변경할 채팅방 이름
   */
  async updateName(
    roomId: string,
    userId: string,
    name: string
  ): Promise<ArcyouChatRoomWithMemberInfo> {
    const trimmed = name.trim();

    if (!trimmed) {
      throwApi('BAD_REQUEST', '채팅방 이름은 비어 있을 수 없습니다.');
    }
    if (trimmed.length > 255) {
      throwApi('BAD_REQUEST', '채팅방 이름은 255자 이하여야 합니다.');
    }

    return await this.database.transaction(async (tx) => {
      // 멤버십 검증 (삭제되지 않은 멤버여야 함)
      const [membership] = await tx
        .select({
          role: arcyouChatMembers.role,
        })
        .from(arcyouChatMembers)
        .where(
          and(
            eq(arcyouChatMembers.roomId, roomId),
            eq(arcyouChatMembers.userId, userId),
            isNull(arcyouChatMembers.deletedAt)
          )
        )
        .limit(1);

      if (!membership) {
        throwApi('FORBIDDEN', '채팅방 멤버가 아닙니다.');
      }

      // 이름 및 updatedAt 갱신
      const [room] = await tx
        .update(arcyouChatRooms)
        .set({
          name: trimmed,
          // updatedAt은 trigger가 없으므로 여기서 직접 now()로 갱신
          updatedAt: sql`now()`,
        })
        .where(eq(arcyouChatRooms.id, roomId))
        .returning();

      if (!room) {
        throwApi('NOT_FOUND', '채팅방을 찾을 수 없습니다.');
      }

      // 호출자 기준 멤버 정보와 함께 반환 (listByUserId와 동일한 셀렉터)
      const [result] = await tx
        .select({
          id: arcyouChatRooms.id,
          name: arcyouChatRooms.name,
          description: arcyouChatRooms.description,
          type: arcyouChatRooms.type,
          lastMessageId: arcyouChatRooms.lastMessageId,
          createdAt: arcyouChatRooms.createdAt,
          updatedAt: arcyouChatRooms.updatedAt,
          role: arcyouChatMembers.role,
          lastReadMessageId: arcyouChatMembers.lastReadMessageId,
        })
        .from(arcyouChatMembers)
        .innerJoin(arcyouChatRooms, eq(arcyouChatMembers.roomId, arcyouChatRooms.id))
        .where(
          and(
            eq(arcyouChatMembers.roomId, roomId),
            eq(arcyouChatMembers.userId, userId),
            isNull(arcyouChatMembers.deletedAt)
          )
        )
        .limit(1);

      if (!result) {
        throw new Error('채팅방 멤버 정보 조회에 실패했습니다.');
      }

      // 이름 변경 이벤트를 Outbox에 적재하여 다른 클라이언트의 목록/탭도 실시간으로 동기화
      try {
        // 현재 방의 모든 멤버 조회 (room.updated recipients용)
        const members = await tx
          .select({ userId: arcyouChatMembers.userId })
          .from(arcyouChatMembers)
          .where(
            and(
              eq(arcyouChatMembers.roomId, roomId),
              isNull(arcyouChatMembers.deletedAt)
            )
          );

        const recipients = members.map((m) => m.userId);

        if (recipients.length > 0) {
          await tx.insert(outbox).values({
            type: 'room.updated',
            roomId,
            payload: {
              op: 'rooms',
              event: 'room.updated',
              type: 'room.updated',
              roomId,
              room: {
                id: result.id,
                name: result.name,
                description: result.description,
                type: result.type,
                lastMessageId: result.lastMessageId ?? null,
                createdAt: result.createdAt?.toISOString() ?? new Date().toISOString(),
                updatedAt: result.updatedAt?.toISOString() ?? null,
              },
              recipients,
            },
            status: 'pending',
            attempts: 0,
            nextAttemptAt: new Date(),
          });
        }
      } catch {
        // Outbox 적재 실패는 이름 변경 자체를 막지 않는다.
        // 필요시 로깅/모니터링 연동 가능.
      }

      return result;
    });
  }
}


import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import { throwApi } from '@/share/api/server/errors';
import { arcyouChatMembers, arcyouChatRooms } from '@/share/schema/drizzles';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { ArcyouChatRelationRepository } from './arcyou-chat-relation-repository';
import type { DB } from './base-repository';

export type ArcyouChatRoomWithMemberInfo = {
  id: string;
  name: string;
  description: string | null;
  type: 'direct' | 'group';
  lastMessageId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  role: 'owner' | 'manager' | 'participant';
  lastReadMessageId: number | null;
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

      return member;
    });
  }
}


import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import { userChatMembers, userChatRooms } from '@/share/schema/drizzles';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { DB } from './base-repository';

export type UserChatRoomWithMemberInfo = {
  id: string;
  name: string;
  description: string | null;
  lastMessageId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  role: 'owner' | 'manager' | 'participant';
  lastReadMessageId: number | null;
};

export type CreateChatRoomInput = {
  name: string;
  description?: string | null;
};

export class UserChatRoomRepository {
  constructor(private readonly database: DB = defaultDb) {}

  /**
   * 사용자가 멤버인 채팅방 목록을 조회합니다.
   * @param userId 사용자 ID
   * @returns 채팅방 목록 (최신 업데이트 순)
   */
  async listByUserId(userId: string): Promise<UserChatRoomWithMemberInfo[]> {
    const rooms = await this.database
      .select({
        id: userChatRooms.id,
        name: userChatRooms.name,
        description: userChatRooms.description,
        lastMessageId: userChatRooms.lastMessageId,
        createdAt: userChatRooms.createdAt,
        updatedAt: userChatRooms.updatedAt,
        role: userChatMembers.role,
        lastReadMessageId: userChatMembers.lastReadMessageId,
      })
      .from(userChatMembers)
      .innerJoin(userChatRooms, eq(userChatMembers.roomId, userChatRooms.id))
      .where(
        and(
          eq(userChatMembers.userId, userId),
          isNull(userChatMembers.deletedAt)
        )
      )
      .orderBy(desc(sql`COALESCE(${userChatRooms.updatedAt}, ${userChatRooms.createdAt})`));

    return rooms;
  }

  /**
   * 새로운 채팅방을 생성하고 생성자를 owner로 추가합니다.
   * @param input 채팅방 생성 정보
   * @param creatorId 생성자 사용자 ID
   * @returns 생성된 채팅방 정보 (멤버 정보 포함)
   */
  async create(input: CreateChatRoomInput, creatorId: string): Promise<UserChatRoomWithMemberInfo> {
    return await this.database.transaction(async (tx) => {
      // 채팅방 생성
      const [room] = await tx
        .insert(userChatRooms)
        .values({
          name: input.name,
          description: input.description ?? null,
        })
        .returning();

      if (!room) {
        throw new Error('채팅방 생성에 실패했습니다.');
      }

      // 생성자를 owner로 추가
      await tx.insert(userChatMembers).values({
        roomId: room.id,
        userId: creatorId,
        role: 'owner',
      });

      // 생성된 채팅방 정보 반환 (멤버 정보 포함)
      const [member] = await tx
        .select({
          id: userChatRooms.id,
          name: userChatRooms.name,
          description: userChatRooms.description,
          lastMessageId: userChatRooms.lastMessageId,
          createdAt: userChatRooms.createdAt,
          updatedAt: userChatRooms.updatedAt,
          role: userChatMembers.role,
          lastReadMessageId: userChatMembers.lastReadMessageId,
        })
        .from(userChatMembers)
        .innerJoin(userChatRooms, eq(userChatMembers.roomId, userChatRooms.id))
        .where(
          and(
            eq(userChatMembers.roomId, room.id),
            eq(userChatMembers.userId, creatorId)
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


import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import { arcyouChatMembers, arcyouChatRooms } from '@/share/schema/drizzles';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { DB } from './base-repository';

export type ArcyouChatRoomWithMemberInfo = {
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

export class ArcyouChatRoomRepository {
  constructor(private readonly database: DB = defaultDb) {}

  /**
   * 사용자가 멤버인 채팅방 목록을 조회합니다.
   * @param userId 사용자 ID
   * @returns 채팅방 목록 (최신 업데이트 순)
   */
  async listByUserId(userId: string): Promise<ArcyouChatRoomWithMemberInfo[]> {
    const rooms = await this.database
      .select({
        id: arcyouChatRooms.id,
        name: arcyouChatRooms.name,
        description: arcyouChatRooms.description,
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
          isNull(arcyouChatMembers.deletedAt)
        )
      )
      .orderBy(desc(sql`COALESCE(${arcyouChatRooms.updatedAt}, ${arcyouChatRooms.createdAt})`));

    return rooms;
  }

  /**
   * 새로운 채팅방을 생성하고 생성자를 owner로 추가합니다.
   * @param input 채팅방 생성 정보
   * @param creatorId 생성자 사용자 ID
   * @returns 생성된 채팅방 정보 (멤버 정보 포함)
   */
  async create(input: CreateChatRoomInput, creatorId: string): Promise<ArcyouChatRoomWithMemberInfo> {
    return await this.database.transaction(async (tx) => {
      // 채팅방 생성
      const [room] = await tx
        .insert(arcyouChatRooms)
        .values({
          name: input.name,
          description: input.description ?? null,
        })
        .returning();

      if (!room) {
        throw new Error('채팅방 생성에 실패했습니다.');
      }

      // 생성자를 owner로 추가
      await tx.insert(arcyouChatMembers).values({
        roomId: room.id,
        userId: creatorId,
        role: 'owner',
      });

      // 생성된 채팅방 정보 반환 (멤버 정보 포함)
      const [member] = await tx
        .select({
          id: arcyouChatRooms.id,
          name: arcyouChatRooms.name,
          description: arcyouChatRooms.description,
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


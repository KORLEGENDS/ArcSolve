import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import {
    arcyouChatMembers,
    arcyouChatMessages,
} from '@/share/schema/drizzles';
import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import type { DB } from './base-repository';

export type ArcyouChatMessageItem = {
  id: string;
  roomId: string;
  userId: string;
  content: unknown;
  createdAt: Date | null;
};

export class ArcyouChatMessageRepository {
  constructor(private readonly database: DB = defaultDb) {}

  /**
   * 권한 검증: 사용자가 해당 room의 멤버인지 확인
   */
  private async assertMember(userId: string, roomId: string): Promise<void> {
    const rows = await this.database
      .select({ userId: arcyouChatMembers.userId })
      .from(arcyouChatMembers)
      .where(
        and(
          eq(arcyouChatMembers.roomId, roomId),
          eq(arcyouChatMembers.userId, userId),
          isNull(arcyouChatMembers.deletedAt),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      const err = new Error('Forbidden: not a member');
      (err as any).code = 'FORBIDDEN';
      throw err;
    }
  }

  /**
   * room 별 메시지 히스토리 조회 (커서: beforeCreatedAt)
   * 결과는 createdAt DESC(최신 우선)로 반환합니다.
   */
  async listByRoomId(
    userId: string,
    roomId: string,
    options?: { beforeCreatedAt?: Date | string; limit?: number },
  ): Promise<ArcyouChatMessageItem[]> {
    await this.assertMember(userId, roomId);

    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);

    const beforeDate = options?.beforeCreatedAt
      ? typeof options.beforeCreatedAt === 'string'
        ? new Date(options.beforeCreatedAt)
        : options.beforeCreatedAt
      : undefined;

    const where = and(
      eq(arcyouChatMessages.roomId, roomId),
      isNull(arcyouChatMessages.deletedAt),
      beforeDate ? lt(arcyouChatMessages.createdAt, beforeDate) : undefined,
    );

    const rows = await this.database
      .select({
        id: arcyouChatMessages.id,
        roomId: arcyouChatMessages.roomId,
        userId: arcyouChatMessages.userId,
        content: arcyouChatMessages.content,
        createdAt: arcyouChatMessages.createdAt,
      })
      .from(arcyouChatMessages)
      .where(where)
      .orderBy(desc(arcyouChatMessages.createdAt))
      .limit(limit);

    return rows;
  }
}



import { db as defaultDb } from '@/server/database/postgresql/client-postgresql';
import { buildAndConditions, buildSearchConditions, buildSortConditions, calculatePaginationMeta, getPaginationOptions, normalizeCount } from '@/server/database/postgresql/helpers-postgresql';
import { type User, users } from '@/share/schema/drizzles/user-drizzle';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { DB, PageParams, PageResult } from './base-repository';

export class UserRepository {
  constructor(private readonly database: DB = defaultDb) {}

  async getById(id: string) {
    const rows = await this.database
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
    return rows[0] ?? null;
  }

  async getByEmail(email: string) {
    const rows = await this.database
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)));
    return rows[0] ?? null;
  }

  async list(
    params: PageParams & {
      search?: string; // email/name 검색
      sortBy?: 'createdAt' | 'updatedAt' | 'email' | 'name';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<PageResult<User>> {
    const { page = 1, limit = 20 } = params;
    const { offset } = getPaginationOptions(page, limit);

    const conditions = buildAndConditions([
      isNull(users.deletedAt),
      params.search ? buildSearchConditions(params.search, [users.email, users.name]) : undefined,
    ]);

    const totalRows = await this.database
      .select({ count: sql<string>`count(*)` })
      .from(users)
      .where(conditions);
    const total = normalizeCount(totalRows[0]?.count ?? 0);

    const items = await this.database
      .select()
      .from(users)
      .where(conditions)
      .orderBy(buildSortConditions(users, params.sortBy ?? 'updatedAt', params.sortOrder ?? 'desc'))
      .limit(limit)
      .offset(offset);

    const meta = calculatePaginationMeta(total, page, limit);
    return { items, ...meta };
  }

  async create(user: User) {
    const inserted = await this.database.insert(users).values(user).returning();
    return inserted[0];
  }

  async update(id: string, patch: Partial<User>) {
    const updated = await this.database
      .update(users)
      .set({
        email: patch.email,
        name: patch.name,
        preferences: patch.preferences as any,
        imageUrl: (patch as any).imageUrl ?? undefined,
        updatedAt: sql`now()`,
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();
    return updated[0] ?? null;
  }

  async softDelete(id: string) {
    const deleted = await this.database
      .update(users)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();
    return deleted[0] ?? null;
  }


  /**
   * 사용자 정보와 함께 남은 사용량 계산하여 반환 (DB에서 직접 조회)
   */
  async getByIdWithLimits(id: string): Promise<User | null> {
    return await this.getById(id);
  }
}



// worker-utils.ts

import { drizzle } from 'drizzle-orm/node-postgres';

import { eq, sql } from 'drizzle-orm';

import Redis from 'ioredis';

import { Pool } from 'pg';

import type { PgTableWithColumns } from 'drizzle-orm/pg-core';

// ====== Types ======

export type OutboxRow = {
  id: number;

  type: string;

  roomId: string;

  payload: any;

  attempts: number;
};

// ====== Utils ======

export function nextBackoffMs(
  attempts: number,
  backoffBaseMs: number,
  backoffCapMs: number,
): number {
  // attempts: 0,1,2,... → 1s,2s,4s,... capped

  const exp = Math.min(
    backoffCapMs,
    backoffBaseMs * Math.pow(2, Math.max(0, attempts)),
  );

  return Math.floor(exp);
}

// ====== Transient error helpers ======

export function isTransientDbError(err: unknown): boolean {
  const anyErr = err as any;
  const code: string | undefined = anyErr?.code;
  const message = String(anyErr?.message ?? anyErr ?? '');
  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT')
    return true;
  if (
    message.includes('getaddrinfo') ||
    message.includes('ECONNRESET') ||
    message.includes('EAI_AGAIN')
  )
    return true;
  return false;
}

export async function claimBatch<T extends PgTableWithColumns<any>>(
  db: ReturnType<typeof drizzle>,
  outbox: T,
  maxBatch: number,
  lockSeconds: number,
  workerId: string,
): Promise<OutboxRow[]> {
  // 하나의 트랜잭션에서 pending & due를 잠금 후 in_progress로 마킹

  return await db.transaction(async (tx) => {
    // FOR UPDATE SKIP LOCKED 를 쓸 수 있게 raw
    // maxBatch를 명시적으로 integer로 캐스팅

    const rows = await tx.execute(
      sql<OutboxRow>`
        SELECT id, type, room_id, payload, attempts
        FROM outbox
        WHERE status = 'pending'
          AND next_attempt_at <= NOW()
        ORDER BY id ASC
        LIMIT ${sql.raw(String(maxBatch))}
        FOR UPDATE SKIP LOCKED
      `,
    );

    if (rows.rowCount === 0) return [];

    const claimed: OutboxRow[] = [];

    for (const r of rows.rows) {
      // in_progress + lock
      // lockSeconds를 명시적으로 integer로 캐스팅

      await tx
        .update(outbox)
        .set({
          status: 'in_progress',
          lockedBy: workerId,
          lockedUntil: sql`NOW() + INTERVAL '${sql.raw(String(lockSeconds))} seconds'`,
          error: null,
        })
        .where(eq(outbox.id, Number(r.id)));

      claimed.push({
        id: Number(r.id),
        type: String(r.type),
        roomId: String((r as any).room_id),
        payload: r.payload,
        attempts: Number(r.attempts ?? 0),
      });
    }

    return claimed;
  });
}

export async function publishOne(
  redis: Redis,
  row: OutboxRow,
  pubsubMode: 'global' | 'perconv',
): Promise<void> {
  const channel =
    pubsubMode === 'perconv' ? `conv:${row.roomId}` : 'chat:message';

  // payload는 게이트웨이가 그대로 팬아웃 가능한 형태여야 함

  const msg = JSON.stringify({
    ...row.payload,

    // 안전상 roomId가 payload 내에 없으면 보강

    roomId: row.payload?.roomId ?? row.roomId,
  });

  await redis.publish(channel, msg);
}

export async function markPublished<T extends PgTableWithColumns<any>>(
  db: ReturnType<typeof drizzle>,
  outbox: T,
  id: number,
) {
  await db
    .update(outbox)
    .set({
      status: 'published',
      publishedAt: sql`NOW()`,
      lockedBy: null,
      lockedUntil: null,
      error: null,
    })
    .where(eq(outbox.id, id));
}

export async function reschedule<T extends PgTableWithColumns<any>>(
  db: ReturnType<typeof drizzle>,
  outbox: T,
  id: number,
  attempts: number,
  err: unknown,
  maxAttempts: number,
  backoffBaseMs: number,
  backoffCapMs: number,
) {
  const nextMs = nextBackoffMs(attempts, backoffBaseMs, backoffCapMs);
  const nextSeconds = Math.max(1, Math.floor(nextMs / 1000));

  await db
    .update(outbox)
    .set({
      status: attempts + 1 >= maxAttempts ? 'dead' : 'pending',
      attempts: attempts + 1,
      nextAttemptAt: sql`NOW() + INTERVAL '${sql.raw(String(nextSeconds))} seconds'`,
      lockedBy: null,
      lockedUntil: null,
      error:
        attempts + 1 >= maxAttempts
          ? `dead after ${attempts + 1} attempts: ${String((err as any)?.message ?? err)}`
          : `retry ${attempts + 1}: ${String((err as any)?.message ?? err)}`,
    })
    .where(eq(outbox.id, id));
}

export async function reapExpiredLocks(pool: Pool): Promise<number> {
  try {
    const res = await pool.query(
      `
    UPDATE outbox
    SET status = 'pending',
        locked_by = NULL,
        locked_until = NULL
    WHERE status = 'in_progress'
      AND locked_until IS NOT NULL
      AND locked_until <= NOW()
    RETURNING id
  `,
    );

    return res.rowCount || 0;
  } catch (e: any) {
    // DNS 해석 실패 등 네트워크 오류는 조용히 무시 (다음 루프에서 재시도)
    if (e?.code === 'ENOTFOUND' || e?.code === 'ECONNREFUSED') {
      return 0;
    }
    // 다른 오류는 로깅 후 무시
    console.warn(`[Outbox] reapExpiredLocks error:`, e?.message || e);
    return 0;
  }
}


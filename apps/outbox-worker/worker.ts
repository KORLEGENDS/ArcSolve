// outbox-worker.ts

import { drizzle } from 'drizzle-orm/node-postgres';

import {
  bigserial,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { eq, sql } from 'drizzle-orm';

import Redis from 'ioredis';

import { Pool } from 'pg';

import os from 'node:os';

import crypto from 'node:crypto';

// ====== ENV ======

const databaseUrl = process.env.DATABASE_URL;

const redisUrl = process.env.REDIS_URL;

const pubsubMode = (process.env.PUBSUB_MODE || 'global') as 'global' | 'perconv';

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 1000);

const MAX_BATCH = Number(process.env.BATCH_SIZE ?? 100);

const LOCK_SECONDS = Number(process.env.LOCK_SECONDS ?? 30);

const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS ?? 12);

const BACKOFF_BASE_MS = Number(process.env.BACKOFF_BASE_MS ?? 1000);

const BACKOFF_CAP_MS = Number(process.env.BACKOFF_CAP_MS ?? 60_000);

const WORKER_ID =
  process.env.WORKER_ID || `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;

if (!databaseUrl) throw new Error('DATABASE_URL is required');

if (!redisUrl) throw new Error('REDIS_URL is required');

// ====== SCHEMA (align with server) ======

const outboxStatusEnum = pgEnum('outbox_status', [
  'pending',
  'in_progress',
  'published',
  'dead',
]);

const outbox = pgTable('outbox', {
  id: bigserial('id', { mode: 'number' }).primaryKey().notNull(),

  type: text('type').notNull(),

  conversationId: uuid('conversation_id').notNull(),

  payload: jsonb('payload').notNull(),

  status: outboxStatusEnum('status').default('pending').notNull(),

  attempts: integer('attempts').default(0).notNull(),

  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),

  lockedBy: text('locked_by'),

  lockedUntil: timestamp('locked_until', { withTimezone: true }),

  publishedAt: timestamp('published_at', { withTimezone: true }),

  error: text('error'),

  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`).notNull(),

  // legacy columns retained for compatibility; ignored by the new logic

  // processed/processedAt/retryCount may exist in DB but are not used anymore

  // This prevents Drizzle from complaining if you still have them

  // Remove these once your migrations drop legacy columns.

  // @ts-ignore

  processed: boolean('processed'),

  // @ts-ignore

  processedAt: timestamp('processed_at', { withTimezone: true }),

  // @ts-ignore

  retryCount: integer('retry_count'),
});

type OutboxRow = {
  id: number;

  type: string;

  conversationId: string;

  payload: any;

  attempts: number;
};

// ====== PG / Drizzle ======

const pool = new Pool({
  connectionString: databaseUrl,

  max: 10,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000,
});

const db = drizzle(pool, { schema: { outbox } });

// ====== Redis ======

const redis = new Redis(redisUrl!, {
  maxRetriesPerRequest: 3,

  retryStrategy: (times) => Math.min(times * 50, 2000),
});

// ====== Utils ======

function nextBackoffMs(attempts: number): number {
  // attempts: 0,1,2,... → 1s,2s,4s,... capped

  const exp = Math.min(
    BACKOFF_CAP_MS,
    BACKOFF_BASE_MS * Math.pow(2, Math.max(0, attempts)),
  );

  return Math.floor(exp);
}

async function claimBatch(): Promise<OutboxRow[]> {
  // 하나의 트랜잭션에서 pending & due를 잠금 후 in_progress로 마킹

  return await db.transaction(async (tx) => {
    // FOR UPDATE SKIP LOCKED 를 쓸 수 있게 raw
    // MAX_BATCH를 명시적으로 integer로 캐스팅

    const rows = await tx.execute(
      sql<OutboxRow>`

        SELECT id, type, conversation_id, payload, attempts

        FROM outbox

        WHERE status = 'pending'

          AND next_attempt_at <= NOW()

        ORDER BY id ASC

        LIMIT ${sql.raw(String(MAX_BATCH))}

        FOR UPDATE SKIP LOCKED

      `,
    );

    if (rows.rowCount === 0) return [];

    const claimed: OutboxRow[] = [];

    for (const r of rows.rows) {
      // in_progress + lock
      // LOCK_SECONDS를 명시적으로 integer로 캐스팅

      await tx
        .update(outbox)

        .set({
          status: 'in_progress',

          lockedBy: WORKER_ID,

          lockedUntil: sql`NOW() + INTERVAL '${sql.raw(String(LOCK_SECONDS))} seconds'`,

          error: null,
        })

        .where(eq(outbox.id, Number(r.id)));

      claimed.push({
        id: Number(r.id),

        type: String(r.type),

        conversationId: String((r as any).conversation_id),

        payload: r.payload,

        attempts: Number(r.attempts ?? 0),
      });
    }

    return claimed;
  });
}

async function publishOne(row: OutboxRow): Promise<void> {
  const channel =
    pubsubMode === 'perconv' ? `conv:${row.conversationId}` : 'chat:message';

  // payload는 게이트웨이가 그대로 팬아웃 가능한 형태여야 함

  const msg = JSON.stringify({
    ...row.payload,

    // 안전상 conversationId가 payload 내에 없으면 보강

    conversationId: row.payload?.conversationId ?? row.conversationId,
  });

  await redis.publish(channel, msg);
}

async function markPublished(id: number) {
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

async function reschedule(id: number, attempts: number, err: unknown) {
  const nextMs = nextBackoffMs(attempts);
  const nextSeconds = Math.max(1, Math.floor(nextMs / 1000));

  await db
    .update(outbox)

    .set({
      status: attempts + 1 >= MAX_ATTEMPTS ? 'dead' : 'pending',

      attempts: attempts + 1,

      nextAttemptAt: sql`NOW() + INTERVAL '${sql.raw(String(nextSeconds))} seconds'`,

      lockedBy: null,

      lockedUntil: null,

      error:
        attempts + 1 >= MAX_ATTEMPTS
          ? `dead after ${attempts + 1} attempts: ${String((err as any)?.message ?? err)}`
          : `retry ${attempts + 1}: ${String((err as any)?.message ?? err)}`,
    })

    .where(eq(outbox.id, id));
}

async function reapExpiredLocks(): Promise<number> {
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
}

// ====== Main loop ======

let shuttingDown = false;

async function loopOnce(): Promise<void> {
  const expired = await reapExpiredLocks();

  if (expired > 0) console.warn(`[Outbox] reaped ${expired} expired locks`);

  const batch = await claimBatch();

  if (batch.length === 0) return;

  let ok = 0,
    fail = 0;

  for (const row of batch) {
    try {
      // 안전장치: conversationId가 없으면 dead

      if (!row.conversationId)
        throw new Error(`row ${row.id} has no conversationId`);

      await publishOne(row);

      await markPublished(row.id);

      ok++;
    } catch (e) {
      await reschedule(row.id, row.attempts, e);

      fail++;

      console.error(`[Outbox] publish failed id=${row.id}:`, e);
    }
  }

  if (ok) console.log(`[Outbox] published ${ok} / ${batch.length}`);

  if (fail)
    console.warn(`[Outbox] failed ${fail} / ${batch.length} (rescheduled/dead)`);
}

async function main() {
  console.log('[Outbox] starting...');

  console.log(`[Outbox] workerId=${WORKER_ID}`);

  console.log(`[Outbox] DB=${databaseUrl!.replace(/:[^:@]+@/, ':****@')}`);

  console.log(`[Outbox] Redis=${redisUrl!.replace(/:[^:@]+@/, ':****@')}`);

  console.log(
    `[Outbox] mode=${pubsubMode}, poll=${POLL_INTERVAL_MS}ms, batch=${MAX_BATCH}, maxAttempts=${MAX_ATTEMPTS}`,
  );

  // quick health check

  await pool.query('SELECT 1');

  await redis.ping();

  const interval = setInterval(async () => {
    if (shuttingDown) return;

    try {
      await loopOnce();
    } catch (e) {
      console.error('[Outbox] loop error:', e);
    }
  }, POLL_INTERVAL_MS);

  const shutdown = async () => {
    if (shuttingDown) return;

    shuttingDown = true;

    console.log('[Outbox] shutting down...');

    clearInterval(interval);

    try {
      await redis.quit();
    } catch {}

    try {
      await pool.end();
    } catch {}

    console.log('[Outbox] bye');

    process.exit(0);
  };

  process.on('SIGTERM', shutdown);

  process.on('SIGINT', shutdown);
}

process.on('unhandledRejection', (r) =>
  console.error('[Outbox] unhandledRejection:', r),
);

process.on('uncaughtException', (e) => {
  console.error('[Outbox] uncaughtException:', e);

  process.exit(1);
});

main().catch((e) => {
  console.error('[Outbox] fatal:', e);

  process.exit(1);
});

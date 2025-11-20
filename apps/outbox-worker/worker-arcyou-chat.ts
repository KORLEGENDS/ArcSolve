// ArcYou 채팅용 Outbox 워커
// - 기존 worker.ts의 로직을 그대로 옮겼습니다.
// - `type` 이 `document.` 로 시작하는 레코드는 처리하지 않습니다.

import { drizzle } from 'drizzle-orm/node-postgres';

import { bigserial, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { sql } from 'drizzle-orm';

import Redis from 'ioredis';

import { Pool } from 'pg';

import os from 'node:os';

import crypto from 'node:crypto';

import {
    claimBatch,
    isTransientDbError,
    markPublished,
    publishOne,
    reapExpiredLocks,
    reschedule,
} from './worker-utils';

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
  roomId: uuid('room_id').notNull(),
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
});

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

// ====== Main loop ======

let shuttingDown = false;

async function loopOnce(): Promise<void> {
  let expired = 0;
  try {
    expired = await reapExpiredLocks(pool);
  } catch (e) {
    if (isTransientDbError(e)) {
      console.warn(
        '[Outbox][ArcYouChat] transient reapExpiredLocks error (ignored):',
        (e as any)?.code ?? (e as any)?.message ?? e,
      );
    } else {
      throw e;
    }
  }

  if (expired > 0) console.warn(`[Outbox][ArcYouChat] reaped ${expired} expired locks`);

  const batch = await claimBatch(
    db,
    outbox,
    MAX_BATCH,
    LOCK_SECONDS,
    WORKER_ID,
    // 채팅 워커는 문서용 잡(`type`이 'document.'로 시작)을 건드리지 않습니다.
    {
      excludeTypePrefix: 'document.',
    },
  );

  if (batch.length === 0) return;

  let ok = 0,
    fail = 0;

  for (const row of batch) {
    try {
      // 안전장치: roomId가 없으면 dead
      if (!row.roomId)
        throw new Error(`row ${row.id} has no roomId`);

      await publishOne(redis, row, pubsubMode);
      await markPublished(db, outbox, row.id);
      ok++;
    } catch (e) {
      await reschedule(
        db,
        outbox,
        row.id,
        row.attempts,
        e,
        MAX_ATTEMPTS,
        BACKOFF_BASE_MS,
        BACKOFF_CAP_MS,
      );
      fail++;
      console.error(`[Outbox][ArcYouChat] publish failed id=${row.id}:`, e);
    }
  }

  if (ok) console.log(`[Outbox][ArcYouChat] published ${ok} / ${batch.length}`);

  if (fail)
    console.warn(
      `[Outbox][ArcYouChat] failed ${fail} / ${batch.length} (rescheduled/dead)`,
    );
}

async function main() {
  console.log('[Outbox][ArcYouChat] starting...');
  console.log(`[Outbox][ArcYouChat] workerId=${WORKER_ID}`);
  console.log(
    `[Outbox][ArcYouChat] DB=${databaseUrl!.replace(/:[^:@]+@/, ':****@')}`,
  );
  console.log(
    `[Outbox][ArcYouChat] Redis=${redisUrl!.replace(/:[^:@]+@/, ':****@')}`,
  );
  console.log(
    `[Outbox][ArcYouChat] mode=${pubsubMode}, poll=${POLL_INTERVAL_MS}ms, batch=${MAX_BATCH}, maxAttempts=${MAX_ATTEMPTS}`,
  );

  // quick health check with retry
  let dbReady = false;
  for (let i = 0; i < 10; i++) {
    try {
      await pool.query('SELECT 1');
      dbReady = true;
      break;
    } catch (e: any) {
      if (e?.code === 'ENOTFOUND' || e?.code === 'ECONNREFUSED') {
        console.log(
          `[Outbox][ArcYouChat] DB not ready yet, retrying... (${i + 1}/10)`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        throw e;
      }
    }
  }
  if (!dbReady) {
    throw new Error('Failed to connect to database after 10 retries');
  }

  await redis.ping();

  const interval = setInterval(async () => {
    if (shuttingDown) return;

    try {
      await loopOnce();
    } catch (e) {
      console.error('[Outbox][ArcYouChat] loop error:', e);
    }
  }, POLL_INTERVAL_MS);

  const shutdown = async () => {
    if (shuttingDown) return;

    shuttingDown = true;
    console.log('[Outbox][ArcYouChat] shutting down...');
    clearInterval(interval);

    try {
      await redis.quit();
    } catch {}

    try {
      await pool.end();
    } catch {}

    console.log('[Outbox][ArcYouChat] bye');
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

process.on('unhandledRejection', (r) =>
  console.error('[Outbox][ArcYouChat] unhandledRejection:', r),
);

process.on('uncaughtException', (e) => {
  console.error('[Outbox][ArcYouChat] uncaughtException:', e);
  process.exit(1);
});

// 기본 엔트리포인트
main().catch((e) => {
  console.error('[Outbox][ArcYouChat] fatal:', e);
  process.exit(1);
});



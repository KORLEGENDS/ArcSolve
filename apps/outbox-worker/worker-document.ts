// Document 전처리용 Outbox 워커
// - `type` 이 'document.' 로 시작하는 레코드만 처리합니다.
// - 업로드 완료 후, 사이드카(Document 전처리 서비스)에 파싱을 1회 요청합니다.
// - 재시도/백오프는 사용하지 않고, 실패 시 outbox 레코드는 dead 로, 문서 상태는 failed 로 표시합니다.

import { drizzle } from 'drizzle-orm/node-postgres';

import {
  bigserial,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { and, eq, sql } from 'drizzle-orm';

import { Pool } from 'pg';

import os from 'node:os';

import crypto from 'node:crypto';

import {
  claimBatch,
  isTransientDbError,
  markPublished,
  reapExpiredLocks,
} from './worker-utils';

// ====== ENV ======

const databaseUrl = process.env.DATABASE_URL;
const sidecarBaseUrl =
  process.env.DOCUMENT_SIDECAR_BASE_URL || process.env.SIDECAR_BASE_URL;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 1000);
const MAX_BATCH = Number(process.env.BATCH_SIZE ?? 50);
const LOCK_SECONDS = Number(process.env.LOCK_SECONDS ?? 60);
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS ?? 12);
const BACKOFF_BASE_MS = Number(process.env.BACKOFF_BASE_MS ?? 1000);
const BACKOFF_CAP_MS = Number(process.env.BACKOFF_CAP_MS ?? 60_000);
const WORKER_ID =
  process.env.WORKER_ID || `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;

if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (!sidecarBaseUrl) {
  throw new Error('DOCUMENT_SIDECAR_BASE_URL or SIDECAR_BASE_URL is required');
}

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

// document_processing_status & documents (processingStatus만 사용)
const documentProcessingStatusEnum = pgEnum('document_processing_status', [
  'pending',
  'processing',
  'processed',
  'failed',
]);

const documents = pgTable('document', {
  documentId: uuid('document_id').primaryKey().notNull(),
  userId: uuid('user_id').notNull(),
  processingStatus: documentProcessingStatusEnum('processing_status').notNull(),
});

// ====== PG / Drizzle ======

const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const db = drizzle(pool, { schema: { outbox, documents } });

// ====== Main loop ======

let shuttingDown = false;

async function loopOnce(): Promise<void> {
  let expired = 0;
  try {
    expired = await reapExpiredLocks(pool);
  } catch (e) {
    if (isTransientDbError(e)) {
      console.warn(
        '[Outbox][Document] transient reapExpiredLocks error (ignored):',
        (e as any)?.code ?? (e as any)?.message ?? e,
      );
    } else {
      throw e;
    }
  }

  if (expired > 0) console.warn(`[Outbox][Document] reaped ${expired} expired locks`);

  const batch = await claimBatch(
    db,
    outbox,
    MAX_BATCH,
    LOCK_SECONDS,
    WORKER_ID,
    {
      includeTypePrefix: 'document.',
    },
  );

  if (batch.length === 0) return;

  let ok = 0;
  let fail = 0;

  for (const row of batch) {
    try {
      const payload = (row.payload ?? {}) as {
        documentId?: string;
        userId?: string;
      };

      const documentId = String(payload.documentId ?? '');
      const userId = String(payload.userId ?? '');

      if (!documentId || !userId) {
        throw new Error(
          `Invalid payload for document job id=${row.id}: missing documentId/userId`,
        );
      }

      // 1) 문서를 processing 상태로 전환
      const [processingTarget] = await db
        .update(documents)
        .set({ processingStatus: 'processing' })
        .where(
          and(
            eq(documents.documentId, documentId),
            eq(documents.userId, userId),
          ),
        )
        .returning();

      if (!processingTarget) {
        throw new Error(
          `Document not found for processing: documentId=${documentId}, userId=${userId}`,
        );
      }

      // 2) 사이드카(Document 전처리 서버) 호출
      const base = sidecarBaseUrl!.replace(/\/+$/, '');
      const url = `${base}/internal/documents/${encodeURIComponent(
        documentId,
      )}/parse`;

      // 타임아웃 설정: 문서 파싱은 시간이 오래 걸릴 수 있으므로 10분으로 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10분

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId);
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `Sidecar returned ${res.status} ${res.statusText} ${text}`,
        );
      }

      // 3) 전처리 성공 → 문서를 processed 로 전환
      await db
        .update(documents)
        .set({ processingStatus: 'processed' })
        .where(
          and(
            eq(documents.documentId, documentId),
            eq(documents.userId, userId),
          ),
        );

      // 4) Outbox 레코드를 published 로 마킹
      await markPublished(db, outbox, row.id);
      ok++;
    } catch (e) {
      // 실패 시: 문서 상태를 failed 로 표시하고, 해당 outbox 레코드를 dead 로 전환합니다.
      try {
        const payload = (row.payload ?? {}) as {
          documentId?: string;
          userId?: string;
        };
        const documentId = payload.documentId
          ? String(payload.documentId)
          : undefined;
        const userId = payload.userId ? String(payload.userId) : undefined;

        if (documentId && userId) {
          await db
            .update(documents)
            .set({ processingStatus: 'failed' })
            .where(
              and(
                eq(documents.documentId, documentId),
                eq(documents.userId, userId),
              ),
            );
        }
      } catch (statusError) {
        console.error(
          `[Outbox][Document] failed to update processingStatus to 'failed' for job id=${row.id}:`,
          statusError,
        );
      }

      try {
        await db
          .update(outbox)
          .set({
            status: 'dead',
            lockedBy: null,
            lockedUntil: null,
            error: String(
              e instanceof Error ? e.message : (e as unknown as string),
            ),
          })
          .where(eq(outbox.id, row.id));
      } catch (outboxError) {
        console.error(
          `[Outbox][Document] failed to mark outbox row as dead id=${row.id}:`,
          outboxError,
        );
      }

      fail++;
      console.error(`[Outbox][Document] job failed id=${row.id}:`, e);
    }
  }

  if (ok) console.log(`[Outbox][Document] processed ${ok} / ${batch.length}`);
  if (fail) {
    console.warn(
      `[Outbox][Document] failed ${fail} / ${batch.length} (rescheduled/dead)`,
    );
  }
}

async function main() {
  console.log('[Outbox][Document] starting...');
  console.log(`[Outbox][Document] workerId=${WORKER_ID}`);
  console.log(
    `[Outbox][Document] DB=${databaseUrl!.replace(/:[^:@]+@/, ':****@')}`,
  );
  console.log(
    `[Outbox][Document] poll=${POLL_INTERVAL_MS}ms, batch=${MAX_BATCH}, maxAttempts=${MAX_ATTEMPTS}`,
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
          `[Outbox][Document] DB not ready yet, retrying... (${i + 1}/10)`,
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

  const interval = setInterval(async () => {
    if (shuttingDown) return;

    try {
      await loopOnce();
    } catch (e) {
      console.error('[Outbox][Document] loop error:', e);
    }
  }, POLL_INTERVAL_MS);

  const shutdown = async () => {
    if (shuttingDown) return;

    shuttingDown = true;
    console.log('[Outbox][Document] shutting down...');
    clearInterval(interval);

    try {
      await pool.end();
    } catch {}

    console.log('[Outbox][Document] bye');
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

process.on('unhandledRejection', (r) =>
  console.error('[Outbox][Document] unhandledRejection:', r),
);

process.on('uncaughtException', (e) => {
  console.error('[Outbox][Document] uncaughtException:', e);
  process.exit(1);
});

// 기본 엔트리포인트
main().catch((e) => {
  console.error('[Outbox][Document] fatal:', e);
  process.exit(1);
});



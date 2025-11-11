// server.ts

import { and, eq, gt, sql } from 'drizzle-orm';

import { drizzle } from 'drizzle-orm/node-postgres';

import {
  bigint,
  bigserial,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';

import { Redis, type RedisOptions } from 'ioredis';

import jwt from 'jsonwebtoken';

import http, { IncomingMessage, ServerResponse } from 'node:http';

import { Pool } from 'pg';

import { WebSocket, WebSocketServer } from 'ws';

import os from 'node:os';

// ====== ENV ======

const port = Number(process.env.PORT ?? 8080);

const redisUrl = process.env.REDIS_URL;

const jwtPublicKey = process.env.JWT_PUBLIC_KEY;

const jwtIssuer = process.env.JWT_ISSUER; // optional

const jwtAudience = process.env.JWT_AUDIENCE; // optional

const databaseUrl = process.env.DATABASE_URL;

const pubsubMode = (process.env.PUBSUB_MODE || 'global') as 'global' | 'perconv';

const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 64 * 1024); // 64KB

const MAX_MSGS_ON_JOIN = Number(process.env.MAX_MSGS_ON_JOIN ?? 500); // 보강 상한

const WS_SEND_HIGH_WATER = Number(process.env.WS_SEND_HIGH_WATER ?? 5_000_000); // 5MB

const RL_BUCKET_CAPACITY = Number(process.env.RL_BUCKET_CAPACITY ?? 30); // 30 ops

const RL_REFILL_MS = Number(process.env.RL_REFILL_MS ?? 10_000); // per 10s

if (!redisUrl) throw new Error('REDIS_URL is required');

if (!jwtPublicKey) throw new Error('JWT_PUBLIC_KEY is required');

if (!databaseUrl) throw new Error('DATABASE_URL is required');

// ====== SCHEMA ======

const userChatMemberRoleEnum = pgEnum('user_chat_member_role', [
  'owner',
  'manager',
  'participant',
]);

const userChatMessageTypeEnum = pgEnum('user_chat_message_type', [
  'text',
  'image',
  'file',
  'system',
]);

const userChatMessageStatusEnum = pgEnum('user_chat_message_status', [
  'sent',
  'delivered',
  'read',
  'deleted',
]);

const outboxStatusEnum = pgEnum('outbox_status', [
  'pending',
  'in_progress',
  'published',
  'dead',
]);

const userChatRooms = pgTable('user_chat_rooms', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  lastMessageId: bigint('last_message_id', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

const userChatMessages = pgTable('user_chat_messages', {
  id: bigserial('id', { mode: 'number' }).primaryKey().notNull(),

  roomId: uuid('room_id')
    .notNull()
    .references(() => userChatRooms.id, { onDelete: 'cascade' }),

  userId: uuid('user_id').notNull(),

  type: userChatMessageTypeEnum('type').default('text').notNull(),

  content: jsonb('content').notNull(),

  replyToMessageId: bigint('reply_to_message_id', { mode: 'number' }),

  status: userChatMessageStatusEnum('status').default('sent').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

  updatedAt: timestamp('updated_at', { withTimezone: true }),

  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

const userChatMembers = pgTable(
  'user_chat_members',

  {
    roomId: uuid('room_id')
      .notNull()
      .references(() => userChatRooms.id, { onDelete: 'cascade' }),

    userId: uuid('user_id').notNull(),

    role: userChatMemberRoleEnum('role').default('participant').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    lastReadMessageId: bigint('last_read_message_id', { mode: 'number' }),
  },

  (p) => [primaryKey({ columns: [p.roomId, p.userId] })],
);

const outbox = pgTable('outbox', {
  id: bigserial('id', { mode: 'number' }).primaryKey().notNull(),

  type: text('type').notNull(), // e.g., 'message.created'

  roomId: uuid('room_id').notNull(),

  payload: jsonb('payload').notNull(), // should include roomId & message

  status: outboxStatusEnum('status').default('pending').notNull(),

  attempts: integer('attempts').default(0).notNull(),

  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),

  lockedBy: text('locked_by'),

  lockedUntil: timestamp('locked_until', { withTimezone: true }),

  publishedAt: timestamp('published_at', { withTimezone: true }),

  error: text('error'),

  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
});

// ====== PG / Drizzle ======

const pool = new Pool({
  connectionString: databaseUrl,

  max: 20,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000,
});

const db = drizzle(pool, { schema: { userChatRooms, userChatMessages, userChatMembers, outbox } });

// ====== Redis ======

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: 3,

  retryStrategy: (times: number) => Math.min(times * 50, 2000),
};

const redis = new Redis(redisUrl!, redisOptions);

const subscriber = redis.duplicate();

// ====== HTTP / WS ======

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });

    res.end(JSON.stringify({ ok: true, hostname: os.hostname() }));

    return;
  }

  res.writeHead(200, { 'content-type': 'text/plain' });

  res.end('arcsolve-uws-gateway running\n');
});

const wss = new WebSocketServer({ server });

// ====== In-memory routing ======

type ClientInfo = {
  userId?: string;

  roomId?: string;

  authenticated?: boolean;

  // token bucket

  tokens: number;

  lastRefillAt: number;
};

const channelClients = new Map<string, Set<WebSocket>>(); // roomId -> sockets

const clients = new Map<WebSocket, ClientInfo>();

// ====== JWT ======

function verifyToken(token: string): { userId: string } | null {
  try {
    const clean = token.startsWith('Bearer ') ? token.slice(7) : token;

    // Dev placeholder: token가 UUID면 패스

    if (jwtPublicKey === 'dev-placeholder') {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      return uuidRegex.test(clean) ? { userId: clean } : null;
    }

    const verifyOpts: jwt.VerifyOptions = { algorithms: ['RS256'] };

    if (jwtIssuer) verifyOpts.issuer = jwtIssuer;

    if (jwtAudience) verifyOpts.audience = jwtAudience;

    const decoded = jwt.verify(clean, jwtPublicKey!, verifyOpts) as jwt.JwtPayload;

    const userId = (decoded.sub || decoded.userId || decoded.id) as string | undefined;

    if (!userId) return null;

    return { userId };
  } catch (e) {
    console.error('[JWT] verify failed:', e);

    return null;
  }
}

// ====== Helpers ======

function takeToken(ci: ClientInfo): boolean {
  const now = Date.now();

  if (now - ci.lastRefillAt >= RL_REFILL_MS) {
    ci.tokens = RL_BUCKET_CAPACITY;

    ci.lastRefillAt = now;
  }

  if (ci.tokens <= 0) return false;

  ci.tokens -= 1;

  return true;
}

function safeSend(ws: WebSocket, payload: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  if (ws.bufferedAmount > WS_SEND_HIGH_WATER) {
    console.warn('[WS] High water, closing slow client');

    ws.close(1009, 'Slow client buffer overflow');

    return;
  }

  try {
    ws.send(JSON.stringify(payload));
  } catch (e) {
    console.error('[WS] send error:', e);
  }
}

// 보강 전송: lastReadMessageId 이후 메시지 n개

async function backfillSince(
  roomId: string,

  userId: string,

  limit: number,
): Promise<
  Array<{
    id: number;

    userId: string;

    content: unknown;

    createdAt: Date | null;
  }>
> {
  // 멤버 레코드 확보

  const p = await db
    .select()

    .from(userChatMembers)

    .where(
      and(
        eq(userChatMembers.roomId, roomId),
        eq(userChatMembers.userId, userId),
        sql`${userChatMembers.deletedAt} IS NULL`,
      ),
    )

    .limit(1);

  const lastRead = p[0]?.lastReadMessageId ?? 0;

  const rows = await db
    .select({
      id: userChatMessages.id,

      userId: userChatMessages.userId,

      content: userChatMessages.content,

      createdAt: userChatMessages.createdAt,
    })

    .from(userChatMessages)

    .where(
      and(
        eq(userChatMessages.roomId, roomId),
        gt(userChatMessages.id, lastRead),
        sql`${userChatMessages.deletedAt} IS NULL`,
      ),
    )

    .orderBy(userChatMessages.id)

    .limit(limit);

  return rows;
}

// ====== WS lifecycle ======

wss.on('connection', (ws: WebSocket) => {
  clients.set(ws, {
    authenticated: false,
    tokens: RL_BUCKET_CAPACITY,
    lastRefillAt: Date.now(),
  });

  ws.on('close', () => {
    const ci = clients.get(ws);

    if (ci?.roomId) {
      const set = channelClients.get(ci.roomId);

      if (set) {
        set.delete(ws);

        if (set.size === 0) channelClients.delete(ci.roomId);
      }
    }

    clients.delete(ws);
  });

  ws.on('error', (err) => console.error('[WS] error:', err));

  ws.on('message', async (buf: Buffer) => {
    const ci = clients.get(ws);

    if (!ci) {
      ws.close(1008, 'Internal');

      return;
    }

    if (!takeToken(ci)) {
      safeSend(ws, { op: 'error', error: 'Rate limited' });

      return;
    }

    let msg: any;

    try {
      if (buf.length > MAX_BODY_BYTES) throw new Error('Frame too large');

      msg = JSON.parse(buf.toString());
    } catch (e) {
      safeSend(ws, { op: 'error', error: 'Invalid JSON or too large' });

      return;
    }

    // ---- AUTH ----

    if (msg.op === 'auth') {
      const token = msg.token;

      if (!token)
        return safeSend(ws, { op: 'auth', success: false, error: 'Token required' });

      const vr = verifyToken(token);

      if (!vr)
        return safeSend(ws, { op: 'auth', success: false, error: 'Unauthorized' });

      ci.userId = vr.userId;

      ci.authenticated = true;

      return safeSend(ws, { op: 'auth', success: true, userId: vr.userId });
    }

    if (!ci.authenticated || !ci.userId) {
      return safeSend(ws, {
        op: msg.op,
        success: false,
        error: 'Unauthorized: auth first',
      });
    }

    // ---- JOIN ----

    if (msg.op === 'join') {
      const roomId = msg.room_id || msg.roomId || msg.conversation_id || msg.conversationId;

      if (!roomId)
        return safeSend(ws, {
          op: 'join',
          success: false,
          error: 'room_id required',
        });

      // 멤버 검증

      const p = await db
        .select()

        .from(userChatMembers)

        .where(
          and(
            eq(userChatMembers.roomId, roomId),
            eq(userChatMembers.userId, ci.userId),
            sql`${userChatMembers.deletedAt} IS NULL`,
          ),
        )

        .limit(1);

      if (p.length === 0)
        return safeSend(ws, {
          op: 'join',
          success: false,
          error: 'Forbidden: not a member',
        });

      // 이전 채널 제거

      if (ci.roomId) {
        const old = channelClients.get(ci.roomId);

        if (old) {
          old.delete(ws);

          if (old.size === 0) channelClients.delete(ci.roomId);
        }
      }

      // 새 채널 등록

      ci.roomId = roomId;

      if (!channelClients.has(roomId))
        channelClients.set(roomId, new Set());

      channelClients.get(roomId)!.add(ws);

      // 합류 OK

      safeSend(ws, { op: 'join', success: true, room_id: roomId });

      // 보강 전송

      try {
        const missed = await backfillSince(roomId, ci.userId, MAX_MSGS_ON_JOIN);

        for (const m of missed) {
          safeSend(ws, {
            op: 'event',

            type: 'message.created',

            roomId,

            message: {
              id: m.id,

              user_id: m.userId,

              content: m.content,

              created_at: m.createdAt ? m.createdAt.toISOString() : undefined,
            },

            timestamp: new Date().toISOString(),

            source: 'backfill',
          });
        }
      } catch (e) {
        console.error('[JOIN backfill] failed:', e);
      }

      return;
    }

    // ---- SEND ----

    if (msg.op === 'send') {
      const roomId =
        msg.room_id || msg.roomId || msg.conversation_id || msg.conversationId || ci.roomId;

      const content = msg.content || msg.body;

      const tempId = msg.temp_id;

      if (!roomId)
        return safeSend(ws, {
          op: 'send',
          success: false,
          error: 'room_id required',
        });

      if (content == null)
        return safeSend(ws, { op: 'send', success: false, error: 'content required' });

      // 간단한 크기 제한

      const estBytes = Buffer.byteLength(JSON.stringify(content));

      if (estBytes > MAX_BODY_BYTES) {
        return safeSend(ws, { op: 'send', success: false, error: 'content too large' });
      }

      // 멤버 검증

      const isP = await db
        .select()

        .from(userChatMembers)

        .where(
          and(
            eq(userChatMembers.roomId, roomId),
            eq(userChatMembers.userId, ci.userId),
            sql`${userChatMembers.deletedAt} IS NULL`,
          ),
        )

        .limit(1);

      if (isP.length === 0)
        return safeSend(ws, {
          op: 'send',
          success: false,
          error: 'Forbidden: not a member',
        });

      // 트랜잭션: userChatMessages + outbox(pending)

      try {
        const result = await db.transaction(async (tx) => {
          const [m] = await tx
            .insert(userChatMessages)

            .values({ 
              roomId, 
              userId: ci.userId!, 
              type: 'text',
              content: content as any 
            })

            .returning();

          if (!m) throw new Error('insert userChatMessages failed');

          // lastMessageId 업데이트
          await tx
            .update(userChatRooms)
            .set({ lastMessageId: m.id, updatedAt: new Date() })
            .where(eq(userChatRooms.id, roomId));

          // outbox payload는 게이트웨이가 그대로 팬아웃 가능한 형태

          await tx.insert(outbox).values({
            type: 'message.created',

            roomId,

            payload: {
              op: 'event',

              type: 'message.created',

              roomId,

              message: {
                id: m.id,

                user_id: ci.userId,

                content,

                created_at: m.createdAt?.toISOString(),

                temp_id: tempId,
              },
            },

            status: 'pending',

            attempts: 0,

            nextAttemptAt: new Date(),
          });

          return m.id;
        });

        return safeSend(ws, {
          op: 'send',

          success: true,

          message_id: result,

          temp_id: tempId,
        });
      } catch (e: any) {
        console.error('[SEND tx] failed:', e);

        return safeSend(ws, {
          op: 'send',
          success: false,
          error: String(e?.message ?? e),
          temp_id: tempId,
        });
      }
    }

    // ---- ACK (선택) : 읽은 위치 갱신 ----

    if (msg.op === 'ack') {
      const roomId =
        msg.room_id || msg.roomId || msg.conversation_id || msg.conversationId || clients.get(ws)?.roomId;

      const lastReadMessageId = Number(msg.last_read_message_id || msg.last_read_id);

      if (!roomId || !Number.isFinite(lastReadMessageId)) {
        return safeSend(ws, {
          op: 'ack',
          success: false,
          error: 'room_id & last_read_message_id required',
        });
      }

      try {
        // lastReadMessageId를 올릴 때만 업데이트

        await pool.query(
          `

          UPDATE user_chat_members

          SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), $1)

          WHERE room_id = $2 AND user_id = $3 AND deleted_at IS NULL

        `,

          [lastReadMessageId, roomId, clients.get(ws)!.userId],
        );

        return safeSend(ws, {
          op: 'ack',
          success: true,
          room_id: roomId,
          last_read_message_id: lastReadMessageId,
        });
      } catch (e) {
        console.error('[ACK] failed:', e);

        return safeSend(ws, { op: 'ack', success: false, error: 'db error' });
      }
    }

    // ---- Unknown ----

    safeSend(ws, { op: msg.op, success: false, error: `Unknown operation: ${msg.op}` });
  });
});

// ====== Redis subscribe & broadcast ======

subscriber.on('connect', () => console.log('[Redis] subscriber connected'));

subscriber.on('error', (e) => console.error('[Redis] subscriber error:', e));

if (pubsubMode === 'perconv') {
  subscriber.psubscribe('conv:*', (err, count) => {
    if (err) console.error('[Redis] psubscribe error:', err);
    else console.log(`[Redis] PSUBSCRIBE conv:* (${String(count)})`);
  });
} else {
  subscriber.subscribe('chat:message', (err, count) => {
    if (err) console.error('[Redis] subscribe error:', err);
    else console.log(`[Redis] SUBSCRIBE chat:message (${String(count)})`);
  });
}

function broadcastToRoom(roomId: string, payload: any) {
  const set = channelClients.get(roomId);

  if (!set || set.size === 0) return;

  for (const ws of set) safeSend(ws, payload);
}

subscriber.on('message', (_channel, message) => {
  try {
    const data = JSON.parse(message);

    const roomId: string | undefined = data.roomId || data.conversationId;

    if (!roomId) return;

    const payload = {
      ...data,

      timestamp: new Date().toISOString(),

      source: 'live',
    };

    broadcastToRoom(roomId, payload);
  } catch (e) {
    console.error('[Redis] message parse error:', e);
  }
});

subscriber.on('pmessage', (_pattern, channel, message) => {
  try {
    const data = JSON.parse(message);

    const roomId: string =
      data.roomId || data.conversationId || channel.replace(/^conv:/, '');

    if (!roomId) return;

    const payload = {
      ...data,

      roomId,

      timestamp: new Date().toISOString(),

      source: 'live',
    };

    broadcastToRoom(roomId, payload);
  } catch (e) {
    console.error('[Redis] pmessage parse error:', e);
  }
});

// ====== Shutdown ======

const shutdown = async () => {
  console.log('[Shutdown] closing...');

  try {
    subscriber.quit();
  } catch {}

  try {
    redis.quit();
  } catch {}

  try {
    await pool.end();
  } catch {}

  wss.close(() => {
    server.close(() => {
      console.log('[Shutdown] closed');

      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);

process.on('SIGINT', shutdown);

server.listen(port, '0.0.0.0', () => {
  console.log(`[gateway] listening ${port}`);

  console.log(`[gateway] Redis: ${redisUrl!.replace(/:[^:@]+@/, ':****@')}`);

  console.log(`[gateway] PubSub: ${pubsubMode}`);
});

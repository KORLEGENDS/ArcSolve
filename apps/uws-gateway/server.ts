// server.ts

import { and, eq, sql } from 'drizzle-orm';

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


import http, { IncomingMessage, ServerResponse } from 'node:http';

import { Pool } from 'pg';

import { WebSocket, WebSocketServer } from 'ws';

import os from 'node:os';

import {
  backfillSince,
  broadcastToRoom,
  type ClientInfo,
  safeSend,
  takeToken,
  verifyToken,
} from './server-utils.js';

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

const arcyouChatMemberRoleEnum = pgEnum('arcyou_chat_member_role', [
  'owner',
  'manager',
  'participant',
]);

const arcyouChatMessageTypeEnum = pgEnum('arcyou_chat_message_type', [
  'text',
  'image',
  'file',
  'system',
]);

const arcyouChatMessageStatusEnum = pgEnum('arcyou_chat_message_status', [
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

const arcyouChatRooms = pgTable('arcyou_chat_rooms', {
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

const arcyouChatMessages = pgTable('arcyou_chat_messages', {
  id: bigserial('id', { mode: 'number' }).primaryKey().notNull(),

  roomId: uuid('room_id')
    .notNull()
    .references(() => arcyouChatRooms.id, { onDelete: 'cascade' }),

  userId: uuid('user_id').notNull(),

  type: arcyouChatMessageTypeEnum('type').default('text').notNull(),

  content: jsonb('content').notNull(),

  replyToMessageId: bigint('reply_to_message_id', { mode: 'number' }),

  status: arcyouChatMessageStatusEnum('status').default('sent').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

  updatedAt: timestamp('updated_at', { withTimezone: true }),

  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

const arcyouChatMembers = pgTable(
  'arcyou_chat_members',

  {
    roomId: uuid('room_id')
      .notNull()
      .references(() => arcyouChatRooms.id, { onDelete: 'cascade' }),

    userId: uuid('user_id').notNull(),

    role: arcyouChatMemberRoleEnum('role').default('participant').notNull(),

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

const db = drizzle(pool, { schema: { arcyouChatRooms, arcyouChatMessages, arcyouChatMembers, outbox } });

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

const channelClients = new Map<string, Set<WebSocket>>(); // roomId -> sockets

const clients = new Map<WebSocket, ClientInfo>();

// userId 단위 room-activity watcher (방 목록 실시간 갱신용)
const userWatchers = new Map<string, Set<WebSocket>>();

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

    if (ci?.userId) {
      const set = userWatchers.get(ci.userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) userWatchers.delete(ci.userId);
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

    if (!takeToken(ci, RL_REFILL_MS, RL_BUCKET_CAPACITY)) {
      safeSend(ws, { op: 'error', error: 'Rate limited' }, WS_SEND_HIGH_WATER);

      return;
    }

    let msg: any;

    try {
      if (buf.length > MAX_BODY_BYTES) throw new Error('Frame too large');

      msg = JSON.parse(buf.toString());
    } catch (e) {
      safeSend(ws, { op: 'error', error: 'Invalid JSON or too large' }, WS_SEND_HIGH_WATER);

      return;
    }

    // ---- AUTH ----

    if (msg.op === 'auth') {
      const token = msg.token;

      if (!token)
        return safeSend(ws, { op: 'auth', success: false, error: 'Token required' }, WS_SEND_HIGH_WATER);

      const vr = verifyToken(token, jwtPublicKey!, jwtIssuer, jwtAudience);

      if (!vr)
        return safeSend(ws, { op: 'auth', success: false, error: 'Unauthorized' }, WS_SEND_HIGH_WATER);

      ci.userId = vr.userId;
      ci.authenticated = true;

      return safeSend(ws, { op: 'auth', success: true, userId: vr.userId }, WS_SEND_HIGH_WATER);
    }

    if (!ci.authenticated || !ci.userId) {
      return safeSend(
        ws,
        {
          op: msg.op,
          success: false,
          error: 'Unauthorized: auth first',
        },
        WS_SEND_HIGH_WATER,
      );
    }

    // ---- WATCH ROOMS (room-activity 스트림 등록) ----

    if (msg.op === 'watch_rooms') {
      if (!ci.userId) {
        return safeSend(
          ws,
          { op: 'watch_rooms', success: false, error: 'Unauthorized' },
          WS_SEND_HIGH_WATER,
        );
      }

      let set = userWatchers.get(ci.userId);
      if (!set) {
        set = new Set();
        userWatchers.set(ci.userId, set);
      }
      set.add(ws);

      return safeSend(ws, { op: 'watch_rooms', success: true }, WS_SEND_HIGH_WATER);
    }

    // ---- JOIN ----

    if (msg.op === 'join') {
      const roomId = msg.room_id || msg.roomId || msg.conversation_id || msg.conversationId;

      if (!roomId)
        return safeSend(ws, { op: 'join', success: false, error: 'room_id required' }, WS_SEND_HIGH_WATER);

      // 멤버 검증

      const p = await db
        .select()

        .from(arcyouChatMembers)

        .where(
          and(
            eq(arcyouChatMembers.roomId, roomId),
            eq(arcyouChatMembers.userId, ci.userId),
            sql`${arcyouChatMembers.deletedAt} IS NULL`,
          ),
        )

        .limit(1);

      if (p.length === 0)
        return safeSend(ws, { op: 'join', success: false, error: 'Forbidden: not a member' }, WS_SEND_HIGH_WATER);

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
      safeSend(ws, { op: 'join', success: true, room_id: roomId }, WS_SEND_HIGH_WATER);

      // 보강 전송
      try {
        const missed = await backfillSince(
          db,
          arcyouChatMembers,
          arcyouChatMessages,
          roomId,
          ci.userId,
          MAX_MSGS_ON_JOIN,
        );

        for (const m of missed) {
          safeSend(
            ws,
            {
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
            },
            WS_SEND_HIGH_WATER,
          );
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
        return safeSend(ws, { op: 'send', success: false, error: 'room_id required' }, WS_SEND_HIGH_WATER);

      if (content == null)
        return safeSend(ws, { op: 'send', success: false, error: 'content required' }, WS_SEND_HIGH_WATER);

      // 간단한 크기 제한
      const estBytes = Buffer.byteLength(JSON.stringify(content));

      if (estBytes > MAX_BODY_BYTES) {
        return safeSend(ws, { op: 'send', success: false, error: 'content too large' }, WS_SEND_HIGH_WATER);
      }

      // 멤버 검증

      const isP = await db
        .select()

        .from(arcyouChatMembers)

        .where(
          and(
            eq(arcyouChatMembers.roomId, roomId),
            eq(arcyouChatMembers.userId, ci.userId),
            sql`${arcyouChatMembers.deletedAt} IS NULL`,
          ),
        )

        .limit(1);

      if (isP.length === 0)
        return safeSend(ws, { op: 'send', success: false, error: 'Forbidden: not a member' }, WS_SEND_HIGH_WATER);

      // 트랜잭션: arcyouChatMessages + outbox(pending)

      try {
        const result = await db.transaction(async (tx) => {
          const [m] = await tx
            .insert(arcyouChatMessages)

            .values({ 
              roomId, 
              userId: ci.userId!, 
              type: 'text',
              content: content as any 
            })

            .returning();

          if (!m) throw new Error('insert arcyouChatMessages failed');

          // 현재 방의 모든 멤버 조회 (room-activity recipients용)
          const members = await tx
            .select({ userId: arcyouChatMembers.userId })
            .from(arcyouChatMembers)
            .where(
              and(
                eq(arcyouChatMembers.roomId, roomId),
                sql`${arcyouChatMembers.deletedAt} IS NULL`,
              ),
            );

          const recipients = members.map((mm) => mm.userId);

          // lastMessageId 업데이트
          await tx
            .update(arcyouChatRooms)
            .set({ lastMessageId: m.id, updatedAt: new Date() })
            .where(eq(arcyouChatRooms.id, roomId));

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
              // 방 멤버 userId 목록 (room-activity 브로드캐스트용)
              recipients,
            },

            status: 'pending',

            attempts: 0,

            nextAttemptAt: new Date(),
          });

          return m.id;
        });

        return safeSend(
          ws,
          {
            op: 'send',
            success: true,
            message_id: result,
            temp_id: tempId,
          },
          WS_SEND_HIGH_WATER,
        );
      } catch (e: any) {
        console.error('[SEND tx] failed:', e);

        return safeSend(
          ws,
          {
            op: 'send',
            success: false,
            error: String(e?.message ?? e),
            temp_id: tempId,
          },
          WS_SEND_HIGH_WATER,
        );
      }
    }

    // ---- ACK (선택) : 읽은 위치 갱신 ----

    if (msg.op === 'ack') {
      const roomId =
        msg.room_id || msg.roomId || msg.conversation_id || msg.conversationId || clients.get(ws)?.roomId;

      const lastReadMessageId = Number(msg.last_read_message_id || msg.last_read_id);

      if (!roomId || !Number.isFinite(lastReadMessageId)) {
        return safeSend(
          ws,
          { op: 'ack', success: false, error: 'room_id & last_read_message_id required' },
          WS_SEND_HIGH_WATER,
        );
      }

      try {
        // lastReadMessageId를 올릴 때만 업데이트

        await pool.query(
          `

          UPDATE arcyou_chat_members

          SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), $1)

          WHERE room_id = $2 AND user_id = $3 AND deleted_at IS NULL

        `,

          [lastReadMessageId, roomId, clients.get(ws)!.userId],
        );

        return safeSend(
          ws,
          {
            op: 'ack',
            success: true,
            room_id: roomId,
            last_read_message_id: lastReadMessageId,
          },
          WS_SEND_HIGH_WATER,
        );
      } catch (e) {
        console.error('[ACK] failed:', e);

        return safeSend(ws, { op: 'ack', success: false, error: 'db error' }, WS_SEND_HIGH_WATER);
      }
    }

    // ---- Unknown ----
    safeSend(ws, { op: msg.op, success: false, error: `Unknown operation: ${msg.op}` }, WS_SEND_HIGH_WATER);
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

    broadcastToRoom(channelClients, roomId, payload, WS_SEND_HIGH_WATER);

    // 방 목록 실시간 갱신을 위한 room-activity 이벤트 (user 단위 브로드캐스트)
    const recipients = Array.isArray(data.recipients) ? (data.recipients as string[]) : null;
    const messageId: number | undefined = data.message?.id;
    const createdAt: string | undefined = data.message?.created_at;

    if (recipients) {
      // 메시지 생성 이벤트인 경우: room-activity 브로드캐스트
      if (data.type === 'message.created' && typeof messageId === 'number') {
        const activityPayload = {
          op: 'room-activity' as const,
          roomId,
          lastMessageId: messageId,
          createdAt: createdAt ?? new Date().toISOString(),
        };

        for (const userId of recipients) {
          const set = userWatchers.get(userId);
          if (!set || set.size === 0) continue;
          for (const ws of set) {
            safeSend(ws, activityPayload, WS_SEND_HIGH_WATER);
          }
        }
      }

      // 채팅방 생성 이벤트인 경우: room-created 브로드캐스트
      if (data.type === 'room.created' && data.room) {
        const roomCreatedPayload = {
          op: 'room-created' as const,
          room: data.room,
        };

        for (const userId of recipients) {
          const set = userWatchers.get(userId);
          if (!set || set.size === 0) continue;
          for (const ws of set) {
            safeSend(ws, roomCreatedPayload, WS_SEND_HIGH_WATER);
          }
        }
      }
    }
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

    broadcastToRoom(channelClients, roomId, payload, WS_SEND_HIGH_WATER);

    // 방 목록 실시간 갱신을 위한 room-activity 이벤트 (user 단위 브로드캐스트)
    const recipients = Array.isArray(data.recipients) ? (data.recipients as string[]) : null;
    const messageId: number | undefined = data.message?.id;
    const createdAt: string | undefined = data.message?.created_at;

    if (recipients) {
      // 메시지 생성 이벤트인 경우: room-activity 브로드캐스트
      if (data.type === 'message.created' && typeof messageId === 'number') {
        const activityPayload = {
          op: 'room-activity' as const,
          roomId,
          lastMessageId: messageId,
          createdAt: createdAt ?? new Date().toISOString(),
        };

        for (const userId of recipients) {
          const set = userWatchers.get(userId);
          if (!set || set.size === 0) continue;
          for (const ws of set) {
            safeSend(ws, activityPayload, WS_SEND_HIGH_WATER);
          }
        }
      }

      // 채팅방 생성 이벤트인 경우: room-created 브로드캐스트
      if (data.type === 'room.created' && data.room) {
        const roomCreatedPayload = {
          op: 'room-created' as const,
          room: data.room,
        };

        for (const userId of recipients) {
          const set = userWatchers.get(userId);
          if (!set || set.size === 0) continue;
          for (const ws of set) {
            safeSend(ws, roomCreatedPayload, WS_SEND_HIGH_WATER);
          }
        }
      }
    }
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

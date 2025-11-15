// server-utils.ts

import { and, eq, gt, sql } from 'drizzle-orm';

import { drizzle } from 'drizzle-orm/node-postgres';

import jwt from 'jsonwebtoken';

import { WebSocket } from 'ws';

import type { PgTableWithColumns } from 'drizzle-orm/pg-core';

// ====== Types ======

export type ClientInfo = {
  userId?: string;
  roomId?: string;
  authenticated?: boolean;
  // token bucket
  tokens: number;
  lastRefillAt: number;
};

// ====== JWT ======

export function verifyToken(
  token: string,
  jwtPublicKey: string,
  jwtIssuer?: string,
  jwtAudience?: string,
): { userId: string } | null {
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

    const decoded = jwt.verify(clean, jwtPublicKey, verifyOpts) as jwt.JwtPayload;

    const userId = (decoded.sub || decoded.userId || decoded.id) as string | undefined;

    if (!userId) return null;

    return { userId };
  } catch (e) {
    console.error('[JWT] verify failed:', e);

    return null;
  }
}

// ====== Helpers ======

export function takeToken(
  ci: ClientInfo,
  rlRefillMs: number,
  rlBucketCapacity: number,
): boolean {
  const now = Date.now();

  if (now - ci.lastRefillAt >= rlRefillMs) {
    ci.tokens = rlBucketCapacity;
    ci.lastRefillAt = now;
  }

  if (ci.tokens <= 0) return false;

  ci.tokens -= 1;

  return true;
}

export function safeSend(ws: WebSocket, payload: unknown, wsSendHighWater: number): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  if (ws.bufferedAmount > wsSendHighWater) {
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

export async function backfillSince<
  TMembers extends PgTableWithColumns<any>,
  TMessages extends PgTableWithColumns<any>,
>(
  db: ReturnType<typeof drizzle>,
  membersTable: TMembers,
  messagesTable: TMessages,
  roomId: string,
  userId: string,
  limit: number,
): Promise<
  Array<{
    id: string;
    userId: string;
    content: unknown;
    createdAt: Date | null;
  }>
> {
  // 멤버 레코드 확보
  const p = await db
    .select()
    .from(membersTable)
    .where(
      and(
        eq(membersTable.roomId, roomId),
        eq(membersTable.userId, userId),
        sql`${(membersTable as any).deletedAt} IS NULL`,
      ),
    )
    .limit(1);

  const lastReadMessageId = (p[0] as any)?.lastReadMessageId as string | null | undefined;
  const lastReadCreatedAt = lastReadMessageId
    ? await db
        .select({ createdAt: (messagesTable as any).createdAt })
        .from(messagesTable)
        .where(eq((messagesTable as any).id, lastReadMessageId))
        .limit(1)
        .then((rows) => (rows[0] as any)?.createdAt ?? null)
    : null;

  const rows = await db
    .select({
      id: (messagesTable as any).id,
      userId: (messagesTable as any).userId,
      content: (messagesTable as any).content,
      createdAt: (messagesTable as any).createdAt,
    })
    .from(messagesTable)
    .where(
      and(
        eq((messagesTable as any).roomId, roomId),
        lastReadCreatedAt
          ? gt((messagesTable as any).createdAt, lastReadCreatedAt)
          : undefined,
        sql`${(messagesTable as any).deletedAt} IS NULL`,
      ),
    )
    .orderBy((messagesTable as any).createdAt)
    .limit(limit);

  return rows as any;
}

export function broadcastToRoom(
  channelClients: Map<string, Set<WebSocket>>,
  roomId: string,
  payload: any,
  wsSendHighWater: number,
): void {
  const set = channelClients.get(roomId);

  if (!set || set.size === 0) return;

  for (const ws of set) safeSend(ws, payload, wsSendHighWater);
}


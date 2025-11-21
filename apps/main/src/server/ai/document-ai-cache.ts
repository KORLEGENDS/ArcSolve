import type { UIMessage } from 'ai';

import { CACHE_TTL, CacheKey } from '@/share/configs/constants';
import { getRedis } from '@/server/database/redis/connection/client-redis';
import type { DocumentAiRepository } from '@/share/schema/repositories/document-ai-repository';

const LAST_USER_TTL_SEC: number = CACHE_TTL.AI.LAST_USER_MESSAGE;
const CONVERSATION_TTL_SEC: number = CACHE_TTL.AI.CONVERSATION;

export type DocumentAiConversation = UIMessage[];

/**
 * AI 문서(document 기반 세션)의 "직전 사용자 메시지"를
 * Redis 에 짧게 캐시하기 위한 헬퍼입니다.
 *
 * - 정합성의 소스는 항상 Postgres(document_ai_*) 이고,
 *   이 모듈은 단순 캐시 역할만 수행합니다.
 */
export async function saveLastAiUserMessage(params: {
  userId: string;
  documentId: string;
  message: UIMessage;
  ttlSec?: number;
}): Promise<void> {
  const redis = getRedis();
  const { userId, documentId, message, ttlSec = LAST_USER_TTL_SEC } = params;

  try {
    const payload = JSON.stringify(message);
    await redis.set(
      CacheKey.ai.lastUserMessage(userId, documentId),
      payload,
      'EX',
      ttlSec,
    );
  } catch (error) {
    console.warn('[document-ai-cache] saveLastAiUserMessage failed:', error);
  }
}

export async function loadLastAiUserMessage(params: {
  userId: string;
  documentId: string;
}): Promise<UIMessage | null> {
  const redis = getRedis();
  const { userId, documentId } = params;

  try {
    const raw = await redis.get(
      CacheKey.ai.lastUserMessage(userId, documentId),
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.role !== 'user') return null;
    if (!Array.isArray(parsed.parts)) return null;

    return parsed as UIMessage;
  } catch (error) {
    console.warn('[document-ai-cache] loadLastAiUserMessage failed:', error);
    return null;
  }
}

export async function deleteLastAiUserMessage(params: {
  userId: string;
  documentId: string;
}): Promise<void> {
  const redis = getRedis();
  const { userId, documentId } = params;

  try {
    await redis.del(CacheKey.ai.lastUserMessage(userId, documentId));
  } catch (error) {
    console.warn('[document-ai-cache] deleteLastAiUserMessage failed:', error);
  }
}

/**
 * 전체 대화(UIMessage[]) 스냅샷을 Redis 에 저장합니다.
 */
export async function saveConversationSnapshot(params: {
  userId: string;
  documentId: string;
  messages: DocumentAiConversation;
  ttlSec?: number;
}): Promise<void> {
  const redis = getRedis();
  const { userId, documentId, messages, ttlSec = CONVERSATION_TTL_SEC } =
    params;

  try {
    const payload = JSON.stringify(messages);
    await redis.set(
      CacheKey.ai.conversation(userId, documentId),
      payload,
      'EX',
      ttlSec,
    );
  } catch (error) {
    console.warn('[document-ai-cache] saveConversationSnapshot failed:', error);
  }
}

/**
 * 전체 대화(UIMessage[])를 Redis → 없으면 Postgres 순으로 로드합니다.
 *
 * - 항상 DocumentAiRepository 를 통해 소유자/문서 유효성을 검증합니다.
 * - Redis 캐시가 없거나 파싱에 실패하면 Postgres 조회 결과를 Redis에 다시 채웁니다.
 */
export async function loadConversationWithCache(params: {
  userId: string;
  documentId: string;
  repository: DocumentAiRepository;
}): Promise<DocumentAiConversation> {
  const redis = getRedis();
  const { userId, documentId, repository } = params;

  try {
    const raw = await redis.get(
      CacheKey.ai.conversation(userId, documentId),
    );
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as DocumentAiConversation;
      }
    }
  } catch (error) {
    console.warn('[document-ai-cache] loadConversationWithCache redis failed:', error);
  }

  // Fallback: Postgres 가 항상 소스 오브 트루스
  const messages = await repository.loadConversationForOwner({
    documentId,
    userId,
  });

  // 조회 결과를 Redis 에 스냅샷으로 채워넣기 (실패해도 로직에는 영향 없음)
  try {
    await saveConversationSnapshot({ userId, documentId, messages });
  } catch (error) {
    console.warn(
      '[document-ai-cache] loadConversationWithCache save snapshot failed:',
      error,
    );
  }

  return messages;
}


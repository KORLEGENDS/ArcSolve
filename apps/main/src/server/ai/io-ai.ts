import type { UIMessage } from 'ai';

import { getRedis } from '@/server/database/redis/connection/client-redis';
import { CACHE_TTL, CacheKey } from '@/share/configs/constants';
import type { DocumentAiRepository } from '@/share/schema/repositories/document-ai-repository';

const CONVERSATION_TTL_SEC: number = CACHE_TTL.AI.CONVERSATION;

export type DocumentAiConversation = UIMessage[];

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


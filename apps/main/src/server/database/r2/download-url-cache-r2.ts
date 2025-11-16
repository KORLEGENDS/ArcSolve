import { getRedis } from '@/server/database/redis/connection/client-redis';
import { CacheKey } from '@/share/configs/constants/server/cache-constants';
import { getDownloadUrl } from './upload-r2';

type CachedEntry = {
  url: string;
  expiresAt: string; // ISO
};

const KEY = (
  storageKey: string,
  options?: { filename?: string; mimeType?: string; inline?: boolean }
): string => CacheKey.r2.downloadUrl(storageKey, options);

/**
 * 서명 URL 캐시 조회/발급
 * - Redis가 없으면 즉시 발급
 * - 남은 TTL이 skewSeconds 이하이면 재발급
 */
export async function getCachedDownloadUrl(
  storageKey: string,
  options?: {
    expiresIn?: number;
    skewSeconds?: number;
    filename?: string;
    mimeType?: string;
    inline?: boolean;
  }
): Promise<{ url: string; expiresAt: string }> {
  const expiresIn = Math.max(30, options?.expiresIn ?? 300);
  const skew = Math.max(5, options?.skewSeconds ?? 10);

  const redis = getRedis();
  const now = Date.now();

  // 캐시 키에 파일명/MIME 타입 포함 (다른 옵션이면 다른 URL)
  const cacheKey = KEY(storageKey, options);

  if (redis) {
    try {
      const raw = await redis.get(cacheKey);
      if (raw) {
        const parsed: CachedEntry = JSON.parse(raw);
        const expMs = Date.parse(parsed.expiresAt);
        if (Number.isFinite(expMs)) {
          const remaining = Math.floor((expMs - now) / 1000);
          if (remaining > skew) {
            return { url: parsed.url, expiresAt: parsed.expiresAt };
          }
        }
      }
    } catch {
      // 캐시 조회 실패 시 무시하고 재발급
    }
  }

  // 캐시 미스 또는 만료 임박 → 새로 발급
  const url = await getDownloadUrl(storageKey, expiresIn, {
    filename: options?.filename,
    mimeType: options?.mimeType,
    inline: options?.inline,
  });
  const expiresAt = new Date(now + expiresIn * 1000).toISOString();

  if (redis) {
    try {
      const ttl = Math.max(0, expiresIn - skew);
      await redis.set(cacheKey, JSON.stringify({ url, expiresAt }), 'EX', ttl);
    } catch {
      // 캐시 저장 실패는 무시
    }
  }

  return { url, expiresAt };
}



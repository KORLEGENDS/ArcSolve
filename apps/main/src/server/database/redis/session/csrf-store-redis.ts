import { CACHE_TTL } from '@/share/configs/constants';
import { CacheKey, getRedis } from '../connection/client-redis';

const DEFAULT_TTL_SEC = CACHE_TTL.SECURITY.CSRF;

export async function saveCSRF(
  tokenId: string,
  value: string,
  ttlSec: number = DEFAULT_TTL_SEC
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(CacheKey.FILE_STATUS_CHANNEL(tokenId), value, 'EX', ttlSec);
}

export async function loadCSRF(tokenId: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get(CacheKey.FILE_STATUS_CHANNEL(tokenId));
}

export async function deleteCSRF(tokenId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(CacheKey.FILE_STATUS_CHANNEL(tokenId));
}

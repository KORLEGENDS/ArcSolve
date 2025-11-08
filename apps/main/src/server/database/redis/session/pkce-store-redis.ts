import { CACHE_TTL } from '@/share/configs/constants';
import { CacheKey, getRedis } from '../connection/client-redis';

const DEFAULT_TTL_SEC = CACHE_TTL.SECURITY.PKCE;

export async function savePKCE(
  codeVerifierId: string,
  codeVerifier: string,
  ttlSec: number = DEFAULT_TTL_SEC
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(
    CacheKey.FILE_STATUS_CHANNEL(codeVerifierId),
    codeVerifier,
    'EX',
    ttlSec
  );
}

export async function loadPKCE(codeVerifierId: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get(CacheKey.FILE_STATUS_CHANNEL(codeVerifierId));
}

export async function deletePKCE(codeVerifierId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(CacheKey.FILE_STATUS_CHANNEL(codeVerifierId));
}

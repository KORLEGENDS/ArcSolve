import { CACHE_TTL, CacheKey } from '@/share/configs/constants';
import { getRedis } from '../connection/client-redis';

const DEFAULT_TTL_SEC: number = CACHE_TTL.SESSION.REFRESH_TOKEN;

/** Save refresh token */
export async function saveRefreshToken(
  id: string,
  token: string,
  ttlSec: number = DEFAULT_TTL_SEC
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }
  await redis.set(CacheKey.session.refreshToken(id), token, 'EX', ttlSec);
}

/** Load refresh token; null if not found */
export async function loadRefreshToken(id: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get(CacheKey.session.refreshToken(id));
}

/** Rotate refresh token: delete old, save new */
export async function rotateRefreshToken(
  oldId: string,
  newId: string,
  newToken: string
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const multi = redis.multi();
  multi.del(CacheKey.session.refreshToken(oldId));
  multi.set(
    CacheKey.session.refreshToken(newId),
    newToken,
    'EX',
    DEFAULT_TTL_SEC
  );
  await multi.exec();
}

/** Delete refresh token */
export async function deleteRefreshToken(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(CacheKey.session.refreshToken(id));
}

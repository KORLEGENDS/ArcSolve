import { CACHE_TTL } from '@/share/configs/constants';
import { v4 as uuidv4 } from 'uuid';
import { CacheKey, getRedis } from './client-redis';

const DEFAULT_TTL_SEC = CACHE_TTL.SECURITY.LOCK;

export async function acquireLock(
  key: string,
  ttlSec: number = DEFAULT_TTL_SEC
): Promise<string | null> {
  const redis = getRedis();
  const lockId = uuidv4();
  try {
    const ok = await redis.set(key, lockId, 'EX', ttlSec, 'NX');
    return ok === 'OK' ? lockId : null;
  } catch (error) {
    console.error('[Redis Lock] acquireLock failed:', { key, ttlSec, error });
    return null;
  }
}

export async function releaseLock(
  key: string,
  lockId: string
): Promise<boolean> {
  const redis = getRedis();
  const lua = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
  try {
    const res = await redis.eval(lua, 1, key, lockId);
    return res === 1;
  } catch (error) {
    console.error('[Redis Lock] releaseLock failed:', { key, lockId, error });
    return false;
  }
}

// Convenience wrappers for standard lock prefix
interface RedisLockType {
  forRefreshToken: (userId: string) => string;
}

export const RedisLock: RedisLockType = {
  forRefreshToken: (userId: string): string => CacheKey.security.lock(userId),
};

import { CACHE_TTL } from '@/share/configs/constants';
import { CacheKey, getRedis } from '../connection/client-redis';

const WINDOW_SEC = CACHE_TTL.RATE_LIMIT.WINDOW;
const MAX_REQUESTS = 60;

export async function isUserSchemaRateLimited(
  userId: string
): Promise<{ limited: boolean; remaining: number }> {
  const redis = getRedis();
  if (!redis) return { limited: false, remaining: MAX_REQUESTS };
  const key = CacheKey.rateLimit.user(userId);
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, WINDOW_SEC);
  }
  const remaining = Math.max(0, MAX_REQUESTS - current);
  return { limited: current > MAX_REQUESTS, remaining };
}

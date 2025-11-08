import { CACHE_TTL, CacheKey, RATE_LIMIT } from '@/share/configs/constants';
import { consumeFixedWindow, RateLimitResult } from './window-redis';

export async function isUserSchemaRateLimited(
  userId: string
): Promise<RateLimitResult> {
  const key = CacheKey.rateLimit.user(userId);
  return consumeFixedWindow(key, CACHE_TTL.RATE_LIMIT.WINDOW, RATE_LIMIT.USER.MAX_REQUESTS);
}

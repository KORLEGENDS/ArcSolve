import { CACHE_TTL, CacheKey, RATE_LIMIT } from '@/share/configs/constants';
import { consumeFixedWindow, RateLimitResult } from './window-redis';

export async function consumeIpLimit(ip: string): Promise<RateLimitResult> {
  const key = CacheKey.rateLimit.ip(ip);
  return consumeFixedWindow(key, CACHE_TTL.RATE_LIMIT.WINDOW, RATE_LIMIT.IP.MAX_REQUESTS);
}

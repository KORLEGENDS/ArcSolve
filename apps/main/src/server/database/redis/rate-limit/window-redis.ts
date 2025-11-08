import { getRedis } from '../connection/client-redis';

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
}

const LUA_INCR_WITH_TTL = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return c
`;

export async function incrFixedWindow(key: string, windowSec: number): Promise<number> {
  const redis = getRedis();
  const result = await redis.eval(LUA_INCR_WITH_TTL, 1, key, String(windowSec));
  return Number(result ?? 0);
}

export async function consumeFixedWindow(
  key: string,
  windowSec: number,
  maxRequests: number
): Promise<RateLimitResult> {
  const count = await incrFixedWindow(key, windowSec);
  const remaining = Math.max(0, maxRequests - count);
  return { limited: count > maxRequests, remaining };
}



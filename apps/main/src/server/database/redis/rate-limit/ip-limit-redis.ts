import { TIME_UNITS } from '@/share/configs/constants';
import { getRedis } from '../connection/client-redis';

export async function consumeIpLimit(ip: string): Promise<boolean> {
  const redis = getRedis();
  const key = `ratelimit:ip:${ip}`;
  const ttlSeconds = Math.floor(TIME_UNITS.MINUTE / 1000);
  const res = await redis.multi().incr(key).expire(key, ttlSeconds).exec();
  const count = Number(res?.[0]?.[1] ?? 0);
  return count <= 60;
}

/**
 * 모바일용 Refresh Token 저장소
 * Refresh Token 자체를 키로 사용하여 userId를 저장
 */

import { CACHE_TTL } from '@/share/configs/constants';
import { getRedis } from '../connection/client-redis';

const DEFAULT_TTL_SEC: number = CACHE_TTL.SESSION.REFRESH_TOKEN;

/**
 * Refresh Token을 키로 사용하여 저장 (모바일용)
 * 키: session:refresh:mobile:token:{refreshToken}
 * 값: userId
 *
 * @param userId 사용자 ID
 * @param refreshToken Refresh Token 문자열
 * @param ttlSec TTL (초 단위), 기본값: DEFAULT_TTL_SEC
 */
export async function saveRefreshTokenByToken(
  userId: string,
  refreshToken: string,
  ttlSec: number = DEFAULT_TTL_SEC
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }
  await redis.set(`session:refresh:mobile:token:${refreshToken}`, userId, 'EX', ttlSec);
}

/**
 * Refresh Token으로 userId 조회 (모바일용)
 *
 * @param refreshToken Refresh Token 문자열
 * @returns userId 또는 null (토큰이 없거나 만료된 경우)
 */
export async function loadRefreshTokenByToken(refreshToken: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get(`session:refresh:mobile:token:${refreshToken}`);
}

/**
 * Refresh Token 삭제 (모바일용)
 *
 * @param refreshToken Refresh Token 문자열
 */
export async function deleteRefreshTokenByToken(refreshToken: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(`session:refresh:mobile:token:${refreshToken}`);
}

/**
 * Refresh Token 로테이션 (모바일용)
 * 기존 토큰을 삭제하고 새 토큰을 저장
 *
 * @param oldToken 기존 Refresh Token
 * @param newToken 새 Refresh Token
 * @param userId 사용자 ID
 * @param ttlSec TTL (초 단위), 기본값: DEFAULT_TTL_SEC
 */
export async function rotateRefreshTokenByToken(
  oldToken: string,
  newToken: string,
  userId: string,
  ttlSec: number = DEFAULT_TTL_SEC
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const multi = redis.multi();
  multi.del(`session:refresh:mobile:token:${oldToken}`);
  multi.set(`session:refresh:mobile:token:${newToken}`, userId, 'EX', ttlSec);
  await multi.exec();
}


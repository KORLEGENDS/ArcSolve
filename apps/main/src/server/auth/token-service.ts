import {
  acquireLock,
  RedisLock,
  releaseLock,
} from '@/server/database/redis/connection/lock-redis';
import {
  loadRefreshToken,
  rotateRefreshToken,
} from '@/server/database/redis/session/refresh-store-redis';
import { OAUTH_SERVER_ENDPOINTS } from '@/share/configs/constants/server/auth-constants';
import { env } from '@/share/configs/environments/server-constants';
import { TypeGuards } from '@/share/share-utils/type-guards-utils';
import { AuthError, SystemError, ValidationError } from '@/share/types/api/error-types';
import axios from 'axios';
import { z } from 'zod';


export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch seconds
}

/**
 * OAuth access 토큰 새로고침 (Kakao/Naver 공통)
 * - Redis 분산락으로 race 방지
 * - 성공 시 refresh token 로테이션 (존재 시)
 * - 실패/외부 오류 시 명확한 도메인 에러 throw
 */
export async function refreshAccessToken(
  provider: 'kakao' | 'naver',
  userId: string
): Promise<RefreshResult> {
  if (!TypeGuards.isString(userId) || !TypeGuards.isUUID(userId)) {
    throw new ValidationError('Invalid user ID format', 'userId', userId);
  }

  const lockKey = RedisLock.forRefreshToken(userId);
  const lockId = await acquireLock(lockKey);
  if (!lockId) {
    throw new AuthError('Could not acquire lock for token refresh', 'authentication');
  }

  try {
    const storedRefreshToken = await loadRefreshToken(userId);
    if (!storedRefreshToken) {
      throw new AuthError('Refresh token not found', 'authentication');
    }

    // Provider별 설정/엔드포인트/스키마 결정
    const isKakao = provider === 'kakao';
    const endpoint = isKakao
      ? OAUTH_SERVER_ENDPOINTS.KAKAO.TOKEN
      : OAUTH_SERVER_ENDPOINTS.NAVER.TOKEN;

    const params = new URLSearchParams();
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', storedRefreshToken);

    if (isKakao) {
      if (!env.AUTH_KAKAO_ID) {
        throw new ValidationError('Kakao client ID is required');
      }
      params.set('client_id', env.AUTH_KAKAO_ID);
      if (env.AUTH_KAKAO_SECRET) {
        params.set('client_secret', env.AUTH_KAKAO_SECRET);
      }
    } else {
      if (!env.AUTH_NAVER_ID || !env.AUTH_NAVER_SECRET) {
        throw new ValidationError('Naver client ID and secret are required');
      }
      params.set('client_id', env.AUTH_NAVER_ID);
      params.set('client_secret', env.AUTH_NAVER_SECRET);
    }

    let response;
    try {
      response = await axios.post(endpoint, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });
    } catch (error) {
      const serviceKey = isKakao ? 'kakao.oauth.token' : 'naver.oauth.token';
      throw new SystemError(`External service error: ${serviceKey}`, 'external', error as Error);
    }

    const schema = isKakao
      ? z.object({
          access_token: z.string().min(1, 'Access token is required'),
          refresh_token: z.string().optional(),
          expires_in: z.number().positive('Expires in must be positive'),
          token_type: z.string().optional().default('Bearer'),
          scope: z.string().optional(),
        })
      : z.object({
          access_token: z.string().min(1),
          refresh_token: z.string().optional(),
          expires_in: z.union([z.string(), z.number()]).transform((v) => Number(v)),
          token_type: z.string().optional().default('Bearer'),
        });

    const result = await schema.safeParseAsync(response.data);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        return `${path}${issue.message}`;
      });
      const errorMessage = errors.length > 0
        ? `Invalid OAuth response: ${errors.join(', ')}`
        : 'Invalid OAuth response';
      throw new ValidationError(errorMessage, 'response', result.error);
    }

    const validated = result.data;
    if (!TypeGuards.isString(validated.access_token) || !TypeGuards.isNumber(validated.expires_in)) {
      throw new ValidationError(`Invalid OAuth response format from ${isKakao ? 'Kakao' : 'Naver'}`);
    }

    if (validated.refresh_token) {
      await rotateRefreshToken(userId, userId, validated.refresh_token);
    }

    return {
      accessToken: validated.access_token,
      refreshToken: validated.refresh_token ?? storedRefreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + validated.expires_in,
    };
  } finally {
    await releaseLock(lockKey, lockId);
  }
}

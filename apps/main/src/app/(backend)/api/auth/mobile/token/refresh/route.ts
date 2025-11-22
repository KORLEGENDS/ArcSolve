/**
 * Refresh Token으로 Access Token 갱신 API
 *
 * POST /api/auth/mobile/token/refresh
 *
 * Refresh Token을 사용하여 새로운 Access Token을 발급합니다.
 */

import { ApiException, throwApi } from '@/server/api/errors';
import { error, ok } from '@/server/api/response';
import { getSessionConfig } from '@/server/auth/auth-config';
import {
  loadRefreshTokenByToken,
  rotateRefreshTokenByToken,
} from '@/server/database/redis/session/refresh-store-mobile-redis';
import { env } from '@/share/configs/environments/server-constants';
import { UserRepository } from '@/share/schema/repositories/user-repository';
import { auth } from '@auth';
import { encode } from '@auth/core/jwt';
import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Refresh Token으로 Access Token 갱신
 *
 * 요청: {
 *   refreshToken: string
 * }
 * 응답: {
 *   success: true,
 *   data: {
 *     accessToken: string,
 *     refreshToken?: string, // 새로 발급된 경우에만 포함
 *     expiresIn: string,
 *     expiresAt: number,
 *     user: {
 *       id: string,
 *       email?: string,
 *       name?: string,
 *       image?: string,
 *     }
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 요청 본문 파싱 및 검증
    const raw = (await request.json().catch(() => undefined)) as unknown;
    const parsed = refreshRequestSchema.safeParse(raw);

    if (!parsed.success) {
      throwApi('BAD_REQUEST', '요청 본문이 올바르지 않습니다.', {
        issues: parsed.error.flatten(),
      });
    }

    const { refreshToken } = parsed.data;

    // 2. Refresh Token 검증 및 사용자 ID 조회
    const userId = await loadRefreshTokenByToken(refreshToken);
    if (!userId) {
      throwApi('UNAUTHORIZED', '유효하지 않은 Refresh Token입니다.', {
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    // 3. 사용자 정보 조회
    // 세션이 있으면 세션 정보 사용, 없으면 DB에서 조회
    let userEmail: string | undefined;
    let userName: string | undefined;
    let userImage: string | undefined;

    const session = await auth().catch(() => null);

    if (session?.user?.id === userId) {
      // 세션에서 사용자 정보 가져오기
      userEmail = session.user.email || undefined;
      userName = session.user.name || undefined;
      userImage = session.user.image || undefined;
    } else {
      // DB에서 사용자 정보 조회
      const usersRepo = new UserRepository();
      const user = await usersRepo.getById(userId);

      if (!user) {
        throwApi('UNAUTHORIZED', '사용자 정보를 찾을 수 없습니다.', {
          code: 'USER_NOT_FOUND',
        });
      }

      userEmail = user.email;
      userName = user.name || undefined;
      userImage = user.imageUrl || undefined;
    }

    // 4. 새 Access Token 생성
    const sessionConfig = getSessionConfig();
    const now = Math.floor(Date.now() / 1000);
    const maxAgeSeconds = Math.floor(sessionConfig.maxAge / 1000); // 밀리초를 초로 변환
    const expiresAt = now + maxAgeSeconds;

    const accessToken = await encode({
      token: {
        sub: userId,
        email: userEmail,
        name: userName,
        image: userImage,
        iat: now,
        exp: expiresAt,
      },
      secret: env.AUTH_SECRET,
      salt: 'authjs.session-token',
      maxAge: maxAgeSeconds,
    });

    // 5. Refresh Token 로테이션 (보안을 위해 주기적으로 갱신)
    const shouldRotate = true; // 항상 로테이션 (보안 강화)
    let newRefreshToken: string | undefined;

    if (shouldRotate) {
      newRefreshToken = crypto.randomBytes(32).toString('hex');
      const refreshTokenTTL = 30 * 24 * 60 * 60; // 30일
      await rotateRefreshTokenByToken(refreshToken, newRefreshToken, userId, refreshTokenTTL);
    }

    // 6. 응답 반환
    return ok(
      {
        accessToken,
        ...(newRefreshToken && { refreshToken: newRefreshToken }),
        expiresIn: `${maxAgeSeconds}s`,
        expiresAt,
        user: {
          id: userId,
          email: userEmail,
          name: userName,
          image: userImage,
        },
      },
      {
        user: {
          id: userId,
          email: userEmail,
        },
        message: '토큰이 성공적으로 갱신되었습니다.',
      }
    );
  } catch (err) {
    console.error('[POST /api/auth/mobile/token/refresh] Error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    if (err instanceof ApiException) {
      return error(err.code, err.message, {
        user: undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '토큰 갱신 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}


/**
 * 모바일용 토큰 발급 API
 *
 * POST /api/auth/mobile/token
 *
 * Better Auth 세션(→ 도메인 사용자 ID 매핑)을 검증하고
 * 모바일 앱용 Access Token과 Refresh Token을 발급합니다.
 */

import { error, ok } from '@/server/api/response';
import { getSessionConfig } from '@/server/auth/auth-config';
import { saveRefreshTokenByToken } from '@/server/database/redis/session/refresh-store-mobile-redis';
import { env } from '@/share/configs/environments/server-constants';
import { encode } from '@auth/core/jwt';
import { auth } from '@auth';
import crypto from 'crypto';
import type { NextRequest } from 'next/server';

/**
 * 모바일용 토큰 발급
 *
 * 요청: 없음 (세션 쿠키에서 자동으로 세션 확인)
 * 응답: {
 *   success: true,
 *   data: {
 *     accessToken: string,
 *     refreshToken: string,
 *     expiresIn: string, // 예: "3600s"
 *     expiresAt: number, // epoch seconds
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
    // 1. Better Auth 세션 확인 (Expo + 웹 공통) + 도메인 사용자 ID 매핑
    //    - @auth.auth() 헬퍼는 Better Auth user.id → users.id 로 매핑해 줍니다.
    const session = await auth();

    if (!session?.user?.id) {
      return error('UNAUTHORIZED', '인증이 필요합니다.', {
        user: undefined,
      });
    }

    // 도메인 users.id (uuid)
    const userId = session.user.id;
    const userEmail = session.user.email;
    const userName = session.user.name;
    const userImage = session.user.image;

    // 2. Access Token 생성 (JWT)
    // NextAuth의 JWT 인코딩 방식과 동일하게 생성
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

    // 3. Refresh Token 생성 (Opaque Token - 랜덤 문자열)
    // Refresh Token은 JWT가 아닌 랜덤 문자열로 생성하여 서버에서 완전히 제어 가능
    const refreshToken = crypto.randomBytes(32).toString('hex');

    // 4. Refresh Token을 Redis에 저장 (모바일용 - 토큰을 키로 사용)
    // TTL은 Access Token보다 길게 설정 (예: 30일)
    const refreshTokenTTL = 30 * 24 * 60 * 60; // 30일 (초)
    await saveRefreshTokenByToken(userId, refreshToken, refreshTokenTTL);

    // 5. 응답 반환
    return ok(
      {
        accessToken,
        refreshToken,
        expiresIn: `${maxAgeSeconds}s`, // 초 단위
        expiresAt,
        user: {
          id: userId,
          email: userEmail || undefined,
          name: userName || undefined,
          image: userImage || undefined,
        },
      },
      {
        user: {
          id: userId,
          email: userEmail || undefined,
        },
        message: '모바일용 토큰이 성공적으로 발급되었습니다.',
      }
    );
  } catch (err) {
    console.error('[POST /api/auth/mobile/token] Error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return error('INTERNAL', '토큰 발급 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}


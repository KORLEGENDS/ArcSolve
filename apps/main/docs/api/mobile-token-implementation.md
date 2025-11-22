# 모바일용 토큰 발급 API 구현 가이드

## 개요

모바일 앱에서 사용할 Access Token과 Refresh Token을 발급하는 API 엔드포인트를 구현합니다.

## 구현 방법

### 1. API 엔드포인트 생성

**파일**: `apps/main/src/app/(backend)/api/auth/mobile/token/route.ts`

```typescript
import { auth } from '@auth';
import { encode } from '@auth/core/jwt';
import { error, ok } from '@/server/api/response';
import { ApiException, throwApi } from '@/server/api/errors';
import { env } from '@/share/configs/environments/server-constants';
import { saveRefreshToken } from '@/server/database/redis/session/refresh-store-redis';
import { generateUUID } from '@/share/share-utils/id-utils';
import { getSessionConfig } from '@/server/auth/auth-config';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * 모바일용 토큰 발급
 * 
 * POST /api/auth/mobile/token
 * 
 * 요청: 없음 (세션 쿠키에서 자동으로 세션 확인)
 * 응답: {
 *   success: true,
 *   data: {
 *     accessToken: string,
 *     refreshToken: string,
 *     expiresIn: string, // 예: "5m", "1h", "30d"
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
    // 1. NextAuth 세션 확인
    const session = await auth();
    if (!session?.user?.id) {
      return error('UNAUTHORIZED', '인증이 필요합니다.', {
        user: undefined,
      });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;
    const userName = session.user.name;
    const userImage = session.user.image;

    // 2. Access Token 생성 (JWT)
    // NextAuth의 JWT 인코딩 방식과 동일하게 생성
    const sessionConfig = getSessionConfig();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + sessionConfig.maxAge;

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
      maxAge: sessionConfig.maxAge,
    });

    // 3. Refresh Token 생성 (랜덤 문자열)
    // Refresh Token은 Opaque Token으로 생성 (JWT가 아닌 랜덤 문자열)
    const refreshToken = crypto.randomBytes(32).toString('hex');

    // 4. Refresh Token을 Redis에 저장
    // TTL은 Access Token보다 길게 설정 (예: 30일)
    const refreshTokenTTL = 30 * 24 * 60 * 60; // 30일 (초)
    await saveRefreshToken(userId, refreshToken, refreshTokenTTL);

    // 5. 응답 반환
    return ok(
      {
        accessToken,
        refreshToken,
        expiresIn: `${sessionConfig.maxAge}s`, // 초 단위
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
    console.error('[POST /api/auth/mobile/token] Error:', err);

    if (err instanceof ApiException) {
      const session = await auth().catch(() => null);
      return error(err.code, err.message, {
        user: session?.user?.id
          ? { id: session.user.id, email: session.user.email || undefined }
          : undefined,
        details: err.details,
      });
    }

    return error('INTERNAL', '토큰 발급 중 오류가 발생했습니다.', {
      details: err instanceof Error ? { message: err.message } : undefined,
    });
  }
}
```

### 2. Refresh Token API 엔드포인트 생성

**파일**: `apps/main/src/app/(backend)/api/auth/refresh/route.ts`

```typescript
import { auth } from '@auth';
import { encode } from '@auth/core/jwt';
import { error, ok } from '@/server/api/response';
import { ApiException, throwApi } from '@/server/api/errors';
import { env } from '@/share/configs/environments/server-constants';
import { loadRefreshToken, rotateRefreshToken } from '@/server/database/redis/session/refresh-store-redis';
import { getSessionConfig } from '@/server/auth/auth-config';
import { z } from 'zod';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Refresh Token으로 Access Token 갱신
 * 
 * POST /api/auth/refresh
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
    const raw = await request.json().catch(() => undefined);
    const parsed = refreshRequestSchema.safeParse(raw);

    if (!parsed.success) {
      throwApi('BAD_REQUEST', '요청 본문이 올바르지 않습니다.', {
        issues: parsed.error.flatten(),
      });
    }

    const { refreshToken } = parsed.data;

    // 2. Refresh Token 검증 및 사용자 ID 조회
    const userId = await loadRefreshToken(refreshToken);
    if (!userId) {
      throwApi('UNAUTHORIZED', '유효하지 않은 Refresh Token입니다.', {
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    // 3. 사용자 정보 조회 (세션에서 가져오거나 DB에서 조회)
    // 참고: 세션이 없어도 Refresh Token으로 인증 가능해야 하므로,
    // DB에서 직접 조회해야 할 수 있습니다.
    const session = await auth().catch(() => null);
    
    // 세션이 있으면 세션 정보 사용, 없으면 DB에서 조회
    let userEmail: string | undefined;
    let userName: string | undefined;
    let userImage: string | undefined;

    if (session?.user?.id === userId) {
      userEmail = session.user.email || undefined;
      userName = session.user.name || undefined;
      userImage = session.user.image || undefined;
    } else {
      // DB에서 사용자 정보 조회
      // TODO: UserRepository를 사용하여 사용자 정보 조회
      // const usersRepo = new UsersRepository();
      // const user = await usersRepo.getById(userId);
      // userEmail = user?.email;
      // userName = user?.name;
      // userImage = user?.image;
      throwApi('UNAUTHORIZED', '사용자 정보를 찾을 수 없습니다.', {
        code: 'USER_NOT_FOUND',
      });
    }

    // 4. 새 Access Token 생성
    const sessionConfig = getSessionConfig();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + sessionConfig.maxAge;

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
      maxAge: sessionConfig.maxAge,
    });

    // 5. Refresh Token 로테이션 (선택사항)
    // 보안을 위해 Refresh Token도 주기적으로 갱신할 수 있습니다.
    const shouldRotate = true; // 또는 특정 조건에 따라 결정
    let newRefreshToken: string | undefined;

    if (shouldRotate) {
      newRefreshToken = crypto.randomBytes(32).toString('hex');
      const refreshTokenTTL = 30 * 24 * 60 * 60; // 30일
      await rotateRefreshToken(userId, refreshToken, newRefreshToken, refreshTokenTTL);
    }

    // 6. 응답 반환
    return ok(
      {
        accessToken,
        ...(newRefreshToken && { refreshToken: newRefreshToken }),
        expiresIn: `${sessionConfig.maxAge}s`,
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
    console.error('[POST /api/auth/refresh] Error:', err);

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
```

### 3. Redis Refresh Token 저장 함수 확인

**파일**: `apps/main/src/server/database/redis/session/refresh-store-redis.ts`

현재 프로젝트에 이미 `saveRefreshToken`, `loadRefreshToken`, `rotateRefreshToken` 함수가 있는지 확인하고, 없으면 구현해야 합니다.

**필요한 함수들:**
- `saveRefreshToken(userId: string, refreshToken: string, ttl?: number): Promise<void>`
- `loadRefreshToken(refreshToken: string): Promise<string | null>` // userId 반환
- `rotateRefreshToken(userId: string, oldToken: string, newToken: string, ttl?: number): Promise<void>`

### 4. 로그아웃 API 수정

**파일**: `apps/main/src/app/(backend)/api/auth/logout/route.ts` (또는 기존 로그아웃 핸들러)

Refresh Token도 삭제하도록 수정:

```typescript
import { deleteRefreshToken } from '@/server/database/redis/session/refresh-store-redis';

// 로그아웃 시 Refresh Token도 삭제
// userId를 알 수 있는 경우
await deleteRefreshToken(userId);
```

## 주요 포인트

### 1. Access Token 생성
- NextAuth의 `encode` 함수를 사용하여 JWT 생성
- NextAuth 세션과 동일한 형식으로 생성하여 호환성 유지
- `salt: 'authjs.session-token'` 사용 (NextAuth 기본값)

### 2. Refresh Token 생성
- Opaque Token (랜덤 문자열) 사용
- JWT가 아닌 이유: 토큰 무효화가 쉽고, 서버에서 완전히 제어 가능
- Redis에 저장하여 분산 환경에서도 관리 가능

### 3. 보안 고려사항
- Refresh Token은 HTTPS로만 전송
- Refresh Token은 SecureStore에만 저장 (모바일)
- Refresh Token 로테이션 (선택사항)
- Access Token은 짧은 수명 (예: 5분~1시간)
- Refresh Token은 긴 수명 (예: 30일)

### 4. 에러 처리
- 유효하지 않은 Refresh Token: 401 Unauthorized
- 만료된 Refresh Token: 401 Unauthorized
- 서버 오류: 500 Internal Server Error

## 테스트

### 1. 토큰 발급 테스트
```bash
# 세션 쿠키가 있는 상태에서
curl -X POST http://localhost:3000/api/auth/mobile/token \
  -H "Content-Type: application/json" \
  --cookie "authjs.session-token=..."
```

### 2. 토큰 갱신 테스트
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "..."}'
```

## 참고 자료

- [NextAuth.js JWT Operations](https://authjs.dev/reference/core/jwt)
- [NextAuth.js Session Management](https://authjs.dev/getting-started/session-management)
- 프로젝트 내 기존 구현:
  - `apps/main/src/app/(backend)/api/arcyou/chat/ws/token/route.ts` - JWT 생성 예시
  - `apps/main/src/server/auth/token-service.ts` - OAuth 토큰 갱신 예시


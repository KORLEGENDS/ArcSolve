## 인증 개요 (Better Auth)

- **목표**: 기존 도메인 사용자 스키마(`users` 테이블, `uuid` 기반)는 그대로 유지하면서, **인증/세션/소셜 로그인 레이어만 Better Auth로 완전히 교체**합니다.
- **핵심 포인트**
  - 서버 진입점은 `apps/main/auth.ts` 하나로 고정 (`auth()`, `handlers`, `betterAuth` export).
  - 세션은 **DB 세션(쿠키 + `auth_session`)** 기반이며, 클라이언트는 `better-auth/react` 클라이언트(`authClient`) 사용.
  - Kakao / Naver 소셜 로그인을 Better Auth의 공식 `socialProviders`로 사용.
  - **도메인 유저 id(`users.id`, uuid)** 와 **Better Auth user id(`auth_user.id`, text)** 를 `users.authUserId` 컬럼으로 매핑하여 연결.

---

## 데이터 모델

### 1. 도메인 유저 (`public.users`)

- 파일: `src/share/schema/drizzles/user-drizzle.ts`
- 테이블: `public.users`
- 주요 컬럼:
  - `id` (`uuid`, PK): 도메인 전역에서 사용하는 **권위 있는 사용자 id**.
  - `created_at`, `updated_at`, `deleted_at`
  - `auth_user_id` (`text`, UNIQUE, nullable)
    - Better Auth의 `auth_user.id`와 1:1 매핑.
    - 로그인 플로우에서 Better Auth user와 연결할 때 사용.
  - `email` (`varchar(255)`, UNIQUE)
  - `name` (`varchar(100)`)
  - `image_url` (`text`)
  - `preferences` (`jsonb`)

> **도메인 규칙**:  
> - 비즈니스 로직, FK, 조회/권한 체크 등은 모두 `users.id (uuid)`를 기준으로 합니다.  
> - `auth_user_id`는 오직 “Better Auth 유저와의 링크” 역할만 담당합니다.

### 2. Better Auth 전용 테이블 (`public.auth_*`)

- 파일: `src/share/schema/drizzles/auth-drizzle.ts`
- 스키마: `public` (테이블 이름에 `auth_` 접두사)

#### `public.auth_user`

- 컬럼:
  - `id` (`text`, PK)  
  - `name` (`text`, NOT NULL)
  - `email` (`text`, NOT NULL, UNIQUE)
  - `email_verified` (`boolean`, DEFAULT false, NOT NULL)
  - `image` (`text`)
  - `created_at` (`timestamp`, DEFAULT now())
  - `updated_at` (`timestamp`, DEFAULT now())

#### `public.auth_account`

- 컬럼:
  - `id` (`text`, PK)
  - `account_id` (`text`, NOT NULL)
  - `provider_id` (`text`, NOT NULL) — `'kakao' | 'naver' | ...`
  - `user_id` (`text`, NOT NULL) — FK → `auth_user.id`
  - `access_token`, `refresh_token`, `id_token` (`text`)
  - `access_token_expires_at`, `refresh_token_expires_at` (`timestamp`)
  - `scope`, `password` (`text`)
  - `created_at`, `updated_at` (`timestamp`)
- 인덱스:
  - `auth_account_user_id_idx` (`user_id`)

#### `public.auth_session`

- 컬럼:
  - `id` (`text`, PK)
  - `expires_at` (`timestamp`, NOT NULL)
  - `token` (`text`, UNIQUE, NOT NULL)
  - `created_at`, `updated_at` (`timestamp`)
  - `ip_address`, `user_agent` (`text`)
  - `user_id` (`text`, NOT NULL) — FK → `auth_user.id`
- 인덱스:
  - `auth_session_user_id_idx` (`user_id`)

#### `public.auth_verification`

- 컬럼:
  - `id` (`text`, PK)
  - `identifier` (`text`, NOT NULL)
  - `value` (`text`, NOT NULL) — OAuth state / 코드 검증용 payload(JSON 문자열)
  - `expires_at` (`timestamp`, NOT NULL)
  - `created_at`, `updated_at` (`timestamp`)
- 인덱스:
  - `auth_verification_identifier_idx` (`identifier`)

> **역할 정리**
> - `auth_user` / `auth_account`: 소셜 계정 및 사용자의 최소 프로필.
> - `auth_session`: Better Auth 세션(쿠키 기반).
> - `auth_verification`: OAuth state / verification token 저장.
> - `users`: 도메인 유저(서비스 로직, FK, 권한 등)의 기준 테이블.

---

## 엔트리 포인트 및 파일 구조

### 1. 서버 엔트리 (`apps/main/auth.ts`)

- export:
  - `auth()`: 서버에서 세션 조회용 래퍼.
  - `handlers`: `/api/auth/*` Next.js Route Handler에 연결할 핸들러.
  - `betterAuth`: Better Auth 인스턴스(직접 사용이 필요한 경우).

```ts
import { betterAuth } from '@/server/auth/better-auth';
import { db } from '@/server/database/postgresql/client-postgresql';
import { users } from '@/share/schema/drizzles/user-drizzle';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

export type AppSession = typeof betterAuth.$Infer.Session;

export default betterAuth;

export async function auth(): Promise<AppSession | null> {
  const session = await betterAuth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return session;
  }

  // Better Auth user.id(auth_user.id) → 도메인 users.id(uuid) 매핑
  const authUserId = session.user.id;

  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, authUserId))
      .limit(1);

    if (rows.length > 0) {
      // 기존 코드와 호환되도록, 세션에서 사용하는 id를 도메인 users.id로 덮어쓴다.
      (session.user as any).id = rows[0].id;
    }
  } catch {
    // 매핑 실패 시에는 authUserId 그대로 유지 (로그인은 유지)
  }

  return session;
}

export const handlers = toNextJsHandler(betterAuth.handler);
```

> **주의**:  
> - 서버 코드(`auth()`를 사용하는 API/서버 컴포넌트)는 항상 `session.user.id`를 **도메인 users.id(uuid)** 로 받게 됩니다.  
> - 클라이언트 `authClient.useSession()`에서 받는 `user.id`는 Better Auth 세션 타입 그대로(text)일 수 있으니, 도메인 uuid를 강제할 필요가 있을 때는 서버를 경유합니다.

### 2. Better Auth 인스턴스 (`src/server/auth/better-auth.ts`)

- 역할:
  - Drizzle 어댑터 설정 (Postgres + public.auth_* 테이블).
  - Kakao / Naver 소셜 provider 등록.
  - Expo 플러그인 설정 (모바일/Expo 연동).
  - `databaseHooks.user.create.after` 에서 `auth_user` ↔ `users` 매핑.

핵심 부분(요약):

```ts
export const betterAuth = betterAuthInit();

function betterAuthInit() {
  const socialProviders = { kakao: { ... } } / { naver: { ... } } // env 기반

  return createBetterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: adapterUsers,         // auth_user
        account: adapterAccounts,   // auth_account
        session: adapterSessions,   // auth_session
        verification: adapterVerifications, // auth_verification
      },
    }),
    socialProviders: { ... },
    plugins: [expo()],
    trustedOrigins: [...],

    databaseHooks: {
      user: {
        create: {
          after: async (authUser) => {
            // 1) auth_user.id로 이미 매핑된 users가 있으면 업데이트
            // 2) 이메일로 users가 있으면 authUserId 채우고 업데이트
            // 3) 둘 다 없으면 새 users row 생성 (id는 uuid defaultRandom)
          },
        },
      },
    },
  });
}
```

### 3. 인증 라우트 (`/api/auth/[...auth]`)

- 파일: `src/app/(backend)/api/auth/[...auth]/route.ts`
- 내용:

```ts
import { handlers } from '@auth';

export const { GET, POST } = handlers;
```

- Better Auth의 모든 HTTP 엔드포인트(`/api/auth/*`)가 이 경로로 들어옵니다.

### 4. 미들웨어 / 프록시 (`src/proxy.ts`, `src/server/auth/edge-auth.ts`)

- `proxy.ts`
  - next-intl 라우팅 → Better Auth 세션 체크 → 인증 미들웨어 순으로 실행.
  - Node runtime 기준.
  - 예:

  ```ts
  const handleI18n = createMiddleware(routing);

  export const proxy = async (req: NextRequest): Promise<Response> => {
    const res = handleI18n(req as unknown as NextRequest);

    if (res.headers.get('x-middleware-next') !== null) {
      const session = await betterAuth.api
        .getSession({ headers: req.headers })
        .catch(() => null);
      const isLoggedIn = !!session;
      return authMiddleware(req, { isLoggedIn });
    }

    return res;
  };
  ```

- `edge-auth.ts`
  - 공개 경로: `/login`, `/docs`, `/components`, `/default`
  - 공개 API: `/api/auth/*` (Better Auth가 자체적으로 처리)
  - 나머지 API에 대해:
    - 비로그인: 401 JSON
    - 변이 메서드(POST/PUT/PATCH/DELETE): Origin/Referer 기반 CSRF 방어
  - 페이지에 대해:
    - 비로그인 + 비공개 경로: `/[locale]/login?next=...` 리다이렉트
    - 로그인 상태에서 `/login`: `/[locale]/` 홈으로 리다이렉트

---

## 클라이언트 인증 (`authClient`)

- 파일: `src/share/libs/auth/auth-client.ts`

```ts
'use client';

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  // 기본값: `/api/auth` 엔드포인트 사용
});
```

### 사용처 예시

- 로그인 페이지: `login/page.tsx`
  - `authClient.signIn.social({ provider: 'kakao' | 'naver', callbackURL, errorCallbackURL })`
- 프로필/유저 메뉴: `ArcUserProfile.tsx`
  - `const { data: session } = authClient.useSession();`
- 로그아웃 유틸: `logoutWithCacheClear` 등에서
  - `await authClient.signOut({ callbackURL: ... })`

> **주의**:  
> - 클라이언트의 `authClient.useSession()`은 Better Auth 세션 타입 그대로(text `user.id`)를 반환합니다.  
> - 도메인 uuid 기준 연산이 필요하면 서버(`auth()`)를 통해 수행합니다.

---

## 로그인 / 로그아웃 플로우 (Kakao / Naver)

1. **사용자 로그인 버튼 클릭**
   - `authClient.signIn.social({ provider: 'kakao' | 'naver', callbackURL, errorCallbackURL })`

2. **Better Auth `/api/auth/*` 엔드포인트**
   - `/api/auth/sign-in/social` → Kakao/Naver OAuth 시작.
   - state / codeVerifier / callbackURL 정보는 `auth_verification`에 저장.

3. **Kakao / Naver 승인 후 콜백**
   - `/api/auth/callback/kakao`, `/api/auth/callback/naver`
   - Better Auth가:
     - `auth_user` row 생성/업데이트.
     - `auth_account` row 생성/업데이트.
     - `auth_session` row 생성, 세션 쿠키 세팅.
   - `databaseHooks.user.create.after`를 통해:
     - `users.authUserId`를 채우고,
     - 필요 시 새 `users` row 생성.

4. **리다이렉트**
   - 성공 시: 지정한 `callbackURL`로 이동.
   - 실패 시: `errorCallbackURL` (예: `/login?error=oauth`) 로 이동.

5. **이후 요청**
   - 서버:
     - `const session = await auth();`
     - `session.user.id`는 도메인 `users.id (uuid)` 로 정규화된 값.
   - 클라이언트:
     - `authClient.useSession()`으로 세션 상태 구독.

6. **로그아웃**
   - `authClient.signOut({ callbackURL })` 호출.
   - Better Auth가 `auth_session` 및 쿠키 정리, 지정한 URL로 리다이렉트.

---

## 운영 및 참고 사항

- **스키마 관리**
  - Drizzle 스키마는 `src/share/schema/drizzles/index.ts`에서 export.
  - 마이그레이션:
    - 생성: `pnpm drizzle:dev:gen`
    - 적용: `pnpm drizzle:dev:migrate`

- **사용자 id 일관성**
  - 도메인 레이어(문서, 채팅 등)는 항상 `users.id (uuid)`만 사용.
  - Better Auth의 `auth_user.id`는 내부/연동용 id이며, `users.authUserId`를 통해 연결.

- **트러블슈팅 팁**
  - `invalid input syntax for type uuid` 에러가 다시 발생하면:
    - 해당 쿼리에 전달된 `user_id`가 Better Auth `auth_user.id`인지, `users.id`인지 확인.
    - 서버 코드에서 `auth()`를 사용했는지, 또는 클라이언트 세션 id를 그대로 썼는지 점검.

## 인증 개요 (Better Auth)

- **단일 진입점**: `apps/main/auth.ts`에서 `auth`, `handlers`, `betterAuth`를 export
- **세션 전략**: Better Auth DB 세션(`auth.session` 테이블, 쿠키 기반)
- **가드 순서**: i18n → 인증 미들웨어 → 라우트
- **데이터 저장**:
  - Better Auth용: Postgres `auth` 스키마(`user`, `account`, `session`, `verification`)
  - 앱 사용자용: Postgres `users` 테이블(도메인 프로필/설정용)

---

## 파일 구조와 책임

- **공통 엔트리**
  - `apps/main/auth.ts`: Better Auth 인스턴스를 감싼 파사드
    - `auth()`: 서버에서 세션 조회
    - `handlers`: `/api/auth/*` 라우트 핸들러
    - `betterAuth`: 원본 Better Auth 인스턴스

- **라우트 핸들러**
  - `apps/main/src/app/(backend)/api/auth/[...auth]/route.ts`: `handlers`의 `GET/POST` 재노출 (Better Auth 표준 엔드포인트)

- **미들웨어**
  - `apps/main/src/proxy.ts`: next-intl(i18n) → 인증 미들웨어 순으로 실행, `betterAuth.api.getSession`으로 로그인 여부 판단
  - `apps/main/src/server/auth/edge-auth.ts`: 공개 경로/공개 API 가드, API 변이 요청 Origin/Referer 기반 CSRF 방어

- **Better Auth 설정**
  - `apps/main/src/server/auth/better-auth.ts`: Kakao/Naver provider, Drizzle 어댑터, Expo 플러그인, trustedOrigins 설정

- **스키마**
  - Better Auth용(auth 스키마): `apps/main/src/share/schema/drizzles/auth-drizzle.ts`
  - 앱 사용자(users): `apps/main/src/share/schema/drizzles/user-drizzle.ts`

---

## 스키마 요약 (Better Auth 공식 PG 스키마)

- `auth.user`
  - `id`, `name`, `email`, `email_verified`, `image`, `created_at`, `updated_at`
- `auth.account`
  - `id`, `user_id`, `account_id`, `provider_id`
  - 선택: `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at`
- `auth.session`
  - `id`, `user_id`, `token`, `expires_at`, `ip_address`, `user_agent`, `created_at`, `updated_at`
- `auth.verification`
  - `id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at`

---

## 로그인 플로우 (Kakao / Naver, Better Auth)

- **1) 요청 진입: i18n → 인증 가드**
  - 파일: `proxy.ts`, `server/auth/edge-auth.ts`
  - i18n 라우팅 이후, 비로그인 사용자는 `/[locale]/login` 으로 리다이렉트

- **2) 로그인 페이지 렌더**
  - 파일: `src/app/(frontend)/[locale]/(non-user)/login/page.tsx`
  - Kakao/Naver 로그인 버튼 노출

- **3) 로그인 트리거 (클라이언트)**
  - 파일: `src/share/libs/auth/auth-client.ts`
  - `authClient.signIn.social({ provider: 'kakao' | 'naver', callbackURL, errorCallbackURL })`

- **4) Better Auth 핸들러**
  - 파일: `src/app/(backend)/api/auth/[...auth]/route.ts`
  - `/api/auth/*` 라우트(`sign-in/social`, `callback/[provider]`, `get-session` 등)를 처리

- **5) OAuth 승인/콜백**
  - 파일: `src/server/auth/better-auth.ts`
  - Kakao/Naver로 리다이렉트 → 콜백(`/api/auth/callback/[provider]`)에서 `auth.user`/`auth.account` 저장

- **6) 세션 생성 및 조회**
  - 세션은 `auth.session` 테이블에 저장되고, 쿠키와 연동
  - 서버에서는 `await auth()` 또는 `betterAuth.api.getSession({ headers })`로 조회

---

## 라우팅 및 i18n 규칙

- 절대 금지: `next/link`, `next/navigation` 직접 사용
- 항상 `@/share/i18n/routing` 사용
  - 클라이언트: `Link`, `useRouter`, `usePathname`
  - 서버: `redirect`, 경로 유틸(`extractLocaleFromPathname`, `getLocalizedPath`, ...)
- 모든 링크는 locale 없이 작성하면 접두어는 자동 부여됨(`localePrefix: 'always'`)



## 인증 개요 (NextAuth v5)

- 단일 진입점: `apps/main/auth.ts`에서 `auth`, `handlers`, `signIn`, `signOut`을 export
- 세션 전략: JWT(권장), 고정 TTL 30일
- 가드 순서: i18n → 인증 미들웨어 → 라우트
- 데이터 저장:
  - Auth 어댑터용: Postgres `auth` 스키마(`user`, `account`)
  - 앱 사용자용: Postgres `users` 테이블(최소 필드)
  - Refresh Token: Redis 저장 및 임박 시 AccessToken 갱신

### 필수 환경 변수
- `AUTH_SECRET` (필수)
- `AUTH_KAKAO_ID`, `AUTH_KAKAO_SECRET`
- `AUTH_NAVER_ID`, `AUTH_NAVER_SECRET`
- 리버스 프록시 환경: `AUTH_TRUST_HOST=true`
- 프리뷰 배포(OAuth 사용): `AUTH_REDIRECT_PROXY_URL` + 동일 `AUTH_SECRET`

---

## 파일 구조와 책임

- 공통 엔트리
  - `apps/main/auth.ts`: `NextAuth(authConfig)` 결과로 `auth`, `handlers`, `signIn`, `signOut` 제공

- 라우트 핸들러
  - `apps/main/src/app/(backend)/api/auth/[...nextauth]/route.ts`: `handlers`의 `GET/POST` 재노출

- 미들웨어
  - `apps/main/src/proxy.ts`: next-intl(i18n) → 인증 미들웨어 순으로 실행
  - `apps/main/src/server/auth/edge-auth.ts`: Edge-safe 인증 미들웨어, 공개 경로/공개 API 가드, API 변이 요청 Origin/Referer 기반 CSRF 방어

- 인증 설정
  - `apps/main/src/server/auth/auth-config.ts`: Kakao/Naver provider, JWT/세션 콜백, 사용자 생성 이벤트, RefreshToken 저장
  - `apps/main/src/server/auth/token-service.ts`: RefreshToken 기반 AccessToken 갱신

- 스키마
  - 어댑터용(auth 스키마): `apps/main/src/share/schema/drizzles/auth-adapter-drizzle.ts`
  - 앱 사용자(users): `apps/main/src/share/schema/drizzles/user-drizzle.ts`

---

## 스키마 요약

### Auth 어댑터(Postgres schema: auth)
- `auth.user`
  - `id`, `name`, `email`, `emailVerified`, `image`
- `auth.account`
  - 필수: `userId`, `type`, `provider`, `providerAccountId`
  - 선택: `refresh_token`, `access_token`, `expires_at`, `token_type`, `scope`, `id_token`, `session_state`

### 앱 사용자(Postgres table: users)
- 보유 필드(최소화): `id`, `email`, `name`, `imageUrl`, `preferences`, `createdAt`, `updatedAt`, `deletedAt`
- 역할(role) 제거됨. 전역 권한은 사용하지 않으며, 리소스 단위 권한은 도메인 스키마에서 별도 관리

---

## 로그인 플로우 단계

### 1) 요청 진입: i18n → 인증 가드
- 파일:
  - `apps/main/src/proxy.ts`
  - `apps/main/src/server/auth/edge-auth.ts`
- 동작:
  - i18n 라우팅 이후, 인증 미들웨어가 비로그인 사용자를 로케일 포함 로그인 페이지(`/[locale]/login`)로 리다이렉트
  - API 변이 요청(POST/PUT/PATCH/DELETE)은 Origin/Referer 검사로 CSRF 방어

### 2) 로그인 페이지 렌더
- 파일:
  - `apps/main/src/app/(frontend)/[locale]/(non-user)/login/page.tsx`
- 동작:
  - 로케일이 포함된 로그인 페이지로 이동, 프로바이더 로그인 버튼 노출

### 3) 로그인 트리거(서버 액션 권장)
- 파일:
  - `apps/main/auth.ts` (`signIn` export)
- 동작:
  - 서버 액션 또는 클라이언트에서 `await signIn('kakao' | 'naver')` 호출로 표준 폼 POST 플로우 시작
- 예시(서버 액션):
```ts
'use server';
import { signIn } from '@auth';

export async function loginWithKakao(): Promise<void> {
  await signIn('kakao'); // 기본값: 현재 컨텍스트 복귀
}
```

### 4) NextAuth 핸들러
- 파일:
  - `apps/main/src/app/(backend)/api/auth/[...nextauth]/route.ts`
- 동작:
  - `/api/auth/*` 라우트(`signin`, `callback`, `session` 등)를 표준 핸들러가 처리

### 5) OAuth 승인/콜백
- 파일:
  - `apps/main/src/server/auth/auth-config.ts` (providers 설정)
- 동작:
  - Kakao/Naver로 리다이렉트 → 승인 후 콜백(`/api/auth/callback/[provider]`)

### 6) 사용자 저장/업데이트(events.createUser)
- 파일:
  - `apps/main/src/server/auth/auth-config.ts` (events.createUser)
  - `apps/main/src/share/schema/drizzles/user-drizzle.ts`
- 동작:
  - 이메일 기준 존재 여부 확인
  - 최초: `users`에 `id/email/name/imageUrl` 등 저장
  - 재방문: 필요한 필드만 업데이트(`name`, `imageUrl`, `updatedAt`)

### 7) JWT 생성/임박 갱신(callbacks.jwt)
- 파일:
  - `apps/main/src/server/auth/auth-config.ts` (callbacks.jwt)
  - `apps/main/src/server/auth/token-service.ts`
- 동작:
  - 최초 로그인: `sub/email/name/image/provider`를 JWT에 저장, 만료는 고정 TTL(30일)
  - RefreshToken이 있으면 Redis에 저장
  - 세션 업데이트 트리거 시 만료 임박 판단 후 AccessToken 갱신

### 8) 세션 객체 구성(callbacks.session)
- 파일:
  - `apps/main/src/server/auth/auth-config.ts` (callbacks.session)
- 동작:
  - `session.user`에 `id/email/name/image` 설정

### 9) 리다이렉트
- 파일:
  - `apps/main/src/server/auth/auth-config.ts` (pages 설정)
  - `apps/main/src/server/auth/edge-auth.ts`
- 동작:
  - 기본적으로 현재 페이지 복귀
  - 로그인 상태에서 `/login` 접근 시 홈(`/[locale]/`)으로 리다이렉트

### 10) 서버 전역에서 세션 조회
- 파일:
  - `apps/main/auth.ts` (`auth` export)
- 동작:
  - 서버 컴포넌트/Route Handler/미들웨어 등 어디서나 `const session = await auth()` 호출로 동일하게 세션 조회

---

## 라우팅 및 i18n 규칙
- 절대 금지: `next/link`, `next/navigation` 직접 사용
- 항상 `@/share/i18n/routing` 사용
  - 클라이언트: `Link`, `useRouter`, `usePathname`
  - 서버: `redirect`, 경로 유틸(`extractLocaleFromPathname`, `getLocalizedPath`, ...)
- 모든 링크는 locale 없이 작성하면 접두어는 자동 부여됨(`localePrefix: 'always'`)
- 토스트/알림 문구도 `next-intl` 메시지 사용 필수

---

## 운영 팁
- 세션은 JWT 전략으로 DB 세션 테이블이 불필요
- 전역 role은 사용하지 않음(도메인별 권한은 각 스키마에서 관리)
- 민감 API는 미들웨어 가드에만 의존하지 말고, 실제 데이터 접근 직전에 `await auth()`로 재검증
- Refresh Token은 Redis에서 관리되며 레이스 방지를 위해 분산락 사용


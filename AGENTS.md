# ArcYou 개발 가이드

## 프로젝트 구조

### 최상위 레이어 (실행 환경 분리)
```
src/
├── app/      → Next.js App Router (라우팅 정의만)
├── client/   → 클라이언트 전용 (브라우저)
├── server/   → 서버 전용 (Node.js)
├── share/    → 공유 코드 (양쪽 사용)
└── proxy.ts  → 미들웨어
```
- `client/` ↔ `server/` 상호 참조 금지
- `share/`만 양쪽에서 사용 가능

### App Router
```
app/(backend)/api/              → API 엔드포인트
app/(frontend)/[locale]
  ├── (non-user)/               → 비로그인 페이지
  └── (user)/                   → 로그인 페이지
```

### Client
```
client/
├── components/
│   ├── ui-base/    → 기본 컴포넌트 (Button, Input)
│   ├── ui-core/    → 비즈니스 컴포넌트 (Logo, Sidebar)
│   └── ui-service/ → 복합 컴포넌트
├── states/
│   ├── react-query/ → 서버 상태 (API 데이터)
│   └── zustand/     → 클라이언트 상태 (UI)
└── i18n/
```

### Server
```
server/
├── auth/
├── database/
│   ├── postgresql/
│   └── redis/
└── server-utils/
```

### Share (공유 레이어)
```
share/
├── api/          → client/server API 유틸
├── configs/      → 상수, 환경변수, 아이콘
├── providers/    → client/server Provider
├── schema/
│   ├── drizzles/     → ORM 스키마
│   ├── repositories/ → Repository 패턴
│   ├── mappers/      → DTO 변환
│   └── zod/          → 런타임 검증
├── share-utils/  → 공통 유틸
└── types/        → 타입 정의
```

**데이터 흐름:**
```
요청 → Zod 검증 → Repository → Drizzle ORM → DB
응답 ← Mapper ← Repository ← Drizzle ← DB
```

**설계 원칙:**
- 실행 환경 경계 명확 (client/server/share)
- 컴포넌트 계층: base → core → service
- 상태 관리: react-query(서버) + zustand(클라이언트)
- 타입 안정성: Zod + TypeScript + Drizzle
- Repository 패턴으로 데이터 접근 캡슐화

---

## 미들웨어
- **Next.js 16**: `src/proxy.ts`
- **순서**: i18n → 인증

---

## 다국어 (i18n)

### 설정
- 라이브러리: `next-intl` v4.4.0
- 지원: `ko` (기본), `en`
- 위치: `src/client/i18n/messages/{locale}.json`

### 사용법
```json
// ko.json, en.json
{ "Common": { "hello": "안녕하세요" } }
```

```tsx
// 클라이언트
'use client';
import { useTranslations } from 'next-intl';
const t = useTranslations('Common');
<button>{t('hello')}</button>

// 서버
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('Common');
<h1>{t('hello')}</h1>

// 동적 값
{ "greeting": "{name}님 환영합니다" }
t('greeting', { name: '홍길동' })
```

### URL 규칙
- 기본(ko): `/ko`, `/ko/login`
- 영어: `/en`, `/en/login`
- 설정: `localePrefix: 'always'`

### 네비게이션 (Link, redirect, router)
**❌ 절대 금지: `next/link`, `next/navigation` 직접 사용**

항상 `@/share/i18n/routing` 사용:

```tsx
// ❌ 금지
import Link from 'next/link';
import { redirect, useRouter } from 'next/navigation';

// ✅ 권장
import { Link, redirect, useRouter, usePathname, getPathname } from '@/share/i18n/routing';

// 클라이언트 컴포넌트
function MyComponent() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <>
      {/* 현재 locale이 ko면 /ko/about, en이면 /en/about */}
      <Link href="/about">소개</Link>
      <button onClick={() => router.push('/settings')}>설정</button>
    </>
  );
}

// 서버 컴포넌트/액션
async function myAction() {
  // localePrefix: 'always' 환경에서는 최종 URL이 항상 접두어를 가짐
  redirect('/login');
}
```

### ⚠️ 주의
1. 토스트/알림도 i18n 필수:
```tsx
// ❌ 금지
sonnerToast('처리 중...');

// ✅ 권장
const t = useTranslations('Common');
sonnerToast(t('loading'));
```

2. 모든 라우팅은 '@/share/i18n/routing' 사용:
```tsx
// ❌ 금지
import Link from 'next/link';

// ✅ 권장
import { Link } from '@/share/i18n/routing';
```

---

## 체크리스트

### 다국어 메시지 추가 시
- [ ] `ko.json`, `en.json` 동일 키 구조 추가
- [ ] 하드코딩 제거
- [ ] `useTranslations` 또는 `getTranslations` 사용
- [ ] 동적 값은 `{변수명}` 형식

### 네비게이션/라우팅 추가 시
- [ ] `next/link` 대신 `@/share/i18n/routing`의 `Link` 사용
- [ ] `next/navigation`의 `redirect`, `useRouter` 대신 `@/share/i18n/routing`의 것 사용
- [ ] 모든 링크는 locale 없이 작성 (예: `/about`) - locale은 자동 추가됨
  - 서버 파일은 `extractLocaleFromPathname`, `removeLocaleFromPathname`, `getLocalizedPath`만 사용

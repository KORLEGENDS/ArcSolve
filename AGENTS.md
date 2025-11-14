# ArcYou 개발 가이드

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

## 기능 추가 구현 순서

새로운 기능(예: 친구 요청 수락/거절/취소, 친구 삭제 등)을 추가할 때는 다음 순서로 구현합니다:

### 1. 리포지토리 메서드 추가
**위치**: `src/share/schema/repositories/arcyou-chat-relation-repository.ts`

**이유**: 
- 데이터베이스 로직을 Repository 패턴으로 캡슐화
- 비즈니스 로직과 데이터 접근 로직 분리
- 트랜잭션 관리 및 에러 처리 중앙화

**방식**:
- Drizzle ORM을 사용한 쿼리 작성
- 트랜잭션 내에서 데이터 조회/수정/삭제 수행
- `throwApi`를 사용한 명확한 에러 처리
- 반환 타입은 스키마 타입(`ArcyouChatRelation`) 또는 커스텀 타입(`RelationshipWithTargetUser`) 사용

### 2. API 라우트 핸들러 추가
**위치**: `src/app/(backend)/api/arcyou/relation/route.ts`

**이유**:
- HTTP 요청을 받아 리포지토리 메서드 호출
- 인증/인가 검증 수행
- 요청/응답 형식 표준화 (`ok`, `error` 헬퍼 사용)
- 클라이언트와 서버 간 인터페이스 정의

**방식**:
- Next.js 16 App Router의 Route Handler 사용 (`GET`, `POST`, `PATCH`, `DELETE`)
- `auth()`로 세션 확인 및 사용자 ID 추출
- 요청 본문 파싱 및 유효성 검사
- 리포지토리 메서드 호출 후 응답 변환 (Date → ISO string 등)
- `ApiException` 처리 및 일반 에러 처리 분리

### 3. React Query 옵션 추가
**위치**: `src/share/libs/react-query/query-options.ts`

**이유**:
- 타입 안전한 API 호출 옵션 정의
- 쿼리/뮤테이션 옵션 재사용성 확보
- 응답 데이터 변환 로직 중앙화
- 캐싱 전략 일관성 유지

**방식**:
- 타입 정의: `MutationVariables`, `Response` 타입 추가
- `createApiQueryOptions` 또는 `createApiMutation` 사용
- URL 빌더, 데이터 추출 함수, HTTP 메서드 지정
- `bodyExtractor`로 요청 본문 형식 커스터마이징 (필요시)

### 4. React Query 훅 추가
**위치**: `src/share/api/client/useArcYou.ts`

**이유**:
- 클라이언트 컴포넌트에서 쉽게 사용할 수 있는 훅 제공
- 쿼리 무효화로 자동 새로고침 구현
- 로딩/에러 상태 관리

**방식**:
- `useQuery` 또는 `useMutation` 사용
- `onSuccess`에서 관련 쿼리 무효화 (`invalidateQueries`)
- 반환값에 함수, 로딩 상태, 에러 상태 포함
- 함수는 간단한 래퍼로 제공 (예: `acceptFriendRequest(userId)`)

### 5. UI 컴포넌트 수정
**위치**: 
- `src/client/components/arc/ArcYou/ArcYouRelation/components/ArcYouRelationItem.tsx` (버튼 추가)
- `src/client/components/arc/ArcYou/ArcYouRelation/ArcYouRelation.tsx` (핸들러 연결)

**이유**:
- 사용자 인터페이스에 기능 노출
- 상태에 따른 조건부 렌더링 (예: pending/accepted 상태별 버튼)
- 컴포넌트 재사용성 및 관심사 분리

**방식**:
- `ArcYouRelationItem`: 새로운 버튼 props 추가 (`onCancel`, `onDelete` 등)
- 조건부 렌더링: 상태와 `isReceivedRequest` 플래그로 버튼 표시 결정
- `ArcYouRelation`: `relationshipToItemProps` 헬퍼에서 핸들러 연결
- `useRef`로 핸들러 참조 안정화하여 불필요한 재렌더링 방지

### 6. 최상위 컴포넌트에서 핸들러 연결
**위치**: `src/app/(frontend)/[locale]/(user)/(core)/components/RightSidebarContent.tsx`

**이유**:
- React Query 훅에서 가져온 함수를 UI 컴포넌트에 전달
- 에러 처리 및 사용자 피드백 제공
- 상태 관리 (예: 입력 필드 초기화)

**방식**:
- `useArcYou` 훅에서 필요한 함수 추출
- `useCallback`으로 핸들러 함수 생성 (의존성 배열 관리)
- `ArcYouRelation` 컴포넌트에 props로 전달
- 에러는 React Query가 처리하므로 로그만 출력

### 구현 시 주의사항
1. **타입 일관성**: API 응답(ISO string)과 컴포넌트 props(Date 객체) 간 변환 필요
2. **상태 필터링**: 리포지토리에서 `pending`/`accepted`만 반환, 클라이언트에서 추가 필터링 불필요
3. **양방향 관계**: 친구 관계는 양방향이므로 삭제 시 양쪽 모두 처리
4. **재렌더링 최적화**: 핸들러를 `useRef`로 안정화하여 입력창 변경 시 불필요한 재렌더링 방지
5. **에러 처리**: `ApiException`은 명확한 메시지 제공, 일반 에러는 로깅 후 사용자에게 표시

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

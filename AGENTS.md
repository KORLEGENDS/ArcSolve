# 배경 지식
## 타입검사 - `pnpm type-check`, 린트 검사는 수행하지 않습니다.
## 사용자의 모든 입력은 검증되어야 하며, 서버측에서 악의적으로 동작하지 않도록 방어적으로 구현합니다.
## docs - md로 관련 정보를 업데이트 합니다.
0. 지식 탐색이 필요한 경우 docs/에 관련 정보가 있는지 확인합니다.
1. `docs/arcyou/`: arcyou 관련 로직을 업데이트한 경우
2. `docs/arcwork/`: arcwork 관련 로직을 업데이트한 경우

## docker
1. apps/docker-compose.dev.yml 에 docker의 모든 설정이 있으며
2. apps/.env.docker 에는 docker의 환경 변수가 있습니다.
3. uws-gateway, outbox-worker를 수정한 경우, 재빌드 후 재기동 필요합니다.
4. 내부 서비스는 이미지 빌드 시점에 코드가 복사되고, 컨테이너에는 dist만 들어가는 구조입니다. -> 이미지를 최신 코드 기준으로 재빌드 + 재기동

## arcyou - `docs/arcyou/` 에 기록
1. 일반적인 채팅 서비스와 동일한 기능을 제공
2. '일반 채팅방'과, '친구 목록 / 1:1 채팅 목록 / 그룹 채팅 목록'을 관리
3. 정책
  - 채팅방 생성
    - 1:1 채팅방: 생성 전, 이미 있는지 확인하여 이미 있는 경우, 추가 생성 없이 해당 채팅방 id 반환
    - 그룹 채팅방: 전체 그룹 채팅방 갯수 제한 확인 후 생성
  - 채팅방 업데이트
    - 채팅방 이름 변경: 로컬/원격 -> 모두 탭/목록 이름 동기화
4. api
  - `useArcYouRelation.ts`: 친구 관계 관리 (목록 조회, 요청 보내기/수락/거절/취소, 삭제, 검색)
  - `useArcyouChat.ts`: 채팅방 목록 조회/생성, 이름 수정, 멤버 조회, 활동 갱신 헬퍼
  - `useArcYouChatRoom.ts`: 개별 채팅방 WebSocket 연결 및 메시지 송수신/읽음 상태 관리
  - `useArcYouChatRooms.ts`: 채팅방 목록 실시간 갱신 (room-activity 스트림 구독)
  - `useArcYouSockets.ts`: 공통 WebSocket 핸드셰이크 유틸 (토큰 발급 및 연결 생성)
  - **사용 지침**: 
    - `useArcYouChatRooms`: 앱 최상위(RightSidebar)에서 한 번만 호출하여 전체 채팅방 목록 실시간 갱신
    - `useArcYouChatRoom`: 각 채팅방 컴포넌트에서 개별 호출, roomId 변경 시 자동으로 재연결 및 메시지 초기화
    - `useArcYouSockets`: 직접 사용 금지, `useArcYouChatRooms`와 `useArcYouChatRoom` 내부에서만 사용
    - WebSocket 연결은 공통 훅(`useArcYouGatewaySocket`)을 통해 일관되게 관리하며, 토큰 발급 실패 시 자동 재시도 없음

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

**방식**: Drizzle ORM 쿼리 작성 / 트랜잭션 내 데이터 조회/수정/삭제 / `throwApi` 에러 처리 / 반환 타입은 스키마 타입(`ArcyouChatRelation`) 또는 커스텀 타입(`RelationshipWithTargetUser`)

### 2. API 라우트 핸들러 추가
**위치**: `src/app/(backend)/api/arcyou/relation/route.ts`

**방식**: Next.js 16 Route Handler (`GET`, `POST`, `PATCH`, `DELETE`) / `auth()` 세션 확인 및 사용자 ID 추출 / 요청 본문 파싱 및 유효성 검사 / 리포지토리 메서드 호출 후 응답 변환 (Date → ISO string) / `ApiException` 처리 및 일반 에러 처리 분리

### 3. React Query 옵션 추가
**위치**: `src/share/libs/react-query/query-options.ts`

**방식**: `MutationVariables`, `Response` 타입 정의 / `createApiQueryOptions` 또는 `createApiMutation` 사용 / URL 빌더, 데이터 추출 함수, HTTP 메서드 지정 / `bodyExtractor`로 요청 본문 형식 커스터마이징 (필요시)

### 4. React Query 훅 추가
**위치**: `src/client/states/queries/arcyou/useArcYouRelation.ts`

**방식**: `useQuery` 또는 `useMutation` 사용 / `onSuccess`에서 관련 쿼리 무효화 (`invalidateQueries`) / 반환값에 함수, 로딩 상태, 에러 상태 포함 / 함수는 간단한 래퍼로 제공 (예: `acceptFriendRequest(userId)`)

### 5. UI 컴포넌트 수정
**위치**: 
- `src/client/components/arc/ArcYou/ArcYouRelation/components/ArcYouRelationItem.tsx` (버튼 추가)
- `src/client/components/arc/ArcYou/ArcYouRelation/ArcYouRelation.tsx` (핸들러 연결)

**방식**: `ArcYouRelationItem`에 새로운 버튼 props 추가 (`onCancel`, `onDelete` 등) / 조건부 렌더링: 상태와 `isReceivedRequest` 플래그로 버튼 표시 결정 / `ArcYouRelation`의 `relationshipToItemProps` 헬퍼에서 핸들러 연결 / `useRef`로 핸들러 참조 안정화

### 6. 최상위 컴포넌트에서 핸들러 연결
**위치**: `src/app/(frontend)/[locale]/(user)/(core)/components/RightSidebarContent.tsx`

**방식**: `useArcYouRelation` 훅에서 목록/액션/검색 결과를 추출하고, `useCallback`으로 UI 핸들러를 구성하여 `ArcYouRelation`과 채팅 생성 컴포넌트에 전달합니다. 에러는 React Query가 처리하므로 로그만 출력합니다.

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
- **클라이언트**: `useTranslations('Common')` 훅 사용
- **서버**: `getTranslations('Common')` 함수 사용
- **동적 값**: 중괄호 `{name}` 형식으로 변수 전달

### URL 규칙
- 기본(ko): `/ko`, `/ko/login`
- 영어: `/en`, `/en/login`
- 설정: `localePrefix: 'always'`

### 네비게이션 (Link, redirect, router)
**❌ 절대 금지: `next/link`, `next/navigation` 직접 사용**

**✅ 필수: `@/share/i18n/routing`에서 제공하는 래퍼 사용**
- `Link`, `redirect`, `useRouter`, `usePathname`, `getPathname` 등 모든 네비게이션 관련 함수는 반드시 `@/share/i18n/routing`에서 import

### ⚠️ 주의사항
1. **모든 사용자 대면 텍스트는 i18n 필수** (토스트, 알림, 에러 메시지 포함)
2. **모든 라우팅은 `@/share/i18n/routing` 사용** (Next.js 기본 모듈 직접 사용 금지)
3. **하드코딩된 한글/영어 텍스트 금지** (개발 중 임시 텍스트도 i18n 키로 관리)

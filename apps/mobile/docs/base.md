# Mobile App 구현 현황

## 개요

모바일 앱은 `apps/main`의 프론트엔드 구조를 참고하여 구현되었으며, 소셜 로그인(카카오/네이버)과 ArcAI 기능을 연동하는 것이 목표입니다.

## 프로젝트 구조

```
apps/mobile/src/
├── client/              # 클라이언트 전용 코드
│   ├── components/      # UI 컴포넌트
│   │   └── arc/
│   │       └── ArcAI/   # ArcAI 관련 컴포넌트
│   ├── screens/         # 화면 컴포넌트
│   │   ├── auth/        # 인증 화면
│   │   ├── home/        # 홈 화면
│   │   └── ai/          # AI 채팅 화면
│   ├── states/          # 상태 관리
│   │   ├── queries/     # React Query 훅
│   │   │   ├── auth/    # 인증 관련 훅
│   │   │   └── ai/      # AI 관련 훅
│   │   └── stores/      # Zustand 스토어
│   ├── styles/          # 스타일 파일
│   ├── App.tsx          # 루트 컴포넌트
│   └── index.ts         # 엔트리 포인트
│
└── share/               # 클라이언트/서버 공유 코드
    ├── configs/         # 설정 및 상수
    ├── libs/            # 라이브러리 래퍼
    │   ├── api/         # API 클라이언트
    │   ├── auth/        # OAuth 설정
    │   └── react-query/ # React Query 설정
    ├── providers/       # React Provider들
    ├── schema/          # 데이터 스키마 (Zod)
    ├── share-utils/     # 공유 유틸리티 함수
    └── types/           # 타입 정의
```

## 구현 완료 항목

### 1. 인증 인프라

#### OAuth 설정
- **파일**: `src/share/libs/auth/oauth-config.ts`
- 카카오/네이버 OAuth 프로바이더 설정
- WebView를 통한 로그인 플로우 지원
- `getAuthUrl()` 함수로 NextAuth 로그인 URL 생성

#### 세션 및 토큰 관리
- **파일**: `src/share/share-utils/session-utils.ts`
- SecureStore를 사용한 세션 정보 저장/조회/삭제
- 액세스 토큰 저장/조회 및 만료 체크
- `saveSession()`, `getSession()`, `clearSession()` 함수 제공
- `saveAccessToken()`, `getAccessToken()`, `isTokenExpired()` 함수 제공

#### API 클라이언트
- **파일**: `src/share/libs/api/client.ts`
- fetch 래퍼로 표준 응답 구조 파싱
- 인증 에러(401) 처리
- Authorization 헤더에 액세스 토큰 자동 포함

#### 인증 Provider
- **파일**: `src/share/providers/client/auth-provider.tsx`
- 세션 초기화 및 주기적 확인 (5분마다)
- React Query 에러 감지 및 자동 로그아웃 처리
- `logoutWithCacheClear()` 함수 제공

### 2. 로그인 화면

#### 로그인 컴포넌트
- **파일**: `src/client/screens/auth/LoginScreen.tsx`
- 카카오/네이버 로그인 버튼
- 로딩 상태 표시
- 에러 처리 및 Alert 표시

#### 인증 훅
- **파일**: `src/client/states/queries/auth/useAuth.ts`
- `useSession()`: 현재 세션 조회
- `useSocialLogin()`: 소셜 로그인 실행 (WebView 사용)
- `useLogout()`: 로그아웃 처리

### 3. AI 관련 Query Options

#### AI Query Options
- **파일**: `src/share/libs/react-query/query-options/ai.ts`
- `GET /api/document/ai/[documentId]`: 대화 히스토리 조회
- `POST /api/document/ai`: AI 세션 문서 생성
- main 앱과 동일한 구조로 구현

#### Zod 스키마
- **파일**: `src/share/schema/zod/document-ai-zod.ts`
- `DocumentAiSessionCreateRequest` 스키마 정의

### 4. AI Chat 훅

#### useAIConversation
- **파일**: `src/client/states/queries/ai/useAI.ts`
- 서버에 저장된 대화 히스토리 로드
- React Query를 사용한 캐싱 및 자동 리페치

#### useAIChat
- **파일**: `src/client/states/queries/ai/useAI.ts`
- React Native 환경에 맞게 커스텀 구현
- Server-Sent Events 스트리밍 직접 파싱
- 메시지 전송, 중지, 재생성 기능 제공

### 5. ArcAI 컴포넌트

#### 메인 컴포넌트
- **파일**: `src/client/components/arc/ArcAI/ArcAI.tsx`
- `documentId`를 받아 AI 채팅 인터페이스 제공
- 메시지 히스토리 로드 및 스트리밍 처리
- 메시지 편집 및 재생성 기능

#### 메시지 리스트
- **파일**: `src/client/components/arc/ArcAI/components/ArcAIMessageList/ArcAIMessageList.tsx`
- FlatList를 사용한 메시지 표시
- 자동 스크롤 처리
- 로딩 상태 표시

#### 메시지 컴포넌트
- **파일**: `src/client/components/arc/ArcAI/components/ArcAIMessage/ArcAIMessage.tsx`
- 사용자/어시스턴트 메시지 구분
- 마크다운 렌더링 (`react-native-markdown-display` 사용)

#### 입력 컴포넌트
- **파일**: `src/client/components/arc/ArcAI/components/ArcAIInput/ArcAIInput.tsx`
- TextInput을 사용한 다중 라인 입력
- 전송/중지 버튼
- 로딩 상태 표시

### 6. 네비게이션 및 화면 구조

#### 홈 화면
- **파일**: `src/client/screens/home/HomeScreen.tsx`
- 로그아웃 버튼
- AI 세션 시작 안내

#### AI 채팅 화면
- **파일**: `src/client/screens/ai/AIChatScreen.tsx`
- `documentId`를 받아 ArcAI 컴포넌트 렌더링

#### 루트 컴포넌트
- **파일**: `src/client/App.tsx`
- 세션 상태에 따른 화면 전환
  - 로딩 중: 로딩 인디케이터
  - 로그인됨: HomeScreen
  - 로그인 안됨: LoginScreen

## 주요 의존성

### 설치된 패키지
- `expo-auth-session`: OAuth 인증
- `expo-secure-store`: 세션 토큰 저장
- `expo-web-browser`: WebView 인증 세션
- `@tanstack/react-query`: 서버 상태 관리
- `zustand`: 클라이언트 상태 관리
- `zod`: 데이터 검증
- `ai`: AI SDK (타입 정의용)
- `react-native-markdown-display`: 마크다운 렌더링

## 환경 변수

다음 환경 변수가 필요합니다 (`.env` 또는 `app.json`에 설정):

```env
EXPO_PUBLIC_KAKAO_CLIENT_ID=your_kakao_client_id
EXPO_PUBLIC_NAVER_CLIENT_ID=your_naver_client_id
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

## 알려진 제한사항 및 TODO

### 토큰 기반 인증 (구현 완료, 서버 측 작업 필요)

React Native에서는 쿠키가 자동으로 관리되지 않으므로, 토큰 기반 인증 방식을 사용합니다.

#### 구현된 기능
1. **토큰 관리 유틸리티** (`src/share/share-utils/session-utils.ts`)
   - `saveAccessToken()`: 액세스 토큰 저장 (만료 시간 포함)
   - `getAccessToken()`: 액세스 토큰 조회 (만료 체크 포함)
   - `isTokenExpired()`: 토큰 만료 체크
   - `parseExpiresIn()`: expiresIn 문자열을 epoch seconds로 변환

2. **API 클라이언트 토큰 포함** (`src/share/libs/api/client.ts`)
   - 모든 API 요청에 Authorization 헤더 자동 포함
   - 형식: `Authorization: Bearer {token}`

3. **스트리밍 요청 토큰 포함** (`src/client/states/queries/ai/useAI.ts`)
   - AI 채팅 스트리밍 요청에 Authorization 헤더 포함

4. **로그인 후 토큰 발급** (`src/client/states/queries/auth/useAuth.ts`)
   - 로그인 성공 후 `/api/auth/mobile/token` 엔드포인트 호출
   - 발급받은 토큰을 SecureStore에 저장

#### 서버 측 작업 필요
- **토큰 발급 API 구현 필요**: `/api/auth/mobile/token` 엔드포인트
  - NextAuth 세션을 검증하여 JWT 토큰 발급
  - 토큰 만료 시간 설정 (예: 30일)
  - 응답 형식: `{ token: string, expiresIn: string, expiresAt?: number }`

- **API 인증 미들웨어 수정 필요**
  - Authorization 헤더에서 토큰 추출 및 검증
  - 토큰이 유효하면 요청 허용, 만료되면 401 반환

#### 테스트 필요
- 실제 로그인 플로우에서 토큰이 제대로 발급되고 저장되는지 확인 필요
- API 요청 시 토큰이 제대로 포함되는지 확인 필요

### 에러 처리
- 네트워크 에러 처리 개선
- 재시도 로직 추가
- 오프라인 상태 처리

## 다음 단계

1. **서버 측 토큰 발급 API 구현** ⚠️ (필수)
   - `/api/auth/mobile/token` 엔드포인트 구현
   - NextAuth 세션 검증 후 JWT 토큰 발급
   - API 인증 미들웨어에서 토큰 검증 로직 추가

2. **토큰 기반 인증 테스트** ✅ (구현 완료, 테스트 필요)
   - 실제 로그인 플로우에서 토큰 발급 및 저장 동작 확인
   - API 요청 시 토큰이 제대로 포함되는지 확인
   - 토큰 만료 시 자동 로그아웃 동작 확인

2. **AI 세션 생성 기능**
   - 홈 화면에서 새 AI 세션 생성 버튼 추가
   - 세션 목록 표시
   - 세션 삭제 기능

3. **네비게이션 개선**
   - 현재는 기본적인 화면 전환만 구현됨
   - 화면 간 파라미터 전달 개선
   - 딥링크 지원

4. **스타일링 개선**
   - 디자인 시스템 통합
   - 다크 모드 지원
   - 컴포넌트 스타일 일관성 개선

5. **에러 처리 개선**
   - 네트워크 에러 처리 개선
   - 재시도 로직 추가
   - 오프라인 상태 처리

6. **테스트**
   - 단위 테스트 작성
   - 통합 테스트 작성
   - E2E 테스트 작성

## 참고 문서

- [Expo AuthSession 문서](https://docs.expo.dev/guides/authentication/)
- [React Query 문서](https://tanstack.com/query/latest)
- [React Native 문서](https://reactnative.dev/)
- [main 앱 구조 참고](../main/src/)


# Mobile App 구조 가이드

이 문서는 `apps/main`의 구조를 참고하여 구성된 mobile 앱의 디렉토리 구조를 설명합니다.

## 전체 구조

```
apps/mobile/src/
├── client/              # 클라이언트 전용 코드
│   ├── components/      # UI 컴포넌트
│   ├── screens/         # 화면 컴포넌트 (Expo Router 또는 React Navigation)
│   ├── states/          # 상태 관리
│   │   ├── queries/     # React Query 훅 (API 호출)
│   │   └── stores/      # Zustand 스토어 (클라이언트 상태)
│   ├── styles/          # 스타일 파일
│   ├── App.tsx          # 루트 컴포넌트
│   └── index.ts         # 엔트리 포인트
│
└── share/               # 클라이언트/서버 공유 코드
    ├── configs/         # 설정 및 상수
    │   ├── constants/   # 상수 정의 (API, 경로, 시간 등)
    │   ├── environments/# 환경 변수 설정
    │   └── icons/       # 아이콘 설정
    ├── libs/            # 라이브러리 래퍼
    │   ├── i18n/        # 다국어 설정
    │   └── react-query/ # React Query 설정
    ├── providers/       # React Provider들
    │   ├── client/      # 클라이언트 Provider
    │   └── providers-utils/ # Provider 유틸리티
    ├── schema/          # 데이터 스키마
    │   ├── zod/         # Zod 스키마
    │   └── types/       # 타입 정의
    ├── share-utils/     # 공유 유틸리티 함수
    └── types/           # 타입 정의
        ├── api/         # API 관련 타입
        └── libs/        # 라이브러리 타입
```

## 주요 디렉토리 설명

### `src/client/`
클라이언트 전용 코드로, React Native/Expo 환경에서만 실행되는 코드입니다.

- **components/**: 재사용 가능한 UI 컴포넌트
- **screens/**: 화면 단위 컴포넌트 (라우팅 구조)
- **states/**: 상태 관리
  - `queries/`: React Query를 사용한 서버 상태 관리
  - `stores/`: Zustand를 사용한 클라이언트 상태 관리
- **styles/**: 스타일 파일 (CSS, StyleSheet 등)

### `src/share/`
클라이언트와 서버에서 공유 가능한 코드입니다.

- **configs/**: 설정 및 상수
  - `constants/`: API 엔드포인트, 경로, 시간 상수 등
  - `environments/`: 환경 변수 설정
- **libs/**: 외부 라이브러리 래퍼 및 설정
- **providers/**: React Context Provider들
- **schema/**: 데이터 검증 및 타입 정의
- **share-utils/**: 공유 유틸리티 함수
- **types/**: TypeScript 타입 정의

## 설계 원칙

### 1. 실행 환경 경계 명확화
- `client/`: 클라이언트 전용 (React Native)
- `share/`: 공유 코드 (타입, 유틸리티, 상수 등)

### 2. 상태 관리 분리
- **서버 상태**: React Query (`states/queries/`)
- **클라이언트 상태**: Zustand (`states/stores/`)

### 3. 타입 안정성
- Zod를 통한 런타임 검증
- TypeScript를 통한 컴파일 타임 검증

### 4. 경로 별칭
- `@/client/*`: `src/client/*`
- `@/share/*`: `src/share/*`
- `@/*`: `src/*`

## 사용 예시

### 컴포넌트에서 상태 사용
```typescript
import { useSystemStore } from '@/client/states/stores/system-store';
import { useQuery } from '@tanstack/react-query';

function MyComponent() {
  const { loading, showLoading, hideLoading } = useSystemStore();
  // ...
}
```

### Provider 사용
```typescript
import { AppProviders } from '@/share/providers/client/client-providers';

export default function App() {
  return (
    <AppProviders>
      {/* 앱 내용 */}
    </AppProviders>
  );
}
```

### 상수 사용
```typescript
import { API_BASE_URL, API_ENDPOINTS } from '@/share/configs/constants';
```

## 참고

이 구조는 `apps/main`의 구조를 기반으로 하되, React Native/Expo 환경에 맞게 조정되었습니다.
- Next.js의 `app/` 디렉토리는 Expo Router의 `screens/`로 대체
- 웹 전용 라이브러리(tailwind-merge 등)는 제외
- React Native에 맞는 스타일링 방식 사용


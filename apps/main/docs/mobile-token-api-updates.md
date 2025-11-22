# 모바일 토큰 API 경로 업데이트 완료

## 개요

모바일 토큰 API의 최종 위치 확정에 따른 관련 파일 업데이트를 완료했습니다.

**최종 API 경로:**
- 토큰 발급: `POST /api/auth/mobile/token`
- 토큰 갱신: `POST /api/auth/mobile/token/refresh`

---

## 업데이트된 파일

### 1. 서버 측 (apps/main)

#### `apps/main/src/app/(backend)/api/auth/mobile/token/refresh/route.ts`
- ✅ 주석 경로 수정: `/api/auth/refresh` → `/api/auth/mobile/token/refresh`
- ✅ 에러 로그 경로 수정: `[POST /api/auth/refresh]` → `[POST /api/auth/mobile/token/refresh]`
- ✅ DB 스키마 필드명 수정: `user.image` → `user.imageUrl`

**변경 내용:**
```typescript
// Before
/**
 * POST /api/auth/refresh
 */
console.error('[POST /api/auth/refresh] Error:', ...);
userImage = user.image || undefined;

// After
/**
 * POST /api/auth/mobile/token/refresh
 */
console.error('[POST /api/auth/mobile/token/refresh] Error:', ...);
userImage = user.imageUrl || undefined;
```

---

### 2. 모바일 클라이언트 (apps/mobile)

#### `apps/mobile/src/share/libs/api/client.ts`
- ✅ API 경로 업데이트: `/api/auth/refresh` → `/api/auth/mobile/token/refresh`
- ✅ 응답 파싱 수정: 표준 API 응답 형식(`{ success: true, data: {...} }`)에서 `data` 속성 추출

**변경 내용:**
```typescript
// Before
const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, ...);
const data = await response.json();
const { accessToken, refreshToken: newRefreshToken, user } = data;

// After
const response = await fetch(`${API_BASE_URL}/api/auth/mobile/token/refresh`, ...);
const result = (await response.json()) as StandardApiResponse<{...}> | StandardApiErrorResponse;
const data = extractApiData(result);
const { accessToken, refreshToken: newRefreshToken, user } = data;
```

#### `apps/mobile/src/share/providers/client/auth-provider.tsx`
- ✅ API 경로 업데이트: `/api/auth/refresh` → `/api/auth/mobile/token/refresh`
- ✅ 응답 파싱 수정: 표준 API 응답 형식에서 `data` 속성 추출
- ✅ Import 추가: `extractApiData`, `StandardApiResponse`, `StandardApiErrorResponse`
- ✅ 세션 저장 로직 수정: `expires` 필드 제거 (API 응답에 없음)

**변경 내용:**
```typescript
// Before
import { API_BASE_URL } from '@/share/configs/environments/client-constants';

const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, ...);
const refreshData = await refreshResponse.json();
const { accessToken, refreshToken: newRefreshToken, user } = refreshData;

await saveSession({
  user,
  expires: refreshData.expires, // ❌ API 응답에 없음
});

// After
import { extractApiData } from '@/share/libs/api/client';
import type { StandardApiErrorResponse } from '@/share/types/api/error-types';
import type { StandardApiResponse } from '@/share/types/api/response-types';

const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/mobile/token/refresh`, ...);
const result = (await refreshResponse.json()) as StandardApiResponse<{...}> | StandardApiErrorResponse;
const refreshData = extractApiData(result);
const { accessToken, refreshToken: newRefreshToken, user } = refreshData;

await saveSession({
  user,
  // expires 제거 (API 응답에 없음)
});
```

---

## 주요 개선 사항

### 1. API 경로 일관성 확보
- 모든 모바일 토큰 관련 API가 `/api/auth/mobile/token/*` 경로로 통일
- 명확한 네임스페이스로 웹 API와 구분

### 2. 표준 응답 형식 준수
- 서버는 `ok()` 함수로 `{ success: true, data: {...} }` 형식 반환
- 클라이언트는 `extractApiData()` 함수로 `data` 속성 추출
- 타입 안정성 향상 (`StandardApiResponse<T>` 사용)

### 3. DB 스키마 필드명 정확성
- DB 스키마의 `imageUrl` 필드와 일치하도록 수정
- 린터 에러 해결

---

## 확인 사항

### ✅ 완료된 작업
1. 서버 측 API 경로 주석 및 로그 업데이트
2. 모바일 클라이언트 API 호출 경로 업데이트 (2곳)
3. 모바일 클라이언트 응답 파싱 수정 (표준 형식 준수)
4. DB 스키마 필드명 수정 (`imageUrl`)
5. 린터 에러 해결

### 📝 참고 사항
- `refresh-store-mobile-redis.ts`는 이미 올바르게 import되어 있음
- 문서 파일(`docs/expo-router-migration-plan.md`, `docs/base.md`)은 참고용이므로 업데이트하지 않음

---

## 테스트 권장 사항

1. **토큰 발급 테스트**
   - 웹에서 로그인 후 `/api/auth/mobile/token` 호출
   - 응답 형식 확인 (`{ success: true, data: {...} }`)

2. **토큰 갱신 테스트**
   - 모바일 앱에서 Refresh Token으로 `/api/auth/mobile/token/refresh` 호출
   - 응답 파싱 및 전역 상태 업데이트 확인

3. **자동 갱신 테스트**
   - API 호출 시 401 에러 발생 시 자동 토큰 갱신 동작 확인
   - 원래 요청 재시도 성공 여부 확인

---

## 관련 파일 구조

```
apps/main/src/app/(backend)/api/auth/mobile/token/
├── route.ts                    # POST /api/auth/mobile/token
└── refresh/
    └── route.ts                # POST /api/auth/mobile/token/refresh

apps/main/src/server/database/redis/session/
└── refresh-store-mobile-redis.ts  # 모바일용 Refresh Token 저장소

apps/mobile/src/share/
├── libs/api/client.ts          # API 클라이언트 (토큰 갱신 로직)
└── providers/client/
    └── auth-provider.tsx       # 인증 Provider (부트스트랩 로직)
```

---

## 마이그레이션 체크리스트

- [x] 서버 측 API 경로 주석 업데이트
- [x] 서버 측 에러 로그 경로 업데이트
- [x] 모바일 클라이언트 API 경로 업데이트
- [x] 모바일 클라이언트 응답 파싱 수정
- [x] DB 스키마 필드명 수정
- [x] 린터 에러 해결
- [ ] 실제 환경에서 테스트 (권장)

---

**업데이트 완료일:** 2025-01-XX
**담당자:** AI Assistant


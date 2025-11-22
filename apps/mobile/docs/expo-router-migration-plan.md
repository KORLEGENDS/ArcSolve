# Expo Router 전환 및 인증 개선 계획

## 개요

현재 React Navigation 없이 직접 조건부 렌더링하는 구조를 Expo Router로 전환하고, 베스트 프랙티스에 맞는 인증 구조를 구현합니다.

---

## 1. Expo Router 전환 계획

### 1.1 패키지 설치

```bash
cd apps/mobile
pnpm add expo-router
```

### 1.2 디렉토리 구조 변경

**현재 구조:**
```
src/client/
├── App.tsx              # 루트 컴포넌트 (조건부 렌더링)
├── screens/
│   ├── auth/
│   │   └── LoginScreen.tsx
│   ├── home/
│   │   └── HomeScreen.tsx
│   └── ai/
│       └── AIChatScreen.tsx
└── index.ts             # 엔트리 포인트
```

**변경 후 구조:**
```
app/                     # Expo Router 디렉토리 (새로 생성)
├── _layout.tsx         # 루트 레이아웃 (인증 상태에 따른 라우팅)
├── (auth)/             # 인증되지 않은 사용자 그룹
│   ├── _layout.tsx
│   └── login.tsx       # LoginScreen 이동
├── (app)/              # 인증된 사용자 그룹
│   ├── _layout.tsx
│   ├── index.tsx       # HomeScreen 이동
│   └── ai/
│       └── [documentId].tsx  # AIChatScreen 이동
└── +not-found.tsx      # 404 페이지

src/client/
├── components/          # 기존 유지
├── states/             # 기존 유지
└── styles/             # 기존 유지
```

### 1.3 설정 파일 변경

**`app.json` 수정:**
```json
{
  "expo": {
    "scheme": "arcsolve",
    "main": "expo-router/entry"
  }
}
```

**`package.json` 수정:**
```json
{
  "main": "expo-router/entry"
}
```

### 1.4 파일 이동 및 생성

1. `src/client/screens/auth/LoginScreen.tsx` → `app/(auth)/login.tsx`
2. `src/client/screens/home/HomeScreen.tsx` → `app/(app)/index.tsx`
3. `src/client/screens/ai/AIChatScreen.tsx` → `app/(app)/ai/[documentId].tsx`
4. `app/_layout.tsx` 생성 (루트 레이아웃)
5. `app/(auth)/_layout.tsx` 생성
6. `app/(app)/_layout.tsx` 생성

---

## 2. Refresh Token 구조 추가

### 2.1 토큰 저장 구조 변경

**현재:**
- Access Token만 SecureStore에 저장

**변경 후:**
- **Access Token**: 메모리 (전역 상태)에만 저장, 앱 재시작 시 삭제
- **Refresh Token**: SecureStore에 저장 (장기 보관)

### 2.2 세션 유틸리티 확장

**`src/share/share-utils/session-utils.ts`에 추가:**

```typescript
// Refresh Token 관리
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

export async function saveRefreshToken(token: string): Promise<void>
export async function getRefreshToken(): Promise<string | null>
export async function clearRefreshToken(): Promise<void>

// Access Token은 전역 상태로만 관리 (SecureStore 저장 제거)
```

### 2.3 전역 상태에 Access Token 추가

**`src/client/states/stores/auth-store.ts` 생성 (Zustand):**

```typescript
interface AuthState {
  user: SessionData['user'] | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setAuth: (user: SessionData['user'], accessToken: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}
```

---

## 3. 앱 시작 시 토큰 복원 로직

### 3.1 AuthProvider 개선

**`src/share/providers/client/auth-provider.tsx` 수정:**

```typescript
export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<'loading' | 'resolved'>('loading');
  const { setAuth, clearAuth, setLoading } = useAuthStore();
  
  useEffect(() => {
    const bootstrap = async () => {
      try {
        // 1. SecureStore에서 Refresh Token 확인
        const refreshToken = await getRefreshToken();
        
        if (!refreshToken) {
          // Refresh Token 없음 → 로그인 안 된 상태
          setStatus('resolved');
          return;
        }
        
        // 2. Refresh Token으로 Access Token 갱신 시도
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        
        if (!response.ok) {
          // Refresh 실패 → 토큰 삭제 및 로그아웃
          await clearRefreshToken();
          clearAuth();
          setStatus('resolved');
          return;
        }
        
        // 3. 새 Access Token 및 사용자 정보 저장
        const data = await response.json();
        setAuth(data.user, data.accessToken);
        
        // 4. 새 Refresh Token이 있으면 저장
        if (data.refreshToken) {
          await saveRefreshToken(data.refreshToken);
        }
        
        setStatus('resolved');
      } catch (error) {
        console.error('Bootstrap error:', error);
        await clearRefreshToken();
        clearAuth();
        setStatus('resolved');
      } finally {
        setLoading(false);
      }
    };
    
    void bootstrap();
  }, []);
  
  // 로딩 중이면 스플래시 화면 표시
  if (status === 'loading') {
    return <SplashScreen />;
  }
  
  return <>{children}</>;
}
```

### 3.2 루트 레이아웃에서 인증 상태 확인

**`app/_layout.tsx`:**

```typescript
import { useAuthStore } from '@/client/states/stores/auth-store';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';

export default function RootLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  
  useEffect(() => {
    if (isLoading) return;
    
    const inAuthGroup = segments[0] === '(auth)';
    
    if (!isAuthenticated && !inAuthGroup) {
      // 로그인 안 됨 → 로그인 화면으로
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // 로그인 됨 → 홈 화면으로
      router.replace('/(app)');
    }
  }, [isAuthenticated, segments, isLoading]);
  
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}
```

---

## 4. 토큰 자동 갱신 로직

### 4.1 API 클라이언트에 토큰 갱신 로직 추가

**`src/share/libs/api/client.ts` 수정:**

```typescript
import { useAuthStore } from '@/client/states/stores/auth-store';
import { getRefreshToken, saveRefreshToken, clearRefreshToken } from '@/share/share-utils/session-utils';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        return null;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      
      if (!response.ok) {
        await clearRefreshToken();
        useAuthStore.getState().clearAuth();
        return null;
      }
      
      const data = await response.json();
      useAuthStore.getState().setAuth(data.user, data.accessToken);
      
      if (data.refreshToken) {
        await saveRefreshToken(data.refreshToken);
      }
      
      return data.accessToken;
    } catch (error) {
      await clearRefreshToken();
      useAuthStore.getState().clearAuth();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}

export async function apiClient<TData>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<TData> {
  const { method = 'GET', headers = {}, body, signal } = options;
  
  // Access Token 가져오기 (전역 상태에서)
  let accessToken = useAuthStore.getState().accessToken;
  
  // 토큰이 없거나 만료되었으면 갱신 시도
  if (!accessToken) {
    accessToken = await refreshAccessToken();
    if (!accessToken) {
      throw new Error('Authentication required');
    }
  }
  
  headers['Authorization'] = `Bearer ${accessToken}`;
  
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  
  // 401 에러 시 토큰 갱신 재시도
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      const authError = new Error('Authentication failed');
      (authError as any).status = 401;
      throw authError;
    }
    
    // 재시도
    headers['Authorization'] = `Bearer ${newToken}`;
    const retryResponse = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    
    if (!retryResponse.ok) {
      // 재시도 실패
      const authError = new Error('Authentication failed');
      (authError as any).status = 401;
      throw authError;
    }
    
    const result = (await retryResponse.json()) as StandardApiResponse<TData> | StandardApiErrorResponse;
    return extractApiData(result);
  }
  
  // ... 기존 에러 처리 로직
}
```

---

## 5. 로그인 플로우 개선

### 5.1 로그인 성공 시 토큰 저장

**`src/client/states/queries/auth/useAuth.ts` 수정:**

```typescript
export function useSocialLogin() {
  const queryClient = useQueryClient();
  const { setAuth } = useAuthStore();
  const router = useRouter();
  
  const mutation = useMutation({
    mutationFn: async (provider: OAuthProvider) => {
      const authUrl = getAuthUrl(provider);
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        `${API_BASE_URL}/api/auth/callback/${provider}`
      );
      
      if (result.type === 'success') {
        // 1. 서버에서 토큰 발급
        const tokenResponse = await fetch(`${API_BASE_URL}/api/auth/mobile/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (!tokenResponse.ok) {
          throw new Error('토큰 발급에 실패했습니다.');
        }
        
        const tokenData = await tokenResponse.json();
        
        // 2. Refresh Token 저장
        await saveRefreshToken(tokenData.refreshToken);
        
        // 3. Access Token 및 사용자 정보를 전역 상태에 저장
        const sessionResponse = await fetch(`${API_BASE_URL}/api/auth/session`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenData.accessToken}`,
          },
        });
        
        const sessionData = await sessionResponse.json();
        const session = sessionData.data || sessionData;
        
        setAuth(session.user, tokenData.accessToken);
        
        // 4. Expo Router로 홈 화면 이동
        router.replace('/(app)');
        
        return session;
      }
      
      throw new Error('로그인이 취소되었거나 실패했습니다.');
    },
  });
  
  return {
    login: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
```

---

## 6. 서버 측 작업 필요 사항

### 6.1 API 엔드포인트 구현

1. **`POST /api/auth/mobile/token`**
   - NextAuth 세션 검증
   - Access Token + Refresh Token 발급
   - 응답: `{ accessToken: string, refreshToken: string, expiresIn: string }`

2. **`POST /api/auth/refresh`**
   - Refresh Token 검증
   - 새 Access Token 발급 (필요시 Refresh Token도 갱신)
   - 응답: `{ accessToken: string, refreshToken?: string, user: User }`

3. **`POST /api/auth/logout`**
   - Refresh Token 무효화
   - 서버 측 세션 삭제

### 6.2 API 인증 미들웨어 수정

- Authorization 헤더에서 Access Token 추출 및 검증
- 토큰 만료 시 401 반환 (클라이언트에서 자동 갱신 처리)

---

## 7. 구현 순서

### Phase 1: Expo Router 전환
1. ✅ 패키지 설치
2. ✅ `app/` 디렉토리 생성 및 파일 이동
3. ✅ `app.json`, `package.json` 수정
4. ✅ 루트 레이아웃 구현
5. ✅ Protected Routes 구현

### Phase 2: Refresh Token 구조 추가
1. ✅ `session-utils.ts`에 Refresh Token 함수 추가
2. ✅ Auth Store 생성 (Zustand)
3. ✅ Access Token을 전역 상태로 이동

### Phase 3: 토큰 복원 로직
1. ✅ AuthProvider에 bootstrap 로직 추가
2. ✅ 앱 시작 시 Refresh Token 확인 및 갱신

### Phase 4: 토큰 자동 갱신
1. ✅ API 클라이언트에 401 처리 및 자동 갱신 로직 추가
2. ✅ 동시 요청 시 중복 갱신 방지

### Phase 5: 로그인 플로우 개선
1. ✅ 로그인 성공 시 Refresh Token 저장
2. ✅ 전역 상태 업데이트
3. ✅ Expo Router 네비게이션

---

## 8. 테스트 체크리스트

- [ ] 앱 시작 시 Refresh Token으로 자동 로그인
- [ ] 로그인 성공 시 토큰 저장 및 화면 전환
- [ ] Access Token 만료 시 자동 갱신
- [ ] Refresh Token 만료 시 로그아웃 처리
- [ ] 로그아웃 시 모든 토큰 삭제
- [ ] Protected Routes 접근 제어 동작 확인
- [ ] 동시 API 요청 시 토큰 갱신 중복 방지

---

## 9. 참고 문서

- [Expo Router Authentication](https://docs.expo.dev/router/advanced/authentication/)
- [Expo Router Protected Routes](https://docs.expo.dev/router/advanced/protected/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo Authentication Guide](https://docs.expo.dev/develop/authentication/)


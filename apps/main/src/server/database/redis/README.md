# 🛠️ ArcSolve Cache Layer (Redis)

ArcSolve의 **Redis 기반 Cache Layer**는 인증·세션·레이트리밋 등 서버 전반의 단기 상태를 관리합니다.

**⚠️ 중요**: Redis는 항상 활성화되어 있으며, 환경변수 미설정 시 기본값(`127.0.0.1:6379`)으로 연결을 시도합니다.

---

## 📁 디렉터리 구조

```
redis/
├── connection/              # Redis 연결 관리
│   ├── client-redis.ts      # 싱글턴 클라이언트 (항상 활성화)
│   ├── lock-redis.ts        # 분산 락 (NX EX + Lua release)
│   └── subscriber-redis.ts  # Pub/Sub 멀티플렉서
├── session/                 # 세션·보안 토큰 스토어
│   └── refresh-store-redis.ts # Refresh Token (save / load / rotate / delete)
└── rate-limit/              # 고정 윈도우 레이트리밋
    ├── window-redis.ts      # Lua 기반 고정 윈도우 구현
    ├── ip-limit-redis.ts    # IP 기반 레이트리밋
    └── user-limit-redis.ts  # 사용자 기반 레이트리밋
```

---

## 🔑 Key Prefix Helpers

`@/share/configs/constants/server/cache-constants.ts` 의 `CacheKey` 객체

```
session:refresh:<userId>    # refresh token
ratelimit:ip:<ip>           # IP 레이트리밋
ratelimit:user:<userId>     # 사용자 레이트리밋
security:lock:<id>          # 분산 락 키
```

---

## ⚙️ 환경 변수

| 변수                      | 설명                           | 기본값              | 필수 |
| ------------------------- | ------------------------------ | ------------------- | ---- |
| `REDIS_HOST`              | Redis 호스트                   | `127.0.0.1`         | ❌   |
| `REDIS_PORT`              | Redis 포트                     | `6379`               | ❌   |
| `REDIS_PASSWORD`          | Redis 비밀번호                 | -                   | ❌   |
| `REDIS_TLS_ENABLED`       | TLS 활성화 여부                | `false`              | ❌   |
| `REDIS_TLS_SERVERNAME`    | TLS SNI 서버명                 | `redis.arcsolve.ai` | ❌   |

**연결 동작**:
- 개발 환경에서 `REDIS_HOST` 미설정 시: `redis://127.0.0.1:6379`로 연결 시도
- 프로덕션 환경: 환경변수 기반으로 연결 (기본값: `127.0.0.1:6379`)
- 연결 실패 시 에러는 경고로만 로깅되며, 앱은 계속 실행됨

---

## 🔧 연결 설정

### 클라이언트 설정

- **싱글턴 패턴**: `getRedis()`로 단일 인스턴스 재사용
- **자동 파이프라이닝**: `enableAutoPipelining: true`
- **재시도**: `maxRetriesPerRequest: 5`
- **연결 유지**: `keepAlive: 30000ms`
- **연결명**: `arcsolve-main` (관측용)

### Pub/Sub 설정

- **별도 연결**: `duplicate()`로 메인 클라이언트와 분리
- **멀티플렉서**: 채널별 리스너 관리 및 중복 구독 방지
- **연결명**: `arcsolve-pubsub:<timestamp>` (관측용)

---

## 🧩 통합 지점

1. **NextAuth (`auth.ts`)**
   - 로그인 시 `refresh-store.saveRefreshToken()`
   - 토큰 갱신 시 `lock` + `refreshAccessToken(provider, userId)` 사용

2. **미들웨어**
   - 요청 시 Redis에 refresh token 존재 여부로 세션 무결성 검증

3. **레이트리밋**
   - IP/사용자 기반 고정 윈도우 레이트리밋 적용

---

## 🚀 사용 예시

### 레이트리밋

```ts
import { consumeIpLimit } from '@/server/database/redis/rate-limit/ip-limit-redis';

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const { limited, remaining } = await consumeIpLimit(ip);
  if (limited) {
    return new Response('Too many requests', { 
      status: 429,
      headers: { 'X-RateLimit-Remaining': String(remaining) }
    });
  }
  // ...비즈니스 로직...
}
```

### 분산 락

```ts
import { acquireLock, releaseLock, RedisLock } from '@/server/database/redis/connection/lock-redis';

const lockId = await acquireLock(RedisLock.forRefreshToken(userId), 10);
if (!lockId) {
  throw new Error('Failed to acquire lock');
}

try {
  // 크리티컬 섹션
} finally {
  await releaseLock(RedisLock.forRefreshToken(userId), lockId);
}
```

### Refresh Token 관리

```ts
import { 
  saveRefreshToken, 
  loadRefreshToken, 
  rotateRefreshToken,
  deleteRefreshToken 
} from '@/server/database/redis/session/refresh-store-redis';

// 저장
await saveRefreshToken(userId, token);

// 조회
const token = await loadRefreshToken(userId);

// 회전
await rotateRefreshToken(oldId, newId, newToken);

// 삭제
await deleteRefreshToken(userId);
```

### Pub/Sub

```ts
import { getRedisSubscriber } from '@/server/database/redis/connection/subscriber-redis';

const unsubscribe = await getRedisSubscriber().subscribe('channel:name', (message) => {
  console.log('Received:', message);
});

// 구독 해제
await unsubscribe();
```

---

## 🧪 테스트 가이드

ioredis-mock으로 단위 테스트를 작성할 수 있습니다.

```ts
import { vi } from 'vitest';
vi.mock('ioredis', () => import('ioredis-mock'));
```

---

## 📌 참고

- **항상 활성화**: Redis는 항상 활성화되어 있으며, 연결 실패 시에도 앱은 계속 실행됩니다
- **TTL 설정**: 각 스토어 파일 상단 `DEFAULT_TTL_SEC` 또는 `CACHE_TTL` 상수로 정의
- **락 시간**: 기본 10초 (`CACHE_TTL.SECURITY.LOCK`), 필요 시 인자로 조정 가능
- **레이트리밋**: 고정 윈도우 방식, Lua 스크립트로 원자적 연산 보장
- **에러 처리**: 연결 에러는 경고로만 로깅되며, 비즈니스 로직은 계속 진행됨

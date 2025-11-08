# 🛠️ ArcSolve Cache Layer (Redis)

ArcSolve의 **Redis 기반 Cache Layer**는 인증·세션·레이트리밋·분석 지표 등 서버 전반의 단기 상태를
관리합니다. Redis는 `REDIS_URL` 환경변수가 설정되면 자동으로 활성화됩니다.

---

## 📁 디렉터리 구조

```
cache
├── connection          # Redis 연결·락
│   ├── client.ts       # 싱글턴 클라이언트 + Key 빌더 + health check
│   └── lock.ts         # NX EX 락, Lua release, RedisLock 헬퍼
├── session             # 세션·보안 토큰 스토어
│   ├── refresh-store.ts # Refresh Token (save / load / rotate / delete)
│   ├── csrf-store.ts    # CSRF 토큰
│   └── pkce-store.ts    # PKCE code verifier
├── rate-limit          # 슬라이딩 윈도우 레이트리밋
│   ├── ip-limit.ts      # 60s / 100req
│   └── user-limit.ts    # 60s / 60req
├── analytics           # 간단 카운터
│   ├── page-view.ts     # 페이지뷰 증가/조회
│   └── event-counter.ts # 커스텀 이벤트 카운터
└── monitoring          # 운영 상태
    ├── health-check.ts  # ping + version + latency
    └── metrics.ts       # 메모리/히트/미스 등 기본 메트릭
```

---

## 🔑 Key Prefix Helpers

`connection/client.ts` 의 `CacheKey` 객체

```
rt:<id>         # refresh token
ct:<id>         # csrf token
pk:<id>         # pkce code
rl:ip:<ip>      # ip rate limit
rl:uid:<uid>    # user rate limit
pv:<url>        # page view
ev:<event>      # event counter
lock:<id>       # 락 키
```

---

## ⚙️ 환경 변수

| 변수        | 설명                                         | 예시                     |
| ----------- | -------------------------------------------- | ------------------------ |
| `REDIS_URL` | redis:// or rediss:// (설정 시 Redis 활성화) | `redis://localhost:6379` |

`REDIS_URL`이 설정되면 Redis가 자동으로 활성화됩니다. 설정하지 않으면 Redis 기능이 비활성화되며,
앱은 정상 동작합니다.

---

## 🧩 통합 지점

1. **NextAuth (`auth.ts`)**
   - 로그인 시 `refresh-store.saveRefreshToken()`
   - 토큰 갱신 시 `lock` + `refreshAccessToken(provider, userId)` 사용
2. **미들웨어**
   - 요청 시 Redis 에 refresh token 존재 여부로 세션 무결성 검증
3. **클라이언트 훅**
   - `RefreshTokenError` 발생 시 캐시 클리어 후 재로그인 유도

---

## 🚀 사용 예시

```ts
import { isIpRateLimited } from '@/lib/cache/rate-limit/ip-limit'

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { limited } = await isIpRateLimited(ip)
  if (limited) return new Response('Too many requests', { status: 429 })
  // ...비즈니스 로직...
}
```

---

## 🧪 테스트 가이드

`REDIS_URL`을 설정하지 않고 ioredis-mock으로 단위 테스트를 작성할 수 있습니다.

```ts
import { vi } from 'vitest'
vi.mock('ioredis', () => import('ioredis-mock'))
```

---

## 📌 참고

- 모든 함수는 Redis 비활성화 시 graceful degrade (noop) 동작
- Key TTL 은 각 스토어 파일 상단 `DEFAULT_TTL_SEC` 로 정의
- 락 시간은 10초 기본, 필요 시 인자로 조정

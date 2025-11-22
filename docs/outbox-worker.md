## Outbox Worker 개요

ArcSolve의 Outbox Worker는 **DB Outbox 테이블**에 쌓인 이벤트/잡을 비동기로 처리하는 백그라운드 워커입니다.  
현재는 다음 두 가지 워커로 **역할을 분리**해서 운영합니다.

- **ArcYou 채팅 워커**: `worker-arcyou-chat.ts` / 컨테이너 `outbox-worker`
- **문서 전처리 워커**: `worker-document.ts` / 컨테이너 `outbox-worker-document`

두 워커 모두 **동일한 Outbox 테이블**을 사용하지만, `type` 프리픽스를 기준으로 서로 다른 잡만 소비합니다.

---

## Outbox 테이블 및 공통 유틸

- 테이블 정의: `apps/main/src/share/schema/drizzles/outbox-drizzle.ts`
  - 주요 필드
    - `id: bigserial` – PK
    - `type: text` – 이벤트/잡 타입 (예: `message.created`, `room.updated`, `document.preprocess.v1` 등)
    - `roomId: uuid` – 채팅 도메인에서는 방 ID, 문서 도메인에서는 잡 키로 재사용
    - `payload: jsonb` – 워커가 그대로 전달/사용할 수 있는 JSON 페이로드
    - `status: 'pending' | 'in_progress' | 'published' | 'dead'`
    - `attempts`, `nextAttemptAt`, `lockedBy`, `lockedUntil`, `error` – 백오프/락/에러 관리용

- 공통 유틸: `apps/outbox-worker/worker-utils.ts`
  - **주요 함수**
    - `claimBatch(...)`  
      - `status = 'pending'` 이고 `next_attempt_at <= NOW()` 인 레코드를 **트랜잭션 + `FOR UPDATE SKIP LOCKED`** 로 가져와 `in_progress` 로 마킹
      - 시그니처:
        ```ts
        claimBatch(
          db,
          outbox,
          maxBatch,
          lockSeconds,
          workerId,
          options?: {
            includeTypePrefix?: string;
            excludeTypePrefix?: string;
          },
        )
        ```
      - `includeTypePrefix` / `excludeTypePrefix` 로 **`type` 프리픽스 기반 필터링** 지원
        - 예: `includeTypePrefix: 'document.'` → `type LIKE 'document.%'` 만
        - 예: `excludeTypePrefix: 'document.'` → `type NOT LIKE 'document.%'` 만
    - `publishOne(redis, row, pubsubMode)`  
      - Redis Pub/Sub 으로 채팅 이벤트를 발행 (`chat:message` 또는 `conv:{roomId}`)
    - `markPublished(...)` / `reschedule(...)` / `reapExpiredLocks(...)`  
      - 상태 전환, 백오프, 만료 락 해제 처리

---

## ArcYou 채팅 워커 (`worker-arcyou-chat.ts`)

### 역할

- 위치: `apps/outbox-worker/worker-arcyou-chat.ts`
- 컨테이너 / 서비스:
  - Dockerfile: `apps/outbox-worker/Dockerfile`
  - docker-compose 서비스: `outbox-worker` (`arcsolve-outbox-worker-dev`)
- **채팅용 Outbox 레코드**만 소비하여 **Redis Pub/Sub → uws-gateway → WebSocket** 으로 전달
- 문서 도메인용 `type` (`'document.'` 프리픽스)는 **건드리지 않음**

### 동작

1. 시작 시 환경 변수 로드
   - `DATABASE_URL`, `REDIS_URL`, `PUBSUB_MODE`, `POLL_INTERVAL_MS`, `BATCH_SIZE`, `LOCK_SECONDS`, `MAX_ATTEMPTS` 등
2. DB/Redis 헬스 체크 후, `POLL_INTERVAL_MS` 간격으로 loop 실행
3. `claimBatch(...)` 호출 시:
   ```ts
   const batch = await claimBatch(db, outbox, MAX_BATCH, LOCK_SECONDS, WORKER_ID, {
     // 채팅 워커는 문서용 잡(type 이 'document.' 로 시작)을 건드리지 않습니다.
     excludeTypePrefix: 'document.',
   });
   ```
4. 각 row 에 대해:
   - `publishOne(redis, row, pubsubMode)` 로 Redis 발행
   - 성공 시 `markPublished`
   - 실패 시 `reschedule` (지수 백오프, `maxAttempts` 초과 시 `dead`)

> 상세 프로토콜/이벤트 구조는 `docs/arcyou/arcyou-chat-ws.md` 를 참고하세요.

---

## 문서 전처리 워커 (`worker-document.ts`)

### 역할

- 위치: `apps/outbox-worker/worker-document.ts`
- 컨테이너 / 서비스:
  - Dockerfile: `apps/outbox-worker/Dockerfile`
  - docker-compose 서비스: `outbox-worker-document` (`arcsolve-outbox-worker-document-dev`)
- **문서 도메인용 Outbox 레코드**(예: `type = 'document.preprocess.v1'`)만 소비
- 최종 목표:
  - Next 메인 서버에서 업로드 완료 시 **전처리 잡**을 Outbox 에 적재
  - `worker-document` 가 이를 읽어 **사이드카(FastAPI) 전처리 서버**를 호출
  - 파싱/임베딩/저장 완료 후, 문서 상태(`processingStatus`)를 갱신

### 동작

1. 환경 변수
   - `DATABASE_URL` (PgBouncer 경유)
   - `SIDECAR_BASE_URL` 또는 `DOCUMENT_SIDECAR_BASE_URL`: 사이드카 서버 기본 URL
     - Docker Compose 환경: `http://sidecar:8000` (컨테이너 간 통신)
     - 로컬 실행 환경: `http://localhost:8000` (호스트 포트)
   - `POLL_INTERVAL_MS`, `BATCH_SIZE`, `LOCK_SECONDS`, `MAX_ATTEMPTS` 등
2. 루프 내 `claimBatch(...)` 호출:
   ```ts
   const batch = await claimBatch(
     db,
     outbox,
     MAX_BATCH,
     LOCK_SECONDS,
     WORKER_ID,
     {
       includeTypePrefix: 'document.',
     },
   );
   ```
   - → `type LIKE 'document.%'` 인 레코드만 가져옴
3. 각 row 에 대해 (`type='document.preprocess.v1'`):
   - 문서 `processingStatus`를 `pending` → `processing`으로 업데이트
   - 사이드카 서버 호출: `POST {SIDECAR_BASE_URL}/internal/documents/{documentId}/parse`
     - 요청 본문: `{ userId }`
     - 응답: 성공/실패 (JSON, 구체적 데이터는 반환하지 않음)
   - 성공 시: 문서 `processingStatus` → `processed`, Outbox `published`
   - 실패 시: 문서 `processingStatus` → `failed`, Outbox `dead` (재시도 없음, MVP 정책)

---

## Docker / 실행 방법

### 개발용 docker-compose

- 파일: `apps/docker-compose.dev.yml`
- 관련 서비스:
  - `sidecar`
    - 이미지: `apps/sidecar/Dockerfile`
    - 포트: `8000:8000` (호스트:컨테이너)
    - FastAPI 서버로 문서 전처리(파싱/임베딩) API 제공
    - 엔트리포인트: `uvicorn main:app --host 0.0.0.0 --port 8000`
  - `outbox-worker`
    - 이미지: `apps/outbox-worker/Dockerfile`
    - 엔트리포인트: `node dist/worker.js`
    - 내부에서 `import './worker-arcyou-chat'` 로 채팅 워커를 실행
  - `outbox-worker-document`
    - 동일 이미지 재사용
    - 엔트리포인트: `["node", "dist/worker-document.js"]`
    - 사이드카 서버(`sidecar:8000`)를 호출하여 문서 전처리 수행

#### 재빌드 & 재기동 예시

```bash
cd /Users/gyeongmincho/Projects/ArcSolve

# 채팅 워커만 재빌드/재기동
docker compose -f apps/docker-compose.dev.yml --env-file apps/.env.docker up -d --build outbox-worker

# 문서 워커만 재빌드/재기동
docker compose -f apps/docker-compose.dev.yml --env-file apps/.env.docker up -d --build outbox-worker-document

# 사이드카 서버만 재빌드/재기동
docker compose -f apps/docker-compose.dev.yml --env-file apps/.env.docker up -d --build sidecar
```

로그 확인:

```bash
docker compose -f apps/docker-compose.dev.yml --env-file apps/.env.docker logs outbox-worker --tail=50
docker compose -f apps/docker-compose.dev.yml --env-file apps/.env.docker logs outbox-worker-document --tail=50
docker compose -f apps/docker-compose.dev.yml --env-file apps/.env.docker logs sidecar --tail=50
```

### 로컬 단독 실행 (pnpm)

- 패키지: `apps/outbox-worker/package.json`
  - `build`: `tsc -p tsconfig.json`
  - `start`: `node dist/worker.js` (채팅 워커)
  - `start:arcyou-chat`: `node dist/worker-arcyou-chat.js`
  - `start:document`: `node dist/worker-document.js`

예시:

```bash
cd /Users/gyeongmincho/Projects/ArcSolve
pnpm --filter arcsolve-outbox-worker run build
pnpm --filter arcsolve-outbox-worker run start:arcyou-chat
pnpm --filter arcsolve-outbox-worker run start:document
```

> 실제 운영/개발 환경에서는 **docker-compose 기반 실행을 기본**으로 하고,  
> 로컬 디버깅/실험이 필요할 때만 pnpm 스크립트를 사용합니다.

---

## 설계상의 포인트 정리

- **단일 Outbox 테이블 + 다중 워커 패턴**
  - Outbox 스키마와 재시도/백오프 로직은 공통
  - `type` 프리픽스와 `claimBatch` 의 `includeTypePrefix` / `excludeTypePrefix` 로 역할 분리
- **채팅 vs 문서 도메인 분리**
  - 채팅: Redis Pub/Sub → uws-gateway → WebSocket 브로드캐스트
  - 문서: (예정) 사이드카 HTTP 호출 → 파싱/임베딩 → DB/상태 업데이트
- **운영/디버깅 편의성**
  - 채팅/문서 워커를 **서로 다른 컨테이너/프로세스**로 띄워, 로그/부하/장애를 독립적으로 관찰 가능
  - 필요 시 한쪽만 재시작/스케일 아웃하는 전략도 적용하기 쉬움


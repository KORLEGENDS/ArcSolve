# ArcYou 채팅 시스템 아키텍처

## 개요

ArcYou는 실시간 채팅 기능을 제공하는 마이크로서비스 기반 시스템입니다. Outbox 패턴을 활용하여 메시지 전송의 신뢰성을 보장하고, WebSocket과 Redis Pub/Sub를 통해 실시간 메시지 브로드캐스트를 구현합니다.

## 시스템 아키텍처

```
┌─────────────┐
│   Client    │ (WebSocket)
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│ uws-gateway │──────▶│  PostgreSQL  │──────▶│ outbox-worker│
│             │      │  (Outbox)    │      │             │
└──────┬──────┘      └──────────────┘      └──────┬──────┘
       │                                           │
       │                                           ▼
       │                                    ┌─────────────┐
       │                                    │    Redis     │
       └────────────────────────────────────│  Pub/Sub    │
                                            └─────────────┘
```

## 핵심 서비스

### 1. uws-gateway

**역할**: WebSocket 게이트웨이 서버

**주요 기능**:
- WebSocket 연결 관리
- JWT 기반 사용자 인증
- 대화방 참가 관리 (participants 검증)
- 메시지 전송 처리 (트랜잭션: `messages` + `outbox` INSERT)
- Redis Pub/Sub 구독 및 메시지 브로드캐스트

**기술 스택**:
- `ws`: WebSocket 서버
- `ioredis`: Redis 클라이언트
- `jsonwebtoken`: JWT 검증
- `drizzle-orm`: PostgreSQL ORM
- `pg`: PostgreSQL 클라이언트

**주요 엔드포인트**:
- `ws://localhost:8080`: WebSocket 연결
- `GET /health`: 헬스 체크

**WebSocket 메시지 프로토콜**:

```json
// 인증
{ "op": "auth", "token": "user-uuid-or-jwt" }
→ { "op": "auth", "success": true, "userId": "..." }

// 대화방 참가
{ "op": "join", "conversation_id": "conv-uuid" }
→ { "op": "join", "success": true, "conversation_id": "..." }

// 메시지 전송
{
  "op": "send",
  "conversation_id": "conv-uuid",
  "body": { "text": "Hello!" },
  "temp_id": "temp-123"
}
→ { "op": "send", "success": true, "message_id": 1, "temp_id": "..." }

// 이벤트 수신 (브로드캐스트)
{
  "op": "event",
  "type": "message.created",
  "message": { "id": 1, "body": {...}, ... },
  "conversation_id": "...",
  "conversationId": "..."
}
```

### 2. outbox-worker

**역할**: Outbox 패턴 구현 워커

**주요 기능**:
- PostgreSQL `outbox` 테이블 폴링 (1초 간격)
- `FOR UPDATE SKIP LOCKED`를 사용한 동시성 제어
- Redis Pub/Sub로 메시지 퍼블리시
- 처리 완료 후 `processed=true` 업데이트
- 재시도 로직 (최대 5회)

**기술 스택**:
- `pg`: PostgreSQL 클라이언트
- `ioredis`: Redis 클라이언트
- `drizzle-orm`: 스키마 정의

**처리 흐름**:
1. `processed=false` 레코드 조회 (`FOR UPDATE SKIP LOCKED`)
2. Redis Pub/Sub로 메시지 퍼블리시
3. `processed=true` 업데이트
4. 트랜잭션 커밋

**설정**:
- `PUBSUB_MODE=global`: 모든 메시지를 `chat:message` 채널로 퍼블리시
- `PUBSUB_MODE=perconv`: 대화방별 `conv:{conversationId}` 채널로 퍼블리시

## 데이터 흐름

### 메시지 전송 플로우

```
1. Client → uws-gateway (WebSocket)
   op:send 메시지 전송

2. uws-gateway
   - 트랜잭션 시작
   - messages 테이블에 INSERT
   - outbox 테이블에 INSERT (processed=false)
   - 트랜잭션 커밋
   - Client에 ACK 반환

3. outbox-worker
   - 1초마다 outbox 테이블 폴링
   - FOR UPDATE SKIP LOCKED로 레코드 선택
   - Redis Pub/Sub로 메시지 퍼블리시
   - processed=true 업데이트

4. uws-gateway
   - Redis Pub/Sub 구독
   - 해당 conversationId의 모든 클라이언트에 브로드캐스트

5. Clients
   - message.created 이벤트 수신
```

### 동시성 제어

**outbox-worker의 다중 인스턴스 지원**:
- `FOR UPDATE SKIP LOCKED`를 사용하여 동일 레코드의 중복 처리 방지
- 트랜잭션 내에서 SELECT → UPDATE → COMMIT으로 원자성 보장
- 여러 워커가 동시에 실행되어도 각 레코드는 한 번만 처리됨

## 데이터베이스 스키마

### messages 테이블
```sql
- id: bigserial (PK)
- conversation_id: uuid
- sender_id: uuid
- body: jsonb
- created_at: timestamp
```

### outbox 테이블
```sql
- id: bigserial (PK)
- type: text (예: 'message.created')
- conversation_id: uuid
- payload: jsonb
- processed: boolean (default: false)
- processed_at: timestamp
- retry_count: integer (default: 0)
- error: text
- created_at: timestamp
```

### participants 테이블
```sql
- conversation_id: uuid (PK)
- user_id: uuid (PK)
- role: text
- created_at: timestamp
```

## 환경 설정

### 필수 환경 변수

**uws-gateway**:
```bash
DATABASE_URL=postgres://user:pass@pgbouncer:6432/dbname
REDIS_URL=redis://default:password@redis:6379
JWT_PUBLIC_KEY=dev-placeholder  # 개발 환경
PUBSUB_MODE=global  # 또는 perconv
PORT=8080
```

**outbox-worker**:
```bash
DATABASE_URL=postgres://user:pass@pgbouncer:6432/dbname
REDIS_URL=redis://default:password@redis:6379
PUBSUB_MODE=global  # 또는 perconv
```

### JWT 인증

**개발 환경** (`JWT_PUBLIC_KEY=dev-placeholder`):
- UUID 문자열을 직접 userId로 사용
- JWT 검증 없이 인증 처리

**운영 환경**:
- RS256 알고리즘만 허용
- PEM 형식의 공개키로 JWT 검증

## 배포 및 실행

### Docker Compose

```bash
cd apps
docker compose -f docker-compose.dev.yml --env-file .env.docker up -d
```

### 서비스 순서

1. PostgreSQL + PgBouncer
2. Redis
3. uws-gateway
4. outbox-worker

## 테스트

### 채팅 플로우 테스트

1. **대화방 및 참가자 설정**:
```bash
CONV_ID=$(psql -c "INSERT INTO conversations DEFAULT VALUES RETURNING id;")
psql -c "INSERT INTO participants(conversation_id, user_id) 
        VALUES('$CONV_ID', 'user-a-uuid'), ('$CONV_ID', 'user-b-uuid');"
```

2. **WebSocket 연결 테스트**:
```javascript
// User A
const wsA = new WebSocket('ws://localhost:8080');
wsA.send(JSON.stringify({ op: 'auth', token: 'user-a-uuid' }));
wsA.send(JSON.stringify({ op: 'join', conversation_id: CONV_ID }));
wsA.send(JSON.stringify({ 
  op: 'send', 
  conversation_id: CONV_ID,
  body: { text: 'Hello!' }
}));

// User B
const wsB = new WebSocket('ws://localhost:8080');
wsB.send(JSON.stringify({ op: 'auth', token: 'user-b-uuid' }));
wsB.send(JSON.stringify({ op: 'join', conversation_id: CONV_ID }));
// User B는 User A의 메시지를 자동으로 수신
```

3. **검증**:
- `messages` 테이블에 메시지 저장 확인
- `outbox` 테이블의 `processed=true` 확인
- 두 클라이언트 모두 `message.created` 이벤트 수신 확인

## 주요 특징

### 1. 신뢰성 (Reliability)
- **Outbox 패턴**: 메시지 전송과 이벤트 발행을 트랜잭션으로 보장
- **재시도 로직**: 실패한 메시지는 최대 5회 재시도
- **에러 추적**: `outbox.error` 컬럼에 에러 메시지 저장

### 2. 확장성 (Scalability)
- **다중 워커 지원**: `FOR UPDATE SKIP LOCKED`로 안전한 병렬 처리
- **채널 분리**: `PUBSUB_MODE=perconv`로 대화방별 채널 분리 가능
- **PgBouncer**: 연결 풀링으로 데이터베이스 부하 감소

### 3. 실시간성 (Real-time)
- **WebSocket**: 양방향 실시간 통신
- **Redis Pub/Sub**: 낮은 지연시간의 메시지 브로드캐스트
- **즉시 ACK**: 메시지 전송 후 즉시 확인 응답

### 4. 보안 (Security)
- **JWT 인증**: 사용자 인증 및 권한 관리
- **참가자 검증**: 대화방 참가 시 `participants` 테이블 검증
- **RS256 알고리즘**: 운영 환경에서 강력한 암호화

## 문제 해결

### PgBouncer Transaction 모드 호환성

PgBouncer의 transaction pooling 모드에서는 prepared statement 사용 시 문제가 발생할 수 있습니다. 이를 해결하기 위해:

- 파라미터화된 쿼리 사용 (`$1, $2` 형식)
- 트랜잭션 내에서 BEGIN → 쿼리 실행 → COMMIT/ROLLBACK 패턴 준수
- `FOR UPDATE SKIP LOCKED`는 트랜잭션 내에서만 동작

### DB 쿼리 결과 필드명

PostgreSQL의 raw 쿼리 결과는 `snake_case`로 반환됩니다:
- `conversation_id` (O)
- `conversationId` (X - Drizzle 타입 정의와 다름)

코드에서는 `(record as any).conversation_id` 형식으로 접근합니다.

## 향후 개선 사항

1. **메시지 히스토리**: 과거 메시지 조회 API 추가
2. **읽음 확인**: 메시지 읽음 상태 추적
3. **파일 첨부**: 이미지/파일 전송 지원
4. **푸시 알림**: 모바일 푸시 알림 연동
5. **모니터링**: 메트릭 수집 및 대시보드 구축
6. **로드 밸런싱**: 여러 uws-gateway 인스턴스 간 세션 공유

## 참고 자료

- [Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [PgBouncer](https://www.pgbouncer.org/)


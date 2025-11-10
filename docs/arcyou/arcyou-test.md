# ArcYou 채팅 시스템 테스트 가이드

## 빠른 시작

### 1. 환경 설정

**환경변수 파일 위치**: `apps/.env.docker`

필수 환경변수:
```bash
# PostgreSQL
POSTGRES_USER=arcsolve
POSTGRES_PASSWORD=your-password
POSTGRES_DB=arcsolve_dev

# Redis
REDIS_PASSWORD=your-redis-password

# JWT (개발 환경)
JWT_PUBLIC_KEY=dev-placeholder

# Pub/Sub 모드 (선택)
PUBSUB_MODE=global  # 또는 perconv
```

### 2. 서비스 시작

```bash
cd apps
docker compose -f docker-compose.dev.yml --env-file .env.docker up -d
```

**주요 서비스**:
- `uws-gateway`: WebSocket 서버 (포트 8080)
- `outbox-worker`: Outbox 처리 워커
- `postgres`: PostgreSQL 데이터베이스 (포트 5432)
- `pgbouncer`: 연결 풀링 (포트 6432)
- `redis`: Redis Pub/Sub (포트 6379)

### 3. 서비스 상태 확인

```bash
# 전체 서비스 상태
docker compose -f docker-compose.dev.yml --env-file .env.docker ps

# 특정 서비스 로그
docker compose -f docker-compose.dev.yml --env-file .env.docker logs uws-gateway --tail 50
docker compose -f docker-compose.dev.yml --env-file .env.docker logs outbox-worker --tail 50
```

### 4. 서비스 재시작

```bash
# 특정 서비스만 재시작
docker compose -f docker-compose.dev.yml --env-file .env.docker restart uws-gateway
docker compose -f docker-compose.dev.yml --env-file .env.docker restart outbox-worker

# 특정 서비스 재빌드 및 재시작
docker compose -f docker-compose.dev.yml --env-file .env.docker build uws-gateway
docker compose -f docker-compose.dev.yml --env-file .env.docker up -d uws-gateway
```

### 5. 서비스 중지

```bash
# 모든 서비스 중지 (데이터 유지)
docker compose -f docker-compose.dev.yml --env-file .env.docker stop

# 모든 서비스 중지 및 삭제 (데이터 유지)
docker compose -f docker-compose.dev.yml --env-file .env.docker down

# 모든 서비스 삭제 및 볼륨 삭제 (데이터 삭제)
docker compose -f docker-compose.dev.yml --env-file .env.docker down -v
```

---

## 테스트 방법

### WebSocket 연결 테스트

**엔드포인트**: `ws://localhost:8080`

**인증** (개발 환경):
```json
{
  "op": "auth",
  "token": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
}
```

**대화방 참가**:
```json
{
  "op": "join",
  "conversation_id": "conversation-uuid"
}
```

**메시지 전송**:
```json
{
  "op": "send",
  "conversation_id": "conversation-uuid",
  "body": { "text": "테스트 메시지" },
  "temp_id": "temp-123"
}
```

**읽음 상태 업데이트**:
```json
{
  "op": "ack",
  "conversation_id": "conversation-uuid",
  "last_read_id": 123
}
```

### Node.js로 간단 테스트

```bash
cd apps
node -e "
import('ws').then(({ WebSocket }) => {
  const ws = new WebSocket('ws://localhost:8080');
  ws.on('open', () => {
    console.log('✅ 연결 성공');
    ws.send(JSON.stringify({ op: 'auth', token: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }));
  });
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📨 수신:', JSON.stringify(msg).substring(0, 100));
  });
});
"
```

---

## 로그 확인 팁

### 게이트웨이 로그

```bash
# 실시간 로그
docker compose -f docker-compose.dev.yml --env-file .env.docker logs -f uws-gateway

# 특정 키워드 필터링
docker compose -f docker-compose.dev.yml --env-file .env.docker logs uws-gateway | grep -E "(auth|join|send|Redis|error)"
```

**정상 작동 시 확인 사항**:
- `[gateway] listening 8080`
- `[Redis] subscriber connected`
- `[Redis] SUBSCRIBE chat:message`

### 워커 로그

```bash
# 실시간 로그
docker compose -f docker-compose.dev.yml --env-file .env.docker logs -f outbox-worker

# Outbox 처리 상태 확인
docker compose -f docker-compose.dev.yml --env-file .env.docker logs outbox-worker | grep -E "(published|failed|Outbox)"
```

**정상 작동 시 확인 사항**:
- `[Outbox] starting...`
- `[Outbox] published X / X` (처리된 레코드 수)
- `DB=postgres://...` (연결 정보)

---

## 데이터베이스 접근

### PostgreSQL 직접 접근

```bash
# Docker 컨테이너 내부에서 접근
docker compose -f docker-compose.dev.yml --env-file .env.docker exec postgres psql -U arcsolve -d arcsolve_dev

# 또는 PgBouncer 경유 (권장)
docker compose -f docker-compose.dev.yml --env-file .env.docker exec pgbouncer psql -h localhost -p 6432 -U arcsolve -d arcsolve_dev
```

### 유용한 SQL 쿼리

```sql
-- Outbox 상태 확인
SELECT id, status, attempts, published_at, error 
FROM outbox 
ORDER BY id DESC 
LIMIT 10;

-- 참가자 확인
SELECT conversation_id, user_id, last_read_id 
FROM participants 
WHERE conversation_id = 'your-conversation-id';

-- 메시지 확인
SELECT id, conversation_id, sender_id, body, created_at 
FROM messages 
WHERE conversation_id = 'your-conversation-id' 
ORDER BY id DESC 
LIMIT 10;
```

---

## 트러블슈팅

### 문제: 워커가 계속 재시작됨

**원인**: 환경변수가 제대로 전달되지 않음

**해결**:
```bash
# 컨테이너 완전 삭제 후 재생성
docker compose -f docker-compose.dev.yml --env-file .env.docker stop outbox-worker
docker compose -f docker-compose.dev.yml --env-file .env.docker rm -f outbox-worker
docker compose -f docker-compose.dev.yml --env-file .env.docker up -d outbox-worker

# 로그 확인
docker compose -f docker-compose.dev.yml --env-file .env.docker logs outbox-worker --tail 30
```

### 문제: Redis 연결 실패

**확인**:
```bash
# Redis 상태 확인
docker compose -f docker-compose.dev.yml --env-file .env.docker exec redis redis-cli -a ${REDIS_PASSWORD} ping

# Redis 채널 구독 확인
docker compose -f docker-compose.dev.yml --env-file .env.docker exec redis redis-cli -a ${REDIS_PASSWORD} PUBSUB CHANNELS
```

### 문제: WebSocket 연결 실패

**확인**:
```bash
# 게이트웨이 포트 확인
docker compose -f docker-compose.dev.yml --env-file .env.docker ps uws-gateway

# 게이트웨이 로그 확인
docker compose -f docker-compose.dev.yml --env-file .env.docker logs uws-gateway --tail 20
```

### 문제: Outbox가 처리되지 않음

**확인**:
```bash
# 워커 로그 확인
docker compose -f docker-compose.dev.yml --env-file .env.docker logs outbox-worker | grep -E "(published|failed|error)"

# DB에서 Outbox 상태 확인
docker compose -f docker-compose.dev.yml --env-file .env.docker exec postgres psql -U arcsolve -d arcsolve_dev -c "SELECT status, COUNT(*) FROM outbox GROUP BY status;"
```

---

## 환경변수 체크리스트

서비스 시작 전 확인:

- [ ] `POSTGRES_USER` 설정됨
- [ ] `POSTGRES_PASSWORD` 설정됨
- [ ] `POSTGRES_DB` 설정됨
- [ ] `REDIS_PASSWORD` 설정됨
- [ ] `JWT_PUBLIC_KEY` 설정됨 (개발: `dev-placeholder`)
- [ ] `.env.docker` 파일이 `apps/` 디렉토리에 존재

---

## 빠른 참조

### 자주 사용하는 명령어

```bash
# 전체 시작
cd apps && docker compose -f docker-compose.dev.yml --env-file .env.docker up -d

# 전체 중지
cd apps && docker compose -f docker-compose.dev.yml --env-file .env.docker stop

# 로그 확인 (게이트웨이)
cd apps && docker compose -f docker-compose.dev.yml --env-file .env.docker logs -f uws-gateway

# 로그 확인 (워커)
cd apps && docker compose -f docker-compose.dev.yml --env-file .env.docker logs -f outbox-worker

# 재시작 (게이트웨이)
cd apps && docker compose -f docker-compose.dev.yml --env-file .env.docker restart uws-gateway

# 재시작 (워커)
cd apps && docker compose -f docker-compose.dev.yml --env-file .env.docker restart outbox-worker
```

### 포트 정보

- **8080**: uws-gateway (WebSocket)
- **5432**: PostgreSQL (직접 접근)
- **6432**: PgBouncer (권장 접근)
- **6379**: Redis

---

## 참고 문서

- API 명세: `docs/arcyou/arcyou-api.md`
- 아키텍처: `docs/arcyou/arcyou-chat.md`
- 필요 사항: `docs/arcyou/arcyou-need-to.md`


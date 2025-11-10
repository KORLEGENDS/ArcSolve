# ArcYou 채팅 서비스 외부 API 명세

## 개요

현재 구현된 채팅 시스템의 외부 접근 가능한 API와 필요한 추가 API를 정리합니다.

**최종 업데이트**: 2025-11-10 (모든 기능 테스트 완료 및 검증됨)

---

## 현재 구현된 외부 접근 API

### 1. WebSocket API (uws-gateway)

**엔드포인트**: `ws://{host}:8080`

**프로토콜**: WebSocket (JSON 메시지)

#### 1.1 인증 (auth)

**요청**:
```json
{
  "op": "auth",
  "token": "user-uuid-or-jwt-token"
}
```

**응답 (성공)**:
```json
{
  "op": "auth",
  "success": true,
  "userId": "user-uuid"
}
```

**응답 (실패)**:
```json
{
  "op": "auth",
  "success": false,
  "error": "Unauthorized: Invalid token"
}
```

**설명**:
- 개발 환경 (`JWT_PUBLIC_KEY=dev-placeholder`): UUID 문자열을 직접 userId로 사용
- 운영 환경: RS256 알고리즘으로 JWT 토큰 검증
- 인증 후에만 다른 작업 수행 가능

#### 1.2 대화방 참가 (join)

**요청**:
```json
{
  "op": "join",
  "conversation_id": "conversation-uuid"
}
```

**응답 (성공)**:
```json
{
  "op": "join",
  "success": true,
  "conversation_id": "conversation-uuid"
}
```

**응답 (실패)**:
```json
{
  "op": "join",
  "success": false,
  "error": "Forbidden: Not a participant"
}
```

**설명**:
- `participants` 테이블에서 사용자가 해당 대화방의 참가자인지 검증
- 참가 성공 시 해당 대화방의 메시지를 수신할 수 있음
- 한 번에 하나의 대화방만 참가 가능 (이전 대화방 자동 해제)
- 참가 성공 직후 **보강 전송 (backfill)** 자동 실행:
  - `participants.last_read_id` 이후의 메시지를 조회하여 `source: "backfill"` 이벤트로 전송
  - 최대 `MAX_MSGS_ON_JOIN`개 (기본 500개)까지 전송
  - 메시지는 오래된 순서대로 전송됨

#### 1.3 메시지 전송 (send)

**요청**:
```json
{
  "op": "send",
  "conversation_id": "conversation-uuid",
  "body": {
    "text": "메시지 내용"
  },
  "temp_id": "optional-temp-id"
}
```

**응답 (성공)**:
```json
{
  "op": "send",
  "success": true,
  "message_id": 123,
  "temp_id": "optional-temp-id"
}
```

**응답 (실패)**:
```json
{
  "op": "send",
  "success": false,
  "error": "conversation_id required",
  "temp_id": "optional-temp-id"
}
```

**설명**:
- 트랜잭션으로 `messages` 테이블과 `outbox` 테이블에 동시 INSERT
- 즉시 ACK 반환 (메시지 저장 완료)
- 실제 브로드캐스트는 outbox-worker를 통해 비동기로 처리됨
- Outbox 레코드는 `status: 'pending'`으로 생성되며, 워커가 처리 후 `published`로 변경

#### 1.4 읽음 상태 업데이트 (ack)

**요청**:
```json
{
  "op": "ack",
  "conversation_id": "conversation-uuid",
  "last_read_id": 123
}
```

**응답 (성공)**:
```json
{
  "op": "ack",
  "success": true,
  "conversation_id": "conversation-uuid",
  "last_read_id": 123
}
```

**응답 (실패)**:
```json
{
  "op": "ack",
  "success": false,
  "error": "conversation_id & last_read_id required"
}
```

**설명**:
- `participants.last_read_id`를 업데이트하여 읽음 상태를 관리
- `last_read_id`는 해당 메시지 ID 이하의 모든 메시지를 읽은 것으로 표시
- `GREATEST(last_read_id, $1)`로 이전 값보다 작은 값으로 업데이트되는 것을 방지

#### 1.5 이벤트 수신 (event)

**실시간 메시지 (live)**:
```json
{
  "op": "event",
  "type": "message.created",
  "conversationId": "conversation-uuid",
  "message": {
    "id": 123,
    "sender_id": "user-uuid",
    "body": {
      "text": "메시지 내용"
    },
    "created_at": "2025-11-10T02:26:35.185Z",
    "temp_id": "optional-temp-id"
  },
  "timestamp": "2025-11-10T02:26:35.185Z",
  "source": "live"
}
```

**보강 메시지 (backfill)**:
```json
{
  "op": "event",
  "type": "message.created",
  "conversationId": "conversation-uuid",
  "message": {
    "id": 120,
    "sender_id": "user-uuid",
    "body": {
      "text": "이전 메시지 내용"
    },
    "created_at": "2025-11-10T02:20:00.000Z"
  },
  "timestamp": "2025-11-10T02:26:35.185Z",
  "source": "backfill"
}
```

**설명**:
- `source: "live"`: 실시간으로 전송된 메시지 (Redis Pub/Sub를 통해 브로드캐스트)
- `source: "backfill"`: `join` 직후 자동으로 전송되는 미수신 메시지
- 보강 전송은 `participants.last_read_id` 이후의 메시지만 전송 (최대 `MAX_MSGS_ON_JOIN`개, 기본 500개)
- 대화방에 참가한 모든 클라이언트에게 브로드캐스트됨
- `temp_id`로 클라이언트 측 임시 메시지와 매칭 가능 (실시간 메시지만 포함)

---

### 2. HTTP API (uws-gateway)

#### 2.1 헬스 체크

**엔드포인트**: `GET /health`

**응답**:
```json
{
  "ok": true
}
```

**설명**:
- 서비스 상태 확인용
- 로드 밸런서 헬스 체크에 사용 가능

---

## 필요한 추가 API (미구현)

현재 WebSocket API만으로는 실제 채팅 서비스를 운영하기 어렵습니다. 다음 REST API들이 필요합니다:

### 1. 대화방 관리 API

#### 1.1 대화방 생성
```
POST /api/conversations
Authorization: Bearer {jwt-token}

Request Body:
{
  "title": "대화방 제목 (optional)",
  "participant_ids": ["user-uuid-1", "user-uuid-2"]
}

Response:
{
  "id": "conversation-uuid",
  "title": "대화방 제목",
  "created_at": "2025-11-10T02:26:35.185Z",
  "participants": [...]
}
```

#### 1.2 대화방 목록 조회
```
GET /api/conversations
Authorization: Bearer {jwt-token}
Query Parameters:
  - limit: number (default: 20)
  - offset: number (default: 0)

Response:
{
  "conversations": [
    {
      "id": "conversation-uuid",
      "title": "대화방 제목",
      "last_message": {...},
      "unread_count": 5,
      "updated_at": "2025-11-10T02:26:35.185Z"
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

#### 1.3 대화방 상세 조회
```
GET /api/conversations/{conversation_id}
Authorization: Bearer {jwt-token}

Response:
{
  "id": "conversation-uuid",
  "title": "대화방 제목",
  "participants": [
    {
      "user_id": "user-uuid",
      "role": "member",
      "last_read_id": 100
    }
  ],
  "created_at": "2025-11-10T02:26:35.185Z"
}
```

#### 1.4 참가자 추가
```
POST /api/conversations/{conversation_id}/participants
Authorization: Bearer {jwt-token}

Request Body:
{
  "user_ids": ["user-uuid-1", "user-uuid-2"]
}

Response:
{
  "success": true,
  "added_participants": [...]
}
```

#### 1.5 참가자 제거
```
DELETE /api/conversations/{conversation_id}/participants/{user_id}
Authorization: Bearer {jwt-token}

Response:
{
  "success": true
}
```

---

### 2. 메시지 관리 API

#### 2.1 메시지 히스토리 조회
```
GET /api/conversations/{conversation_id}/messages
Authorization: Bearer {jwt-token}
Query Parameters:
  - limit: number (default: 50)
  - before_id: number (optional, 페이지네이션)
  - after_id: number (optional, 페이지네이션)

Response:
{
  "messages": [
    {
      "id": 123,
      "sender_id": "user-uuid",
      "body": {
        "text": "메시지 내용"
      },
      "created_at": "2025-11-10T02:26:35.185Z"
    }
  ],
  "has_more": true,
  "limit": 50
}
```

#### 2.2 메시지 검색
```
GET /api/conversations/{conversation_id}/messages/search
Authorization: Bearer {jwt-token}
Query Parameters:
  - q: string (검색어)
  - limit: number (default: 20)

Response:
{
  "messages": [...],
  "total": 10
}
```

---

### 3. 읽음 상태 관리 API

#### 3.1 읽음 상태 업데이트
```
PUT /api/conversations/{conversation_id}/read
Authorization: Bearer {jwt-token}

Request Body:
{
  "last_read_id": 123
}

Response:
{
  "success": true,
  "last_read_id": 123
}
```

#### 3.2 읽지 않은 메시지 수 조회
```
GET /api/conversations/unread-count
Authorization: Bearer {jwt-token}

Response:
{
  "total_unread": 15,
  "by_conversation": {
    "conversation-uuid-1": 5,
    "conversation-uuid-2": 10
  }
}
```

---

## API 구현 위치 제안

### 옵션 1: Next.js 메인 서버에 구현 (권장)

**장점**:
- 기존 인증 시스템과 통합 용이
- Drizzle ORM 스키마 재사용 가능
- 클라이언트와 서버 코드 공유

**구현 위치**:
```
apps/main/src/app/(backend)/api/
  ├── conversations/
  │   ├── route.ts                    # GET, POST /api/conversations
  │   ├── [id]/
  │   │   ├── route.ts               # GET, PUT, DELETE /api/conversations/{id}
  │   │   ├── messages/
  │   │   │   └── route.ts           # GET /api/conversations/{id}/messages
  │   │   └── participants/
  │   │       └── route.ts           # POST, DELETE /api/conversations/{id}/participants
  └── read/
      └── route.ts                    # PUT /api/conversations/{id}/read
```

### 옵션 2: 별도 REST API 서버

**장점**:
- 관심사 분리
- 독립적인 스케일링 가능

**단점**:
- 인증 시스템 중복 구현 필요
- 스키마 동기화 필요

---

## 인증 및 권한

### 인증 방식

**현재 구현**:
- WebSocket: JWT 토큰 또는 UUID (개발 환경)
- HTTP API: Next.js 인증 시스템 활용 (NextAuth.js)

**권장**:
- 모든 API에 동일한 JWT 토큰 사용
- `Authorization: Bearer {jwt-token}` 헤더

### 권한 체크

**대화방 접근 권한**:
- `participants` 테이블에서 `user_id`와 `conversation_id` 조합 확인
- 참가자가 아니면 403 Forbidden 반환

**관리자 권한**:
- `participants.role = 'admin'`인 경우에만:
  - 참가자 추가/제거
  - 대화방 삭제
  - 대화방 설정 변경

---

## 데이터 흐름 요약

### 현재 구현된 흐름

#### 기본 채팅 흐름
```
1. 클라이언트 → WebSocket 연결
2. 클라이언트 → auth (인증)
3. 클라이언트 → join (대화방 참가)
   → 서버: 보강 전송 (backfill) - last_read_id 이후 메시지 자동 전송
4. 클라이언트 → send (메시지 전송)
   → 서버: DB 저장 + Outbox 레코드 생성 (status: pending)
   → 서버: 즉시 ACK 반환
5. Outbox Worker: Outbox 레코드 처리
   → Redis Pub/Sub 발행
   → Outbox 상태: pending → in_progress → published
6. 게이트웨이: Redis 구독 → event (source: live) 브로드캐스트
7. 클라이언트 → ack (읽음 상태 업데이트)
   → 서버: participants.last_read_id 업데이트
```

#### 보강 전송 (Backfill) 흐름
```
1. 클라이언트 → join (대화방 참가)
2. 서버: participants.last_read_id 조회
3. 서버: messages 테이블에서 last_read_id < id 조건으로 조회
4. 서버: 조회된 메시지를 event (source: backfill)로 전송
5. 클라이언트: 미수신 메시지 수신
```

#### Outbox 패턴 흐름
```
1. 게이트웨이: 메시지 저장 시 outbox 테이블에 레코드 생성 (status: pending)
2. Outbox Worker: 주기적으로 pending 상태 레코드 조회 (FOR UPDATE SKIP LOCKED)
3. Outbox Worker: 상태를 in_progress로 변경
4. Outbox Worker: Redis Pub/Sub에 발행
5. Outbox Worker: 발행 성공 시 상태를 published로 변경
6. Outbox Worker: 발행 실패 시 재시도 (exponential backoff)
   - attempts 증가, next_attempt_at 설정
   - MAX_ATTEMPTS 초과 시 dead 상태로 변경
```

### 필요한 추가 흐름 (REST API 구현 후)

```
1. 클라이언트 → REST API: 대화방 목록 조회
2. 클라이언트 → REST API: 대화방 생성
3. 클라이언트 → REST API: 메시지 히스토리 조회
4. 클라이언트 → WebSocket: 연결 및 인증
5. 클라이언트 → WebSocket: join (대화방 참가)
   → 서버: 보강 전송 (backfill) 자동 실행
6. 클라이언트 → WebSocket: send (메시지 전송)
7. 서버 → WebSocket: event (source: live) 브로드캐스트
8. 클라이언트 → WebSocket: ack (읽음 상태 업데이트)
```

---

## 참고사항

### WebSocket 관련
1. **WebSocket 연결 유지**: 클라이언트는 앱 실행 중 WebSocket 연결을 유지해야 함
2. **재연결 처리**: 네트워크 끊김 시 자동 재연결 및 재인증 로직 필요
3. **보강 전송**: `join` 직후 자동으로 미수신 메시지가 전송되므로, 별도의 히스토리 조회가 필요 없을 수 있음
4. **이벤트 구분**: `source: "live"`와 `source: "backfill"`을 구분하여 UI에 반영 가능
5. **읽음 상태 관리**: `ack` op로 주기적으로 `last_read_id`를 업데이트하여 읽음 상태 동기화

### 성능 및 제한사항
1. **역압 (Backpressure)**: 클라이언트 버퍼가 `WS_SEND_HIGH_WATER` (기본 5MB) 초과 시 연결 종료
2. **레이트 리미팅**: 토큰 버킷 알고리즘으로 요청 제한 (`RL_BUCKET_CAPACITY`: 기본 30개, `RL_REFILL_MS`: 기본 10초)
3. **보강 메시지 제한**: `MAX_MSGS_ON_JOIN` (기본 500개)를 초과하는 메시지는 보강되지 않음
4. **Outbox 재시도**: 실패한 메시지는 exponential backoff로 재시도 (최대 `MAX_ATTEMPTS`번)

### 데이터 일관성
1. **Outbox 패턴**: 메시지 저장과 브로드캐스트가 분리되어 있어, 저장은 성공했지만 브로드캐스트가 실패할 수 있음
2. **상태 머신**: Outbox 레코드는 `pending → in_progress → published | dead` 상태로 전이
3. **순서 보장**: Outbox 레코드는 `id` 순서로 처리되어 메시지 순서 보장

### REST API 관련 (미구현)
1. **오프라인 메시지**: WebSocket 연결이 끊긴 동안의 메시지는 REST API로 조회
2. **페이지네이션**: 메시지 히스토리는 커서 기반 페이지네이션 권장
3. **실시간 동기화**: 대화방 목록의 마지막 메시지, 읽지 않은 메시지 수는 WebSocket 이벤트로 업데이트


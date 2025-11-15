## ArcYou 채팅 WebSocket 구현 상세

최종 업데이트: 2025-11-XX

이 문서는 ArcYou 채팅의 WebSocket(이하 WS) 레이어에 한정하여,
게이트웨이(uws-gateway) / Outbox 워커 / 클라이언트(브라우저)의 동작을 상세히 정리한 문서입니다.

### 1) 전체 개요

- **구성 요소**
  - uws-gateway (`apps/uws-gateway/server.ts`)
  - Outbox 워커 (`apps/outbox-worker/worker.ts`)
  - Next 메인 서버 (토큰 발급 및 REST API)
  - 브라우저 클라이언트
    - 대화방 WS: `ArcYouChatRoom`
    - 방 목록 WS: `useRoomActivitySocket`

- **기본 흐름**
  1. 브라우저가 Next 메인 서버에서 **JWT 토큰 발급** (`/api/arcyou/chat/ws/token`)
  2. 브라우저가 uws-gateway WS 엔드포인트에 접속 (`NEXT_PUBLIC_CHAT_WS_URL`)
  3. `{ op:'auth', token }` 으로 인증
  4. (대화방) `{ op:'join', room_id }` 로 방 조인
  5. (방 목록) `{ op:'rooms', action:'watch' }` 로 방 목록 watcher 등록
  6. 클라이언트는
     - 대화방 WS를 통해 메시지 전송/수신
     - 방 목록 WS를 통해 `op:'room-activity'` 이벤트 수신 후 React Query 캐시 갱신

자세한 API/REST 레이어 설명은 `arcyou-chat.md`를 참고하고,
여기서는 WS 레이어에 집중합니다.

---

### 2) WS 프로토콜 정의

#### 2-1. 공통 필드

- **모든 메시지**는 JSON 오브젝트이며, 최소한 `op: string` 필드를 가집니다.
- 서버가 클라이언트로 보내는 응답/이벤트에는 보통 다음 필드가 추가될 수 있습니다.
  - `success?: boolean`
  - `error?: string`
  - `timestamp?: string` (ISO 문자열, 게이트웨이 측에서 부가)
  - `source?: 'live' | 'backfill'` (이벤트 출처)

#### 2-2. 인증 (`auth`)

- 클라이언트 → 서버:

```json
{ "op": "auth", "token": "<JWT 토큰 문자열>" }
```

- 서버 → 클라이언트:

```json
{ "op": "auth", "success": true, "userId": "<uuid>" }
```

또는 인증 실패 시:

```json
{ "op": "auth", "success": false, "error": "Unauthorized" }
```

- 토큰은 Next 메인 서버의 `GET /api/arcyou/chat/ws/token` 에서 발급되며,
  RS256, `sub = userId`, 선택적 `issuer/audience` 를 포함합니다.

#### 2-3. 방 참가 (`join`)

- 클라이언트 → 서버:

```json
{ "op": "join", "room_id": "<room-uuid>" }
```

- 서버 동작:
  - `arcyou_chat_members` 에서 `(roomId, userId)` 로 멤버십 검증
  - 성공 시 `channelClients[roomId]` 에 현재 WebSocket 등록
  - `backfillSince` 를 통해 사용자가 읽지 않은 메시지들을 `op:'event'`로 보강 전송

- 서버 → 클라이언트:

```json
{ "op": "join", "success": true, "room_id": "<room-uuid>" }
```

실패 시:

```json
{ "op": "join", "success": false, "error": "Forbidden: not a member" }
```

#### 2-4. 메시지 전송 (`send`)

- 클라이언트 → 서버:

```json
{
  "op": "send",
  "room_id": "<room-uuid>",
  "content": { "text": "hello" },
  "temp_id": "temp-1700000000000"
}
```

- 서버 동작:
  1. `arcyou_chat_members` 로 멤버십 검증
  2. 트랜잭션 내에서
     - `arcyou_chat_messages` insert
     - `arcyou_chat_rooms.last_message_id`, `updated_at` 업데이트
     - `arcyou_chat_members` 에서 해당 방 멤버 목록 조회 → `recipients: userId[]` 생성
     - `outbox` 에 다음 payload로 insert:

```json
{
  "type": "message.created",
  "roomId": "<room-uuid>",
  "payload": {
    "op": "event",
    "type": "message.created",
    "roomId": "<room-uuid>",
    "message": {
      "id": 123,
      "user_id": "<sender-user-uuid>",
      "content": { "text": "hello" },
      "created_at": "2025-11-15T00:00:00.000Z",
      "temp_id": "temp-1700000000000"
    },
    "recipients": ["<member-user-uuid-1>", "<member-user-uuid-2>", "..."]
  }
}
```

- 서버 → 클라이언트 (ACK):

```json
{
  "op": "send",
  "success": true,
  "message_id": 123,
  "temp_id": "temp-1700000000000"
}
```

클라이언트는 이 ACK를 이용해 낙관적 메시지의 상태를 `sending → sent` 로 전환합니다.

#### 2-5. 라이브 이벤트 (`event`)

- 게이트웨이가 Redis Pub/Sub → 방 소켓으로 전달하는 메시지 형식:

```json
{
  "op": "event",
  "type": "message.created",
  "roomId": "<room-uuid>",
  "message": {
    "id": 123,
    "user_id": "<sender-user-uuid>",
    "content": { "text": "hello" },
    "created_at": "2025-11-15T00:00:00.000Z",
    "temp_id": "temp-1700000000000"
  },
  "timestamp": "2025-11-15T00:00:01.000Z",
  "source": "live"
}
```

- `source: "backfill"` 인 경우는 `join` 이후, 아직 읽지 못한 메시지에 대한 보강 전송입니다.

#### 2-6. 읽음 동기화 (`ack`)

- 클라이언트 → 서버:

```json
{
  "op": "ack",
  "room_id": "<room-uuid>",
  "last_read_message_id": 123
}
```

- 서버 동작:
  - `arcyou_chat_members.last_read_message_id` 를 `GREATEST(last_read_message_id, 123)` 로 갱신
  - 별도 응답은 없으며, 실패 시 `op:'error'` 로 통지될 수 있습니다.

#### 2-7. 방 목록 watcher 등록 (`op: 'rooms', action: 'watch'`)

-- 클라이언트 → 서버:

```json
{ "op": "rooms", "action": "watch" }
```

- 서버 동작:
  - 인증된 사용자(`ci.userId`)를 기준으로 `userWatchers[userId]` Set에 현재 WebSocket 등록
  - 이후 Outbox → Redis → 게이트웨이로 들어오는 메시지에 포함된 `recipients` 배열을 사용해
    해당 사용자 watcher 소켓으로 `op:'room-activity'` 이벤트를 브로드캐스트

-- 서버 → 클라이언트:

```json
{ "op": "rooms", "event": "watch", "success": true }
```

#### 2-8. 방 목록 실시간 업데이트 (`room-activity`)

-- 서버 → 클라이언트(watcher WS):

```json
{
  "op": "rooms",
  "event": "room.activity",
  "roomId": "<room-uuid>",
  "lastMessageId": 123,
  "createdAt": "2025-11-15T00:00:00.000Z"
}
```

- 클라이언트는 이 이벤트를 수신하면
  - React Query 캐시에서 해당 room을 찾아 `lastMessageId`/`updatedAt` 을 갱신하고
  - 방 목록 배열에서 해당 room을 맨 앞으로 이동시켜 UI 상단에 표시합니다.

---

### 3) uws-gateway 내부 구조

#### 3-1. 주요 인메모리 구조

- `channelClients: Map<string, Set<WebSocket>>`
  - key: `roomId`
  - value: 해당 방에 `join`한 WebSocket들의 집합
- `clients: Map<WebSocket, ClientInfo>`
  - key: WebSocket 인스턴스
  - value: `{ userId?: string, roomId?: string, authenticated?: boolean, tokens, lastRefillAt }`
- `userWatchers: Map<string, Set<WebSocket>>`
  - key: `userId`
  - value: 해당 사용자의 방 목록 업데이트를 구독하는 watcher 소켓들

#### 3-2. Rate limiting

- `takeToken(ClientInfo, RL_REFILL_MS, RL_BUCKET_CAPACITY)` 를 통해
  - 일정 기간(`RL_REFILL_MS`)마다 토큰 버킷을 채우고
  - 각 메시지 처리 시 토큰을 하나씩 감소시키며
  - 버킷이 비어 있으면 `{ op:'error', error:'Rate limited' }` 를 반환합니다.

#### 3-3. Redis 구독 및 브로드캐스트

- Outbox 워커는 `PUBSUB_MODE` 에 따라 다음 채널로 발행:
  - `global`: `chat:message`
  - `perconv`: `conv:{roomId}`

- 게이트웨이는 다음 이벤트를 처리:

```ts
subscriber.on('message', (channel, message) => { ... });
subscriber.on('pmessage', (pattern, channel, message) => { ... });
```

- 처리 로직:
  1. `message` 를 JSON parse → `data`
  2. `roomId` 계산
  3. `broadcastToRoom(channelClients, roomId, payload, WS_SEND_HIGH_WATER)`
     - `payload` = `{ ...data, timestamp, source:'live' }`
  4. `recipients` 가 있다면 `userWatchers` 를 통해 각 사용자 watcher 소켓에
     - `{ op:'room-activity', roomId, lastMessageId, createdAt }` 를 전송

---

### 4) Outbox 워커 동작 (WS 관점)

#### 4-1. Outbox 스키마 요약

- 주요 필드:
  - `id: number`
  - `type: string` (`'message.created'` 등)
  - `roomId: uuid`
  - `payload: jsonb` (게이트웨이가 그대로 WS로 보낼 수 있는 형태)
  - `status: 'pending' | 'in_progress' | 'published' | 'dead'`
  - `attempts`, `nextAttemptAt`, `error` 등 백오프/에러 관리 필드

#### 4-2. 루프

1. `claimBatch` 로 `pending && next_attempt_at <= NOW()` 레코드를 락 잡고 `in_progress` 로 전환
2. 각 row에 대해 `publishOne(redis, row, pubsubMode)` 호출
   - `pubsubMode === 'perconv'` → `conv:{roomId}`
   - 그 외 → `chat:message`
   - `payload` 에 `roomId` 가 없으면 `row.roomId` 로 보강
3. 성공 시 `markPublished` 로 `status='published'` 업데이트
4. 실패 시 `reschedule` 로 백오프 및 재시도 관리

WS 관점에서 Outbox 워커는 **“DB 트랜잭션으로 적재된 이벤트를 Redis Pub/Sub으로 전달하는 브리지”** 이며,
게이트웨이가 이 스트림을 구독해 클라이언트로 WS 이벤트를 전달합니다.

---

### 5) 클라이언트 구현 (WS 레이어)

#### 5-1. ArcYouChatRoom (대화방 WS)

- 파일: `apps/main/src/client/components/arc/ArcYou/ArcYouChat/ArcYouChatRoom.tsx`
- 역할:
  - 특정 `roomId` 에 대한 메시지 히스토리 로딩
  - 실시간 메시지 송수신
  - 낙관적 업데이트 및 ACK/이벤트 기반 상태 전환
  - 읽음 ACK(`op:'ack'`) 전송
- 주요 포인트:
  - 마운트 시:
    1. `/api/arcyou/chat/ws/token` 으로 JWT 발급
    2. `NEXT_PUBLIC_CHAT_WS_URL` 로 WS 연결
    3. `{ op:'auth', token }` → `{ op:'auth', success:true, userId }` 수신
    4. REST로 히스토리 로드 → ASC 정렬하여 로컬 상태 앞쪽에 배치
    5. `{ op:'join', room_id }` 전송 → `{ op:'join', success:true }` 수신 시 `ready=true`
  - 전송:
    - 입력값으로 낙관적 메시지를 `status:'sending'` 으로 추가
    - `{ op:'send', room_id, content:{text}, temp_id }` 전송
    - `{ op:'send', success:true, message_id, temp_id }` ACK 수신 시 `status:'sent'` 로 전환
  - 라이브 이벤트:
    - `op:'event', type:'message.created'` 수신 시
      - `temp_id` 매칭이면 기존 낙관적 메시지를 `status:'delivered'` 로 승격
      - 아니라면 중복 체크 후 새 메시지 추가
    - 매 메시지 처리 후 `scheduleAck()` 로 읽음 ACK 디바운스 전송

#### 5-2. useRoomActivitySocket / useBumpChatRoomActivity (방 목록 WS)

- 파일: `apps/main/src/client/states/queries/useArcyouChat.ts`

1. `useBumpChatRoomActivity`
   - 인자: `(roomId, { lastMessageId?, updatedAt? })`
   - 동작:
     - React Query 캐시에서 `chatRooms.list()`, `list('direct')`, `list('group')` 데이터를 읽어
     - 해당 `roomId` 를 가진 room을 찾아 `lastMessageId`/`updatedAt` 을 갱신
     - 배열에서 해당 room을 제거 후 맨 앞에 삽입하여 “최신 방이 상단”이 되도록 보장

2. `useRoomActivitySocket`
   - `clientEnv.NEXT_PUBLIC_CHAT_WS_URL` 로 전역 WS를 하나 연다.
   - 플로우:

```ts
// 1) 토큰 발급
GET /api/arcyou/chat/ws/token

// 2) WebSocket 연결 후
{ "op": "auth", "token": "<JWT>" } 전송

// 3) auth 성공 시
{ "op": "watch_rooms" } 전송

// 4) room-activity 수신
{ "op": "room-activity", "roomId": "...", "lastMessageId": 123, "createdAt": "..." }
→ useBumpChatRoomActivity(roomId, { lastMessageId, updatedAt: createdAt })
```

   - 사용 위치:
     - `RightSidebarContent` 상단에서 한 번 호출하여
       - 사이드바가 마운트되어 있는 동안에만 watcher WS를 유지
       - 페이지를 벗어나면 자동으로 WS 연결 해제

결과적으로,
대화방 단위 WebSocket(`ArcYouChatRoom`)은 메시지 스트림을 담당하고,
전역 WebSocket(`useRoomActivitySocket`)은 **방 목록 메타데이터(마지막 메시지/정렬)를 실시간으로 동기화하는 역할**을 담당합니다.

---

### 6) 운영 및 테스트 메모 (WS 관련)

- **게이트웨이 재빌드/재기동**

```bash
cd apps
docker compose -f docker-compose.dev.yml --env-file .env.docker build uws-gateway
docker compose -f docker-compose.dev.yml --env-file .env.docker up -d uws-gateway
docker compose -f docker-compose.dev.yml --env-file .env.docker logs uws-gateway --tail 50
```

- **헬스 체크**

```bash
curl -s http://localhost:8080/health
# {"ok":true}
```

- **WS 토큰 발급 확인**

```bash
curl -i -H "Cookie: <NextAuth 세션 쿠키>" \
  "http://localhost:3000/api/arcyou/chat/ws/token"
```

- **기본 시나리오 테스트**
  1. A, B 두 계정을 준비하고 서로 친구 관계를 맺은 뒤 1:1 채팅방 생성
  2. A 브라우저:
     - ArcWork 탭에서 아무 채팅방을 열지 않고,
     - 오른쪽 사이드바 채팅방 목록만 띄운 상태로 대기
  3. B 브라우저:
     - 동일한 1:1 채팅방을 열고 메시지 전송
  4. 기대 결과:
     - A 브라우저의 RightSidebar에서 해당 채팅방이 즉시(WS round-trip 지연 내에서) 목록 상단으로 이동
     - 방을 따로 열지 않았더라도, room-activity 이벤트를 통해 목록 정렬이 갱신됨

상세 API/비즈니스 플로우는 `arcyou-chat.md` 및 `arcyou-mvp.md` 를 참고하고,
WS 레이어에 대한 변경/확장은 본 문서를 우선적으로 업데이트합니다.



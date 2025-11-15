## ArcYou 채팅 구현 상세 (현행)

최종 업데이트: 2025-11-XX

### 1) 개요
- 아키텍처
  - WebSocket 게이트웨이(uws-gateway)가 실시간 메시지를 처리
  - 게이트웨이는 메시지를 DB에 저장하면서 Outbox에 적재
  - Outbox 워커(outbox-worker)가 Redis Pub/Sub으로 팬아웃
  - 게이트웨이는 Redis를 구독하여
    - 각 방(room)의 연결 클라이언트들에게 `op:'room', event:'message.created'` 메시지를 브로드캐스트하고
    - 각 사용자(userId)의 watcher 소켓에게
      - `op:'rooms', event:'room.activity'`
      - `op:'rooms', event:'room.created'`
      - `op:'rooms', event:'room.updated'`
      이벤트를 전송하여 채팅방 목록을 실시간으로 갱신
  - 클라이언트는 ArcWork 탭에서 `ArcYouChatRoom` 컴포넌트를 통해 직접 WS 연결

- 핵심 테이블 (PostgreSQL / Drizzle)
  - `arcyou_chat_rooms`, `arcyou_chat_messages`, `arcyou_chat_members`, `outbox`

### 2) 환경 변수
- Next (개발): `apps/main/.env.development`
  - `NEXT_PUBLIC_CHAT_WS_URL=ws://localhost:8080`
  - `GATEWAY_JWT_PRIVATE_KEY` (RS256 개인키, PEM)
  - `GATEWAY_JWT_ISSUER=arcsolve`
  - `GATEWAY_JWT_AUDIENCE=arcyou-gateway`
- Docker Compose: `apps/.env.docker`
  - `JWT_PUBLIC_KEY` (게이트웨이용 공개키, PEM)
  - PgBouncer/Redis 등 연결 문자열

주의: 게이트웨이의 JWT 공개키는 토큰 발급에 사용하는 RS256 개인키와 반드시 한 쌍이어야 함.

### 3) 서버 구성
- uws-gateway (`apps/uws-gateway/server.ts`)
  - WebSocket 엔드포인트(기본 8080)
  - `op: 'auth'` → RS256 검증(issuer/audience 옵션 지원)
  - `op: 'room'` + `action: 'join'` → 멤버십 검증 후 채널 등록 및 backfill 전송
  - `op: 'room'` + `action: 'send'` → 트랜잭션으로 `arcyou_chat_messages` 저장 + `outbox(pending)` 기록 후 즉시 ACK
  - `op: 'room'` + `action: 'ack'` → `arcyou_chat_members.last_read_message_id` 갱신(GREATEST)
  - `op: 'rooms'` + `action: 'watch'` → 인증된 사용자에 대해 user watcher 소켓을 등록 (채팅방 목록 실시간 갱신용)
  - Redis 구독(`chat:message` 또는 `conv:*`) → 
    - `op:'room', event:'message.created'` 로 해당 방에 조인한 모든 소켓에 브로드캐스트
    - Outbox payload에 포함된 `recipients: userId[]`를 기준으로 각 사용자 watcher 소켓에
      - `op:'rooms', event:'room.activity'`
      - `op:'rooms', event:'room.created'`
      - `op:'rooms', event:'room.updated'`
      이벤트 전송

- Outbox 워커 (`apps/outbox-worker/worker.ts`)
  - `pending` → `in_progress` → 발행 성공 시 `published`, 실패 시 지수 백오프 재시도
  - `PUBSUB_MODE`에 따라 채널 `chat:message` 또는 `conv:{roomId}`
  - payload는 게이트웨이가 그대로 팬아웃 가능한 형태:
    - 메시지 생성: `op:'room', event:'message.created', type:'message.created', roomId, message:{ id, user_id, content, created_at, temp_id }, recipients:string[]`
    - 방 생성: `op:'rooms', event:'room.created', type:'room.created', roomId, room:{ id, name, description, type, lastMessageId, createdAt, updatedAt }, recipients:string[]`
    - 방 정보 변경(이름 등): `op:'rooms', event:'room.updated', type:'room.updated', roomId, room:{ id, name, description, type, lastMessageId, createdAt, updatedAt }, recipients:string[]`

- 토큰 발급 API (`apps/main/src/app/(backend)/api/arcyou/chat/ws/token/route.ts`)
  - `GET /api/arcyou/chat/ws/token`
  - 인증: NextAuth 세션 확인 (`auth()`)
  - 세션 없음: `401 Unauthorized` 반환
  - 환경 변수 검증: `GATEWAY_JWT_PRIVATE_KEY` (PEM 형식 필수)
  - PEM 형식 검증: `BEGIN` 및 `PRIVATE KEY` 포함 여부 확인
  - 토큰 발급:
    - 알고리즘: RS256
    - subject: `userId` (세션에서 추출)
    - expiresIn: `5m` (5분)
    - issuer: `GATEWAY_JWT_ISSUER` (선택, 있으면 포함)
    - audience: `GATEWAY_JWT_AUDIENCE` (선택, 있으면 포함)
  - 응답: `{ token: string, expiresIn: string }`
  - 에러 처리:
    - 개인키 미설정: `500 Gateway signing key not configured`
    - PEM 형식 오류: `500 Invalid private key format`
    - 토큰 생성 실패: `500 Token generation failed`

- 히스토리 API (`apps/main/src/app/(backend)/api/arcyou/chat/room/[roomId]/messages/route.ts`)
  - `GET /api/arcyou/chat/room/{roomId}/messages?limit=50&before={id}`
  - 인증: NextAuth 세션 확인 (`auth()`)
  - 파라미터 처리: Next 16 변경에 따라 `params`는 Promise → `await ctx.params`로 처리
  - 쿼리 파라미터:
    - `before`: 양의 정수 (선택, 이전 메시지 ID)
    - `limit`: 양의 정수 (선택, 기본값 50, 최대 200)
  - 멤버십 검증: `ArcyouChatMessageRepository.listByRoomId()`에서 사용자 멤버십 확인
  - 정렬: 서버는 `id DESC`로 반환 (최신 메시지가 먼저)
  - 응답 형식 (`ok` 헬퍼 사용):
    ```typescript
    {
      success: true,
      data: {
        messages: Array<{
          id: number;
          roomId: string;
          userId: string;
          content: unknown;
          createdAt: string; // ISO string
        }>;
        hasMore: boolean; // limit만큼 반환되면 true
        nextBefore?: number; // 다음 페이지 조회용 (마지막 메시지 ID)
      }
    }
    ```
  - 에러 처리:
    - 인증 실패: `UNAUTHORIZED`
    - roomId 없음: `BAD_REQUEST`
    - 권한 없음: `FORBIDDEN` (멤버가 아닌 경우)
    - 기타 오류: `INTERNAL`

- 채팅방 목록 조회 API (`apps/main/src/app/(backend)/api/arcyou/chat/rooms/route.ts`)
  - `GET /api/arcyou/chat/rooms?type=direct|group`
  - 인증: NextAuth 세션 확인 (`auth()`)
  - 쿼리 파라미터:
    - `type`: `'direct'` 또는 `'group'` (선택, 필터링용)
  - 로직: `ArcyouChatRoomRepository.listByUserId()`로 사용자가 멤버인 채팅방 조회
  - 응답 형식 (`ok` 헬퍼 사용):
    ```typescript
    {
      success: true,
      data: {
        rooms: Array<{
          id: string;
          name: string;
          description: string | null;
          type: 'direct' | 'group';
          lastMessageId: number | null;
          role: string;
          lastReadMessageId: number | null;
          createdAt: string; // ISO string
          updatedAt: string; // ISO string
        }>;
      }
    }
    ```
  - 에러 처리:
    - 인증 실패: `UNAUTHORIZED`
    - 잘못된 type: `BAD_REQUEST`
    - 기타 오류: `INTERNAL`

- 채팅방 생성 API (`apps/main/src/app/(backend)/api/arcyou/chat/rooms/route.ts`)
  - `POST /api/arcyou/chat/rooms`
  - 인증: NextAuth 세션 확인 (`auth()`)
  - 요청 본문:
    ```typescript
    {
      type: 'direct' | 'group';
      name: string; // 필수, 1-255자
      description?: string | null; // 선택
      targetUserId?: string; // direct 타입일 때 필수
      memberIds?: string[]; // group 타입일 때 필수 (최소 1명)
    }
    ```
  - 유효성 검사:
    - `type`: `'direct'` 또는 `'group'` 필수
    - `name`: 문자열, 1-255자 필수
    - `description`: 문자열 또는 null (선택)
    - `direct` 타입: `targetUserId` 필수
    - `group` 타입: `memberIds` 배열 필수 (최소 1명)
  - 로직: `ArcyouChatRoomRepository.create()`로 채팅방 생성 및 멤버 추가
  - 응답 형식 (`ok` 헬퍼 사용):
    ```typescript
    {
      success: true,
      data: {
        room: {
          id: string;
          name: string;
          description: string | null;
          type: 'direct' | 'group';
          lastMessageId: number | null;
          role: string;
          lastReadMessageId: number | null;
          createdAt: string; // ISO string
          updatedAt: string; // ISO string
        };
      }
    }
    ```
  - 에러 처리:
    - 인증 실패: `UNAUTHORIZED`
    - 유효성 검사 실패: `BAD_REQUEST` (각 필드별 상세 메시지)
    - 기타 오류: `INTERNAL`

### 4) 클라이언트 구성
- RightSidebarContent (`apps/main/src/app/(frontend)/[locale]/(user)/(core)/components/RightSidebarContent.tsx`)
  - 채팅방 목록 관리 및 생성 UI 제공
  - 탭 구조: 친구 / 1:1 채팅 / 그룹 채팅
  - 채팅방 목록 조회:
    - `useArcyouChat('direct')`: 1:1 채팅방 목록 조회
    - `useArcyouChat('group')`: 그룹 채팅방 목록 조회
    - React Query로 자동 캐싱 및 새로고침
  - 채팅방 목록 실시간 갱신:
    - `useRoomActivitySocket()` 훅을 통해 별도의 WebSocket을 열어 `op:'rooms', action:'watch'` 등록
    - 게이트웨이로부터
      - `op:'rooms', event:'room.activity'` 수신 시 `useBumpChatRoomActivity()`를 통해
        - React Query 캐시(`chatRooms.list`, `chatRooms.list('direct'|'group')`)의 해당 방 `lastMessageId`/`updatedAt`을 갱신
        - 해당 방을 배열의 맨 앞으로 이동시켜 “최신 메시지 방이 상단에 위치”하도록 정렬
      - `op:'rooms', event:'room.created'` 수신 시 방 목록 캐시에 새 방을 prepend
      - `op:'rooms', event:'room.updated'` 수신 시 방 목록 캐시의 해당 room `name`/`description`/`updatedAt` 을 패치하고, ArcWork 탭 이름도 동기화
  - 채팅방 생성:
    - 1:1 채팅: 친구 검색 → 클릭 시 즉시 채팅방 생성 및 탭 열기
    - 그룹 채팅: 친구 검색 → 선택(badge) → 생성 버튼 클릭 → 채팅방 생성 및 탭 열기
  - 채팅방 생성 후 처리:
    - `createRoom()` 또는 `createGroupRoom()` 호출
    - 성공 시 `ensureOpen({ id: room.id, type: 'arcyou-chat-room', name: room.name })`로 탭 열기
    - React Query 쿼리 무효화로 목록 자동 새로고침
  - 친구 검색:
    - `relationQueryOptions.search()` 사용
    - 디바운스 적용 (300ms)
    - 검색 결과 클릭 시 채팅방 생성

- ArcWork 연동 (`apps/main/src/app/(frontend)/[locale]/(user)/(core)/components/ArcWorkContent.tsx`)
  - FlexLayout 탭의 `node.getId()`를 직접 사용하여 `<ArcYouChatRoom id={node.getId()} />` 렌더
  - 탭 ID는 채팅방 ID와 동일

- ArcYouChatRoom (`apps/main/src/client/components/arc/ArcYou/ArcYouChat/ArcYouChatRoom.tsx`)
  - props: `{ id: string }`
  - 내부 상태:
    - `messages`(로컬 메시지 목록)
    - `currentUserId`
    - `ready`(auth + join 완료 시 true)
    - `socketRef`, `pendingMapRef`(temp_id→index), `persistedIdSetRef`(서버 확정 id 집합), `lastMessageIdRef`
  - 마운트 흐름 (`useEffect`에서 `id`, `wsUrl` 의존)
    1) 토큰 발급: `GET /api/arcyou/chat/ws/token`으로 RS256 JWT 발급
       - 세션 확인 후 `{ token, expiresIn }` 응답 수신
       - 응답 실패 시 (`!r.ok`) 연결 중단
    2) WebSocket 연결: `NEXT_PUBLIC_CHAT_WS_URL`로 WS 연결
       - `open` 이벤트 시 `{ op:'auth', token }` 전송
    3) 인증 성공 처리 (`op:'auth'` 응답):
       - `success=true`, `userId` 수신 시 `isAuthedRef.current = true`, `currentUserId` 설정
       - 초기 히스토리 로드: `GET /api/arcyou/chat/room/{roomId}/messages?limit=50`
         - 서버는 `id DESC`로 반환 → 클라이언트에서 `reverse()`로 ASC 정렬
         - 기존 메시지 앞에 배치 (`[...next, ...prev]`)
         - 받은 서버 `id`는 `persistedIdSetRef`에 기록하여 중복 방지
         - `lastMessageIdRef` 갱신
       - 히스토리 로드 완료 후 `{ op:'join', room_id }` 전송
    4) 조인 성공 처리 (`op:'join'` 응답):
       - `success=true` 시 `isJoinedRef.current = true`, `ready=true` 설정
       - 전송 UI 활성화 (`submitDisabled={!ready}`)
  - 전송 흐름(낙관적 → ACK → live 승격)
    - 전송 전 검증: `isAuthedRef.current && isJoinedRef.current` 확인
      - 미완료 시 전송 차단 (로그 없이 `setMessage('')`만 수행)
    - 낙관적 메시지 추가:
      - 임시 ID 생성: `temp-${Date.now()}`
      - 상태: `status: 'sending'`, `id: tempId`
      - `pendingMapRef`에 `{ [tempId]: index }` 기록
      - `{ op:'room', action:'send', roomId, content:{text}, tempId }` 전송
    - 게이트웨이 ACK 처리 (`op:'room', event:'sent'` 응답):
      - `success=true`, `messageId=n` → 낙관적 항목의 `id`를 `n`으로 교체, `status:'sent'`
      - `messageId`를 `persistedIdSetRef`에 추가(중복 방지용)
      - `lastMessageIdRef` 갱신
      - `pendingMapRef`에서 `tempId` 제거
    - Live 이벤트 처리 (`op:'room', event:'message.created'`):
      - `temp_id` 매칭 시: 낙관적 메시지를 `status='delivered'`로 승격, `id` 교체, `createdAt` 갱신
      - `temp_id` 없이 서버 `id`만 온 경우:
        - `id`가 `persistedIdSetRef`에 있으면: 기존 항목을 `delivered`로 갱신 (중복 방지)
        - 처음 보는 `id`면: 새 항목 추가, `persistedIdSetRef`에 추가
      - `lastMessageIdRef` 갱신 후 `scheduleAck()` 호출
  - 읽음 동기화(ACK)
    - `scheduleAck()`: 새 메시지 반영마다 300ms 디바운스로 ACK 전송
    - `sendAck()`: `{ op:'room', action:'ack', roomId, lastReadMessageId }` 전송
      - `lastMessageIdRef.current`를 `lastReadMessageId`로 사용
    - 게이트웨이는 `arcyou_chat_members.last_read_message_id`를 GREATEST로 갱신
  - 연결 가드/정리
    - 전송 가드: `isAuthedRef.current && isJoinedRef.current` 확인
    - `id` 변경 시: 별도 `useEffect`로 메시지 상태 초기화 (`pendingMapRef`, `lastMessageIdRef`, `messages` 초기화)
    - 언마운트 시 (`useEffect` cleanup):
      - `closed = true` 플래그 설정
      - WebSocket 종료 (`ws?.close()`)
      - `socketRef.current = null`
      - `pendingMapRef` 초기화
      - `ackTimerRef` 정리
      - `lastMessageIdRef = null`
      - `isAuthedRef`, `isJoinedRef` 초기화
      - `ready = false`

### 5) 데이터 흐름(요약)

#### 채팅방 목록 조회 및 생성 흐름
1. `RightSidebarContent` 마운트
2. `useArcyouChat('direct')`, `useArcyouChat('group')`로 채팅방 목록 조회
   - `GET /api/arcyou/chat/rooms?type=direct|group`
   - React Query 캐싱 (staleTime: 1분, gcTime: 5분)
3. 채팅방 생성:
   - 1:1 채팅: 친구 검색 → 클릭 → `createRoom({ type: 'direct', targetUserId, name })`
   - 그룹 채팅: 친구 검색 → 선택 → `createGroupRoom({ type: 'group', memberIds, name })`
   - `POST /api/arcyou/chat/rooms` 호출
   - 성공 시 `ensureOpen({ id, type: 'arcyou-chat-room', name })`로 탭 열기
   - React Query 쿼리 무효화로 목록 자동 새로고침

#### 채팅방 메시지 흐름
1. 탭 오픈 → `ArcYouChatRoom(id)` 마운트
2. 토큰 발급: `GET /api/arcyou/chat/ws/token` → JWT 수신
3. WebSocket 연결: `NEXT_PUBLIC_CHAT_WS_URL`로 연결
4. 인증: `{ op:'auth', token }` 전송 → `{ op:'auth', success:true, userId }` 수신
5. 히스토리 로드: `GET /api/arcyou/chat/room/{roomId}/messages?limit=50`
   - 서버는 `id DESC` 반환 → 클라이언트에서 ASC 정렬하여 앞에 배치
   - `persistedIdSetRef`에 ID 기록
6. 조인: `{ op:'room', action:'join', roomId }` 전송 → `{ op:'room', event:'joined', success:true }` 수신 → `ready=true`
7. 메시지 전송:
   - 낙관적 메시지 추가 (`status: 'sending'`)
   - `{ op:'room', action:'send', roomId, content:{text}, tempId }` 전송
   - ACK 수신: `{ op:'room', event:'sent', success:true, messageId }` → `status: 'sent'`
   - 게이트웨이: DB 저장 + Outbox 적재(해당 방 멤버 userId를 `recipients`로 포함) → 워커 발행 → Redis Pub/Sub
   - Live 이벤트 수신: `{ op:'room', event:'message.created' }` → `status: 'delivered'`
8. 읽음 동기화: 새 메시지마다 300ms 디바운스로 `{ op:'room', action:'ack', roomId, lastReadMessageId }` 전송

#### 채팅방 목록 실시간 갱신 흐름
1. 어떤 사용자가 채팅방에 메시지를 전송하면 게이트웨이 `op:'room', action:'send'` 처리에서
   - `arcyou_chat_messages`에 메시지를 저장하고
   - 해당 방의 모든 멤버를 조회하여 `recipients: userId[]`를 구성
   - `outbox`에 `type:'message.created'`, `payload:{ op:'room', event:'message.created', message:{...}, recipients }` 를 적재
2. Outbox 워커가 `pending` 레코드를 가져와 Redis 채널(`chat:message` 또는 `conv:{roomId}`)로 payload를 발행
3. uws-gateway Redis subscriber는 payload를 수신하여
   - `op:'room', event:'message.created'`를 해당 `roomId`에 조인한 모든 소켓에 브로드캐스트하고
   - `recipients` 목록을 기준으로 각 user watcher 소켓에
     - `{ op:'rooms', event:'room.activity', roomId, lastMessageId, createdAt }` 이벤트를 전송
4. 클라이언트 RightSidebar에서 동작하는 `useRoomActivitySocket()` 훅은
   - `rooms.room.activity` 이벤트를 수신할 때마다 `useBumpChatRoomActivity()`를 통해
     - React Query 캐시에 있는 해당 방의 `lastMessageId`/`updatedAt`을 갱신하고
     - 방 목록 배열에서 해당 방을 맨 앞으로 이동
   - 결과적으로 “열려 있지 않은 방에 새 메시지가 와도” 방 목록에서 해당 방이 즉시 상단으로 올라감

### 6) 트러블슈팅
- Unauthorized: auth first
  - 원인: auth/join 이전 전송 또는 게이트웨이 공개키 미설정/불일치
  - 조치: ready=true 이후 전송, 게이트웨이 `JWT_PUBLIC_KEY`와 발급 개인키가 쌍인지 확인(재빌드/재기동 필요)
- 400: Next 16 `params` Promise
  - 조치: 동적 라우트에서 `await ctx.params`로 파라미터 언래핑
- Maximum update depth exceeded
  - 원인: effect 의존성에 상태 변경 함수가 포함되어 재실행 루프
  - 조치: effect 의존성 축소([id, wsUrl]), cleanup에서 setState 제거, 별도 effect로 초기화
- Duplicate key 경고
  - 원인: ACK 후 live 이벤트가 동일 id로 재도착 시 중복 추가
  - 조치: 서버 확정 id를 Set으로 관리, 중복시 기존 항목을 delivered로 승격

### 7) 운영 메모
- 게이트웨이 재빌드/재기동 (Docker Compose)
```bash
cd apps
docker compose -f docker-compose.dev.yml --env-file .env.docker build uws-gateway
docker compose -f docker-compose.dev.yml --env-file .env.docker up -d uws-gateway
docker compose -f docker-compose.dev.yml --env-file .env.docker logs uws-gateway --tail 50
```
- 키 교체
  - RS256 개인키/공개키 재발급 후, `.env.development`의 `GATEWAY_JWT_PRIVATE_KEY`, `.env.docker`의 `JWT_PUBLIC_KEY`를 갱신
  - Next 서버/게이트웨이 각각 재시작 필요

### 8) 확장 여지
- 무한 스크롤: 상단 도달 시 `before=<현재 최소 id>`로 추가 페이지 로드
- 멀티미디어 메시지: `type=image|file` 처리 및 업로드 연동
- 방 관리/검색/알림 API: 추후 REST로 보강 가능



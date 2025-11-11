## ArcYou 채팅 구현 상세 (현행)

최종 업데이트: 2025-11-11

### 1) 개요
- 아키텍처
  - WebSocket 게이트웨이(uws-gateway)가 실시간 메시지를 처리
  - 게이트웨이는 메시지를 DB에 저장하면서 Outbox에 적재
  - Outbox 워커(outbox-worker)가 Redis Pub/Sub으로 팬아웃
  - 게이트웨이는 Redis를 구독하여 각 방(room)의 연결 클라이언트들에게 브로드캐스트
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
  - `op: 'join'` → 멤버십 검증 후 채널 등록 및 backfill 전송
  - `op: 'send'` → 트랜잭션으로 `arcyou_chat_messages` 저장 + `outbox(pending)` 기록 후 즉시 ACK
  - `op: 'ack'` → `arcyou_chat_members.last_read_message_id` 갱신(GREATEST)
  - Redis 구독(`chat:message` 또는 `conv:*`) → `op:'event'`로 모든 방 소켓에 브로드캐스트

- Outbox 워커 (`apps/outbox-worker/worker.ts`)
  - `pending` → `in_progress` → 발행 성공 시 `published`, 실패 시 지수 백오프 재시도
  - `PUBSUB_MODE`에 따라 채널 `chat:message` 또는 `conv:{roomId}`

- 토큰 발급 API (`apps/main/src/app/(backend)/api/arcyou/chat/ws/token/route.ts`)
  - `GET /api/arcyou/chat/ws/token`
  - 로그인 세션 확인(NextAuth) → RS256 서명으로 5분 TTL 토큰 발급
  - 로그: handler invoked, session 확인, env readiness, token issued

- 히스토리 API (`apps/main/src/app/(backend)/api/arcyou/chat/room/[roomId]/messages/route.ts`)
  - `GET /api/arcyou/chat/room/{roomId}/messages?limit=50&before={id}`
  - Next 16 변경에 따라 `params`는 Promise → `await ctx.params`로 처리
  - 멤버십 검증 후 id DESC로 반환(클라이언트는 ASC로 정렬하여 앞쪽에 채움)
  - 응답: `messages[]`, `hasMore`, `nextBefore`

### 4) 클라이언트 구성
- ArcWork 연동 (`apps/main/src/app/(frontend)/[locale]/(user)/(core)/components/ArcWorkWithChatRoom.tsx`)
  - FlexLayout 탭의 `node.getConfig().content.roomId`를 읽어 `<ArcYouChatRoom id={roomId} />` 렌더

- ArcYouChatRoom (`apps/main/src/client/components/arc/ArcYou/ArcYouChat/ArcYouChatRoom.tsx`)
  - props: `{ id: string }`
  - 내부 상태:
    - `messages`(로컬 메시지 목록)
    - `currentUserId`
    - `ready`(auth + join 완료 시 true)
    - `socketRef`, `pendingMapRef`(temp_id→index), `persistedIdSetRef`(서버 확정 id 집합), `lastMessageIdRef`
  - 마운트 흐름
    1) GET `/api/ws/token`으로 RS256 JWT 발급
    2) `NEXT_PUBLIC_CHAT_WS_URL`로 WS 연결, open 시 `{ op:'auth', token }` 전송
    3) auth 성공 시, 초기 히스토리 1회 로드: `GET /api/arcyou/chat/room/{roomId}/messages?limit=50`
       - 서버는 DESC로 반환 → 클라에서 ASC로 정렬하여 기존 메시지 앞에 배치
       - 받은 서버 `id`는 `persistedIdSetRef`에 기록하여 중복 방지
    4) 히스토리 로드가 완료되면 `{ op:'join', room_id }` 전송
    5) join 성공 시 `ready=true` (전송 UI 활성화)
  - 전송(낙관적 → ACK → live 승격)
    - 입력 제출 시 낙관적 메시지(임시 id `temp-...`)를 추가하고 `{ op:'send', room_id, content:{text}, temp_id }` 전송
    - 게이트웨이 ACK(op:'send'):
      - success=true, message_id=n → 낙관적 항목의 id를 n으로 교체, status='sent'
      - n을 `persistedIdSetRef`에 추가(중복 방지용)
    - live 이벤트(op:'event', type:'message.created'):
      - temp_id 매칭 시 낙관적 메시지를 status='delivered'로 승격
      - temp_id 없이 서버 id만 온 경우:
        - id가 Set에 있으면 추가하지 않고 기존 항목을 delivered로 갱신
        - 처음 보는 id면 새 항목 추가
  - 읽음 동기화(ACK)
    - 새 메시지 반영마다 300ms 디바운스로 `{ op:'ack', room_id, last_read_message_id }`
    - 게이트웨이는 `arcyou_chat_members.last_read_message_id`를 GREATEST로 갱신
  - 연결 가드/정리
    - 전송은 auth+join 완료(ready)시에만 허용(미완료 전송은 차단 로그)
    - 언마운트: 소켓 종료, 타이머 정리, 로컬 상태 초기화
  - 디버그 로그
    - 토큰, WS open/close/error, auth ok, history fetched, join response, sending message, send ack, event(message.created), payload error 등 상세 출력

### 5) 데이터 흐름(요약)
1. 탭 오픈 → `ArcYouChatRoom(id)` 마운트
2. `/api/ws/token` → JWT 발급
3. WS 연결 → `auth` 전송 → 성공
4. 히스토리 1회 로드(`messages?limit=50`) → ASC 반영
5. `join(room_id)` → 성공
6. 전송 시 `send` → DB 저장 + Outbox 적재 → 워커 발행 → 게이트웨이 방송 → `event(message.created)` 수신
7. 읽음 위치 `ack` 디바운스 전송

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



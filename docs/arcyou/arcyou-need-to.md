# ArcYou 채팅 서비스 구현 필요 사항

## 개요

현재 구현된 WebSocket 기반 채팅 시스템을 실제 서비스로 운영하기 위해 필요한 추가 구현 사항들을 정리합니다.

---

## 🔴 필수 구현 (MVP)

### 1. REST API 구현

#### 1.1 대화방 관리 API
**우선순위**: 최우선

**구현 위치**: `apps/main/src/app/(backend)/api/conversations/`

**필요한 엔드포인트**:
- `POST /api/conversations` - 대화방 생성
- `GET /api/conversations` - 대화방 목록 조회 (페이지네이션)
- `GET /api/conversations/{id}` - 대화방 상세 조회
- `POST /api/conversations/{id}/participants` - 참가자 추가
- `DELETE /api/conversations/{id}/participants/{user_id}` - 참가자 제거
- `DELETE /api/conversations/{id}` - 대화방 삭제 (관리자만)

**구현 사항**:
- [ ] Repository 패턴으로 데이터 접근 로직 구현
- [ ] Zod 스키마로 요청/응답 검증
- [ ] NextAuth 세션에서 userId 추출
- [ ] participants 테이블 기반 권한 검증
- [ ] 에러 응답 표준화 (`@/share/api/server/response` 활용)

#### 1.2 메시지 히스토리 API
**우선순위**: 최우선

**구현 위치**: `apps/main/src/app/(backend)/api/conversations/[id]/messages/`

**필요한 엔드포인트**:
- `GET /api/conversations/{id}/messages` - 메시지 히스토리 조회
  - Query Parameters: `limit`, `before_id`, `after_id` (커서 기반 페이지네이션)
- `GET /api/conversations/{id}/messages/search` - 메시지 검색
  - Query Parameters: `q` (검색어), `limit`

**구현 사항**:
- [ ] 커서 기반 페이지네이션 구현
- [ ] participants 권한 검증
- [ ] 메시지 본문 검색 (PostgreSQL full-text search 또는 LIKE)
- [ ] 응답에 `has_more` 플래그 포함

#### 1.3 읽음 상태 관리 API
**우선순위**: 높음

**구현 위치**: `apps/main/src/app/(backend)/api/conversations/[id]/read/`

**필요한 엔드포인트**:
- `PUT /api/conversations/{id}/read` - 읽음 상태 업데이트
  - Request Body: `{ "last_read_id": number }`
- `GET /api/conversations/unread-count` - 읽지 않은 메시지 수 조회

**구현 사항**:
- [ ] `participants.last_read_id` 업데이트
- [ ] 대화방별 읽지 않은 메시지 수 계산
- [ ] WebSocket 이벤트로 읽음 상태 변경 브로드캐스트 (선택사항)

---

### 2. WebSocket 인증 통합

**우선순위**: 최우선

**현재 상태**: 
- 개발 환경: UUID 직접 사용
- 운영 환경: JWT 토큰 검증 (RS256)

**필요한 작업**:
- [ ] NextAuth 세션 토큰과 WebSocket JWT 토큰 통합
- [ ] `uws-gateway`에서 NextAuth JWT 토큰 검증 로직 추가
- [ ] JWT 토큰에서 `userId` (또는 `sub`) 추출
- [ ] 토큰 만료 시 재인증 유도

**구현 위치**: `apps/uws-gateway/server.ts`의 `verifyToken` 함수

**참고**:
- NextAuth JWT 토큰 구조 확인 필요
- `auth.ts`에서 JWT 콜백 확인
- 공개키 또는 비밀키 공유 방식 결정 필요

---

### 3. 클라이언트 WebSocket 라이브러리

**우선순위**: 최우선

**구현 위치**: `apps/main/src/share/libs/websocket/` 또는 `apps/main/src/client/libs/`

**필요한 기능**:
- [ ] WebSocket 연결 관리 (연결, 재연결, 연결 종료)
- [ ] 자동 재연결 로직 (지수 백오프)
- [ ] 메시지 큐 (연결 끊김 시 메시지 저장 후 재전송)
- [ ] 이벤트 핸들러 (onMessage, onError, onConnect, onDisconnect)
- [ ] 타입 안정성 (TypeScript)
- [ ] React Hook (`useWebSocket`, `useChat`)

**구현 사항**:
- [ ] WebSocket 클래스 래퍼
- [ ] React Query와 통합 (선택사항)
- [ ] Zustand 스토어와 통합 (선택사항)
- [ ] 에러 처리 및 재시도 로직
- [ ] 하트비트 (ping/pong) 구현

**예시 구조**:
```typescript
// apps/main/src/share/libs/websocket/chat-client.ts
export class ChatWebSocketClient {
  connect(token: string): Promise<void>
  disconnect(): void
  sendMessage(conversationId: string, body: any, tempId?: string): Promise<void>
  joinConversation(conversationId: string): Promise<void>
  onMessage(callback: (event: ChatEvent) => void): void
  // ...
}
```

---

### 4. 데이터베이스 스키마 확인 및 마이그레이션

**우선순위**: 높음

**확인 사항**:
- [ ] `conversations` 테이블 스키마 확인
  - `title` 필드 존재 여부
  - `updated_at` 필드 존재 여부
- [ ] `participants` 테이블 스키마 확인
  - `last_read_id` 필드 존재 여부
  - `role` 필드 기본값 확인
- [ ] 인덱스 최적화
  - `messages.conversation_id` 인덱스
  - `messages.created_at` 인덱스
  - `participants.conversation_id, user_id` 복합 인덱스
  - `outbox.processed, created_at` 복합 인덱스

**마이그레이션 필요 시**:
- [ ] Drizzle 마이그레이션 파일 생성
- [ ] 마이그레이션 실행 스크립트 확인

---

## 🟡 중요 구현 (서비스 품질 향상)

### 5. 오프라인 메시지 처리

**우선순위**: 높음

**구현 사항**:
- [ ] 클라이언트: WebSocket 연결 끊김 감지
- [ ] 클라이언트: 오프라인 중 메시지 로컬 저장
- [ ] 클라이언트: 재연결 후 메시지 히스토리 동기화
- [ ] 서버: 마지막 수신 메시지 ID 기준으로 누락 메시지 조회 API
  - `GET /api/conversations/{id}/messages/since/{message_id}`

---

### 6. 에러 처리 및 재시도

**우선순위**: 높음

**구현 사항**:
- [ ] WebSocket 에러 코드 정의
- [ ] 클라이언트: 네트워크 에러 시 자동 재연결
- [ ] 클라이언트: 메시지 전송 실패 시 재시도 로직
- [ ] 서버: 에러 응답 표준화
- [ ] 로깅: 에러 로그 수집 및 모니터링

**에러 코드 예시**:
```typescript
enum WebSocketErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
}
```

---

### 7. 실시간 동기화

**우선순위**: 중간

**구현 사항**:
- [ ] 대화방 목록의 마지막 메시지 실시간 업데이트
- [ ] 읽지 않은 메시지 수 실시간 업데이트
- [ ] 참가자 온라인/오프라인 상태 표시
- [ ] 타이핑 인디케이터 (선택사항)

**WebSocket 이벤트 추가**:
- `conversation.updated` - 대화방 정보 변경
- `conversation.participant_added` - 참가자 추가
- `conversation.participant_removed` - 참가자 제거
- `user.typing` - 타이핑 중 (선택사항)

---

## 🟢 선택 구현 (향후 개선)

### 8. 파일 첨부 기능

**우선순위**: 낮음

**구현 사항**:
- [ ] 파일 업로드 API (`POST /api/conversations/{id}/attachments`)
- [ ] 파일 저장 (R2 또는 S3)
- [ ] 이미지 미리보기
- [ ] 파일 다운로드 링크 생성
- [ ] 메시지 body에 파일 메타데이터 포함

---

### 9. 푸시 알림

**우선순위**: 낮음

**구현 사항**:
- [ ] FCM (Firebase Cloud Messaging) 또는 APNS 연동
- [ ] 디바이스 토큰 관리 API
- [ ] 알림 설정 (대화방별, 전역)
- [ ] 백그라운드 알림 전송

---

### 10. 모니터링 및 메트릭

**우선순위**: 낮음

**구현 사항**:
- [ ] WebSocket 연결 수 모니터링
- [ ] 메시지 처리량 모니터링
- [ ] Outbox 처리 지연 시간 모니터링
- [ ] 에러율 모니터링
- [ ] 대시보드 구축 (Grafana 등)

---

## 📋 구현 체크리스트 요약

### MVP (최소 기능 제품)
- [ ] REST API: 대화방 관리 (생성, 조회, 참가자 관리)
- [ ] REST API: 메시지 히스토리 조회
- [ ] REST API: 읽음 상태 관리
- [ ] WebSocket 인증 통합 (NextAuth JWT)
- [ ] 클라이언트 WebSocket 라이브러리
- [ ] 데이터베이스 스키마 확인 및 마이그레이션

### 서비스 품질 향상
- [ ] 오프라인 메시지 처리
- [ ] 에러 처리 및 재시도
- [ ] 실시간 동기화 (대화방 목록, 읽지 않은 메시지 수)

### 향후 개선
- [ ] 파일 첨부 기능
- [ ] 푸시 알림
- [ ] 모니터링 및 메트릭

---

## 🔧 기술 스택 통합

### 현재 사용 중인 기술
- **인증**: NextAuth.js v5 (JWT 전략)
- **데이터베이스**: PostgreSQL + Drizzle ORM
- **캐시/메시징**: Redis (Pub/Sub)
- **WebSocket**: ws (Node.js)
- **API**: Next.js App Router (Route Handlers)

### 통합 시 고려사항
1. **인증 토큰 공유**
   - NextAuth JWT 토큰을 WebSocket에서도 사용
   - 또는 별도 채팅 전용 JWT 토큰 발급

2. **데이터 접근 패턴**
   - Repository 패턴 유지
   - Drizzle ORM 스키마 재사용
   - 트랜잭션 관리 일관성

3. **에러 처리**
   - 표준 API 응답 형식 사용 (`@/share/api/server/response`)
   - WebSocket 에러도 동일한 형식으로 통일

4. **타입 안정성**
   - Zod 스키마로 런타임 검증
   - TypeScript로 컴파일 타임 검증
   - 공유 타입 정의 (`@/share/types`)

---

## 📝 참고 문서

- [ArcYou 채팅 시스템 아키텍처](./arcyou-chat.md)
- [ArcYou 외부 API 명세](./arcyou-api.md)
- [인증 시스템 문서](../auth.md)


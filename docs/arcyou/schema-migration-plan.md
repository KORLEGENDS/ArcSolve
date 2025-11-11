# 채팅 스키마 전환 계획

## 개요

기존 채팅 스키마를 새로운 구조로 전환합니다.

**기존 구조**:
- `conversations` → `user_chat_rooms`
- `participants` → `user_chat_members`
- `messages` → `user_chat_messages`

**변경 이유**:
- 더 명확한 네이밍 (user-chat 접두사)
- 기능 확장 (name, description, soft delete 등)
- 역할 체계 개선 (owner/manager/participant)

---

## 1단계: 새로운 스키마 정의

### 1.1 새로운 Drizzle 스키마 파일 생성

**파일 위치**: `apps/main/src/share/schema/drizzles/`

#### `user-chat-room-drizzle.ts`
```typescript
- id: uuid (PK)
- name: text (NOT NULL)
- description: text (NULLABLE)
- lastMessageId: bigint (NULLABLE, FK → user_chat_messages.id)
- createdAt: timestamp
- updatedAt: timestamp (NULLABLE)
```

#### `user-chat-member-drizzle.ts`
```typescript
- roomId: uuid (PK, FK → user_chat_rooms.id)
- userId: uuid (PK, FK → users.id)
- role: enum('owner', 'manager', 'participant') (NOT NULL, default: 'participant')
- createdAt: timestamp
- deletedAt: timestamp (NULLABLE, soft delete)
- lastReadMessageId: bigint (NULLABLE, FK → user_chat_messages.id)
```

#### `user-chat-message-drizzle.ts`
```typescript
- id: bigserial (PK)
- roomId: uuid (NOT NULL, FK → user_chat_rooms.id)
- userId: uuid (NOT NULL, FK → users.id)
- type: text (NOT NULL) // 'text', 'image', 'file', etc.
- content: jsonb (NOT NULL) // 기존 body와 호환
- replyToMessageId: bigint (NULLABLE, FK → user_chat_messages.id)
- status: text (NOT NULL, default: 'sent') // 'sent', 'delivered', 'read', 'deleted'
- createdAt: timestamp
- updatedAt: timestamp (NULLABLE)
- deletedAt: timestamp (NULLABLE, soft delete)
```

### 1.2 Enum 타입 정의

**새로운 enum**:
- `user_chat_member_role`: `'owner'`, `'manager'`, `'participant'`
- `user_chat_message_type`: `'text'`, `'image'`, `'file'`, `'system'` 등
- `user_chat_message_status`: `'sent'`, `'delivered'`, `'read'`, `'deleted'`

---

## 2단계: 데이터베이스 마이그레이션

### 2.1 마이그레이션 전략

**옵션 A: 점진적 전환 (권장)**
1. 새 테이블 생성
2. 데이터 복사 (기존 → 신규)
3. 애플리케이션 코드 전환
4. 기존 테이블 삭제

**옵션 B: 직접 전환**
1. 기존 테이블 ALTER
2. 컬럼 추가/변경
3. 데이터 변환

**권장: 옵션 A** (다운타임 최소화, 롤백 가능)

### 2.2 마이그레이션 SQL 계획

#### Step 1: 새 테이블 생성
```sql
-- user_chat_rooms 생성
CREATE TABLE user_chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  last_message_id bigint,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone
);

-- user_chat_members 생성
CREATE TYPE user_chat_member_role AS ENUM('owner', 'manager', 'participant');
CREATE TABLE user_chat_members (
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role user_chat_member_role DEFAULT 'participant' NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  last_read_message_id bigint,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES user_chat_rooms(id) ON DELETE CASCADE
);

-- user_chat_messages 생성
CREATE TYPE user_chat_message_type AS ENUM('text', 'image', 'file', 'system');
CREATE TYPE user_chat_message_status AS ENUM('sent', 'delivered', 'read', 'deleted');
CREATE TABLE user_chat_messages (
  id bigserial PRIMARY KEY,
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type user_chat_message_type DEFAULT 'text' NOT NULL,
  content jsonb NOT NULL,
  reply_to_message_id bigint,
  status user_chat_message_status DEFAULT 'sent' NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  FOREIGN KEY (room_id) REFERENCES user_chat_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to_message_id) REFERENCES user_chat_messages(id) ON DELETE SET NULL
);

-- 인덱스 생성
CREATE INDEX idx_user_chat_messages_room_id ON user_chat_messages(room_id);
CREATE INDEX idx_user_chat_messages_user_id ON user_chat_messages(user_id);
CREATE INDEX idx_user_chat_messages_created_at ON user_chat_messages(created_at DESC);
CREATE INDEX idx_user_chat_members_user_id ON user_chat_members(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_chat_members_room_id ON user_chat_members(room_id) WHERE deleted_at IS NULL;
```

#### Step 2: 데이터 마이그레이션
```sql
-- conversations → user_chat_rooms
INSERT INTO user_chat_rooms (id, name, description, created_at)
SELECT 
  id,
  'Chat Room ' || id::text, -- 임시 이름
  NULL,
  created_at
FROM conversations;

-- participants → user_chat_members
INSERT INTO user_chat_members (room_id, user_id, role, created_at, last_read_message_id)
SELECT 
  conversation_id,
  user_id,
  CASE 
    WHEN role = 'admin' THEN 'manager'::user_chat_member_role
    ELSE 'participant'::user_chat_member_role
  END,
  NOW(), -- created_at은 원본에 없으므로 현재 시간 사용
  last_read_id
FROM participants;

-- messages → user_chat_messages
INSERT INTO user_chat_messages (id, room_id, user_id, type, content, created_at)
SELECT 
  id,
  conversation_id,
  sender_id,
  'text'::user_chat_message_type,
  body,
  created_at
FROM messages;

-- last_message_id 업데이트
UPDATE user_chat_rooms r
SET last_message_id = (
  SELECT MAX(id) 
  FROM user_chat_messages 
  WHERE room_id = r.id
);
```

#### Step 3: Outbox 테이블 업데이트
```sql
-- outbox 테이블에 room_id 컬럼 추가 (conversation_id와 병행)
ALTER TABLE outbox ADD COLUMN room_id uuid;
ALTER TABLE outbox ADD CONSTRAINT fk_outbox_room FOREIGN KEY (room_id) REFERENCES user_chat_rooms(id);

-- 기존 데이터 마이그레이션
UPDATE outbox SET room_id = conversation_id;

-- 나중에 conversation_id 제거 (코드 전환 후)
-- ALTER TABLE outbox DROP COLUMN conversation_id;
```

---

## 3단계: 코드 전환

### 3.1 Main 앱 전환

#### 파일 변경 목록:
1. **스키마 파일**:
   - `conversation-drizzle.ts` → 삭제
   - `participant-drizzle.ts` → 삭제
   - `message-drizzle.ts` → 삭제
   - `user-chat-room-drizzle.ts` → 생성
   - `user-chat-member-drizzle.ts` → 생성
   - `user-chat-message-drizzle.ts` → 생성

2. **스키마 인덱스** (`index.ts`):
   - 기존 export 제거
   - 새 스키마 export 추가

3. **Repository 파일** (존재 시):
   - 모든 참조 업데이트

4. **API 라우트** (존재 시):
   - 모든 쿼리 업데이트

### 3.2 uws-gateway 전환

**파일**: `apps/uws-gateway/server.ts`

**변경 사항**:
- 스키마 정의 업데이트
- `conversationId` → `roomId` 변경
- `senderId` → `userId` 변경
- `body` → `content` 변경
- `lastReadId` → `lastReadMessageId` 변경
- 역할 체계 업데이트 (member/admin → owner/manager/participant)

**주요 변경점**:
```typescript
// 기존
conversationId: uuid('conversation_id')
senderId: uuid('sender_id')
body: jsonb('body')
lastReadId: bigint('last_read_id')

// 신규
roomId: uuid('room_id')
userId: uuid('user_id')
content: jsonb('content')
lastReadMessageId: bigint('last_read_message_id')
```

### 3.3 outbox-worker 전환

**파일**: `apps/outbox-worker/worker.ts`

**변경 사항**:
- `conversationId` → `roomId` 변경
- Payload 구조 업데이트

---

## 4단계: Outbox 패턴 업데이트

### 4.1 Outbox 스키마 변경

**기존**:
```typescript
conversationId: uuid('conversation_id').notNull()
```

**신규**:
```typescript
roomId: uuid('room_id').notNull()
// conversationId는 레거시 호환을 위해 일시적으로 유지
```

### 4.2 Payload 구조 변경

**기존**:
```json
{
  "op": "event",
  "type": "message.created",
  "conversationId": "...",
  "message": { ... }
}
```

**신규**:
```json
{
  "op": "event",
  "type": "message.created",
  "roomId": "...",
  "message": { ... }
}
```

---

## 5단계: 테스트 및 검증

### 5.1 마이그레이션 테스트

1. **데이터 무결성 검증**:
   ```sql
   -- 레코드 수 비교
   SELECT 
     (SELECT COUNT(*) FROM conversations) as old_rooms,
     (SELECT COUNT(*) FROM user_chat_rooms) as new_rooms,
     (SELECT COUNT(*) FROM participants) as old_members,
     (SELECT COUNT(*) FROM user_chat_members) as new_members,
     (SELECT COUNT(*) FROM messages) as old_messages,
     (SELECT COUNT(*) FROM user_chat_messages) as new_messages;
   ```

2. **외래키 검증**:
   - 모든 참조 관계 확인
   - CASCADE 동작 확인

### 5.2 기능 테스트

- [ ] WebSocket 연결 테스트
- [ ] 메시지 전송 테스트
- [ ] 실시간 브로드캐스트 테스트
- [ ] Outbox 처리 테스트
- [ ] 멤버 관리 테스트
- [ ] 읽음 상태 업데이트 테스트

---

## 6단계: 롤아웃 계획

### 6.1 단계별 배포

1. **Phase 1: 새 스키마 배포** (읽기 전용)
   - 새 테이블 생성
   - 데이터 복사
   - 코드는 아직 기존 테이블 사용

2. **Phase 2: 코드 전환** (쓰기 이중화)
   - 새 코드 배포
   - 기존/신규 테이블 모두 업데이트
   - 모니터링 강화

3. **Phase 3: 기존 테이블 제거** (완전 전환)
   - 기존 테이블 읽기 중단
   - 기존 테이블 삭제
   - 마이그레이션 완료

### 6.2 롤백 계획

- Phase 1: 새 테이블 삭제
- Phase 2: 코드 롤백, 기존 테이블 사용
- Phase 3: 데이터 복구 불가 (주의 필요)

---

## 7단계: 정리 작업

### 7.1 레거시 코드 제거

- [ ] 기존 스키마 파일 삭제
- [ ] 기존 마이그레이션 파일 보관 (참고용)
- [ ] 문서 업데이트

### 7.2 문서 업데이트

- [ ] API 문서 업데이트
- [ ] 아키텍처 문서 업데이트
- [ ] 개발 가이드 업데이트

---

## 주의사항

### ⚠️ Breaking Changes

1. **API 변경**:
   - `conversation_id` → `room_id`
   - `sender_id` → `user_id`
   - `body` → `content`

2. **역할 체계 변경**:
   - `admin` → `manager`로 매핑
   - `member` → `participant`로 매핑
   - `owner` 역할 추가

3. **Soft Delete**:
   - `deletedAt` 필드 추가로 인한 쿼리 변경 필요

### 🔄 호환성 고려사항

- Outbox의 `conversationId`는 일시적으로 유지
- 점진적 전환으로 다운타임 최소화
- 데이터 검증 후 기존 테이블 제거

---

## 예상 소요 시간

- **스키마 정의**: 1-2시간
- **마이그레이션 작성**: 2-3시간
- **코드 전환**: 4-6시간
- **테스트**: 2-3시간
- **배포 및 검증**: 1-2시간

**총 예상 시간**: 10-16시간

---

## 체크리스트

### 준비 단계
- [ ] 새로운 스키마 파일 작성
- [ ] 마이그레이션 SQL 작성 및 검증
- [ ] 테스트 환경에서 마이그레이션 실행

### 개발 단계
- [ ] Main 앱 코드 전환
- [ ] uws-gateway 코드 전환
- [ ] outbox-worker 코드 전환
- [ ] 모든 타입 정의 업데이트

### 테스트 단계
- [ ] 단위 테스트 작성/업데이트
- [ ] 통합 테스트 실행
- [ ] 성능 테스트

### 배포 단계
- [ ] 스테이징 환경 배포
- [ ] 프로덕션 마이그레이션 실행
- [ ] 모니터링 및 검증
- [ ] 레거시 코드 제거


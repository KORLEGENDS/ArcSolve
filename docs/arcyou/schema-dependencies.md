# 채팅 스키마 의존 관계 문서

## 개요

현재 채팅 시스템의 데이터베이스 스키마와 테이블 간 의존 관계를 정리합니다.

---

## 스키마 의존 관계 다이어그램

```
┌─────────────────┐
│   users         │ (독립)
│   - id (PK)     │
└─────────────────┘
        ▲
        │ (참조만, FK 없음)
        │
┌─────────────────────────────────────┐
│   user_chat_rooms                   │ (독립)
│   - id (PK)                         │
│   - name                            │
│   - description                     │
│   - last_message_id                 │
│   - created_at                      │
│   - updated_at                      │
└─────────────────────────────────────┘
        │
        ├──────────────────┬──────────────────┐
        │                  │                  │
        │ CASCADE          │ CASCADE          │
        ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ user_chat_members│  │user_chat_messages│  │     outbox        │
│ - room_id (FK)   │  │ - room_id (FK)   │  │ - room_id        │
│ - user_id        │  │ - user_id        │  │   (참조만, FK없음)│
│ - role           │  │ - id (PK)        │  │ - id (PK)        │
│ - last_read_     │  │ - reply_to_msg_  │  │ - payload        │
│   message_id     │  │   id (FK, self)  │  │ - status         │
│ - created_at    │  │ - type           │  │ - attempts       │
│ - deleted_at     │  │ - content        │  │ - ...            │
└──────────────────┘  │ - status         │  └──────────────────┘
                      │ - created_at     │
                      │ - updated_at     │
                      │ - deleted_at     │
                      └──────────────────┘
                              │
                              │ SET NULL
                              │ (self-reference)
                              ▼
                      ┌──────────────────┐
                      │ (self-reference) │
                      │ reply_to_message │
                      │ _id              │
                      └──────────────────┘
```

---

## 테이블별 상세 설명

### 1. `user_chat_rooms` (채팅방)

**의존성**: 없음 (독립)

**필드**:
- `id`: uuid (PK)
- `name`: text (NOT NULL)
- `description`: text (NULLABLE)
- `last_message_id`: bigint (NULLABLE) - 최신 메시지 ID (로직으로 관리)
- `created_at`: timestamp
- `updated_at`: timestamp (NULLABLE)

**특징**:
- 다른 테이블에 의존하지 않는 최상위 엔티티
- `last_message_id`는 외래키가 아닌 단순 참조 (메시지 생성 시 업데이트)

---

### 2. `user_chat_members` (채팅방 멤버)

**의존성**: `user_chat_rooms` (CASCADE DELETE)

**필드**:
- `room_id`: uuid (PK, FK → `user_chat_rooms.id`)
- `user_id`: uuid (PK) - `users.id` 참조 (FK 없음, 타입만 일치)
- `role`: enum('owner', 'manager', 'participant')
- `created_at`: timestamp
- `deleted_at`: timestamp (NULLABLE, soft delete)
- `last_read_message_id`: bigint (NULLABLE) - 마지막 읽은 메시지 ID

**외래키 관계**:
- `room_id` → `user_chat_rooms.id` (ON DELETE CASCADE)
- `user_id` → `users.id` (FK 없음, 애플리케이션 레벨 참조)

**특징**:
- 복합 기본키 (`room_id`, `user_id`)
- Soft delete 지원 (`deleted_at`)
- `last_read_message_id`는 외래키 없음 (로직으로 관리)

---

### 3. `user_chat_messages` (메시지)

**의존성**: 
- `user_chat_rooms` (CASCADE DELETE)
- 자기 자신 (SET NULL, replyToMessageId)

**필드**:
- `id`: bigserial (PK)
- `room_id`: uuid (FK → `user_chat_rooms.id`)
- `user_id`: uuid - `users.id` 참조 (FK 없음)
- `type`: enum('text', 'image', 'file', 'system')
- `content`: jsonb (NOT NULL)
- `reply_to_message_id`: bigint (NULLABLE, FK → `user_chat_messages.id`)
- `status`: enum('sent', 'delivered', 'read', 'deleted')
- `created_at`: timestamp
- `updated_at`: timestamp (NULLABLE)
- `deleted_at`: timestamp (NULLABLE, soft delete)

**외래키 관계**:
- `room_id` → `user_chat_rooms.id` (ON DELETE CASCADE)
- `reply_to_message_id` → `user_chat_messages.id` (ON DELETE SET NULL)
- `user_id` → `users.id` (FK 없음, 애플리케이션 레벨 참조)

**특징**:
- 자기 참조 (답장 기능)
- Soft delete 지원
- 메시지 타입 및 상태 관리

---

### 4. `outbox` (Outbox 패턴)

**의존성**: 없음 (독립)

**필드**:
- `id`: bigserial (PK)
- `type`: text (NOT NULL)
- `room_id`: uuid (NOT NULL) - `user_chat_rooms.id` 참조 (FK 없음)
- `payload`: jsonb (NOT NULL)
- `status`: enum('pending', 'in_progress', 'published', 'dead')
- `attempts`: integer
- `next_attempt_at`: timestamp
- `locked_by`: text (NULLABLE)
- `locked_until`: timestamp (NULLABLE)
- `published_at`: timestamp (NULLABLE)
- `error`: text (NULLABLE)
- `created_at`: timestamp

**외래키 관계**:
- 없음 (독립 테이블)
- `room_id`는 단순 참조 (FK 없음)

**특징**:
- Outbox 패턴 구현을 위한 독립 테이블
- 트랜잭션 안전성을 위한 분리된 구조
- `room_id`는 참조만 하고 외래키 제약 없음

---

### 5. `users` (사용자)

**의존성**: 없음 (독립)

**필드**:
- `id`: text (PK)
- `email`: varchar (UNIQUE)
- `name`: varchar
- `image_url`: text
- `preferences`: jsonb
- `created_at`: timestamp
- `updated_at`: timestamp
- `deleted_at`: timestamp (NULLABLE)

**특징**:
- 완전히 독립적인 테이블
- 다른 채팅 스키마와 직접적인 FK 관계 없음

---

## 의존성 방향

### 직접 외래키 관계 (FK 제약 있음)

1. **user_chat_members** → **user_chat_rooms**
   - `room_id` → `user_chat_rooms.id`
   - CASCADE DELETE

2. **user_chat_messages** → **user_chat_rooms**
   - `room_id` → `user_chat_rooms.id`
   - CASCADE DELETE

3. **user_chat_messages** → **user_chat_messages** (self-reference)
   - `reply_to_message_id` → `user_chat_messages.id`
   - SET NULL on DELETE

### 논리적 참조 (FK 제약 없음)

1. **user_chat_members.user_id** → **users.id**
   - 타입만 일치 (uuid)
   - 애플리케이션 레벨에서 관리

2. **user_chat_messages.user_id** → **users.id**
   - 타입만 일치 (uuid)
   - 애플리케이션 레벨에서 관리

3. **outbox.room_id** → **user_chat_rooms.id**
   - 타입만 일치 (uuid)
   - FK 제약 없음 (독립성 유지)

4. **user_chat_rooms.last_message_id** → **user_chat_messages.id**
   - 타입만 일치 (bigint)
   - 로직으로 업데이트

5. **user_chat_members.last_read_message_id** → **user_chat_messages.id**
   - 타입만 일치 (bigint)
   - 로직으로 관리

---

## 삭제 동작 (CASCADE 규칙)

### CASCADE DELETE

- **user_chat_rooms 삭제 시**:
  - `user_chat_members` 자동 삭제
  - `user_chat_messages` 자동 삭제
  - `outbox`는 영향 없음 (FK 없음)

### SET NULL

- **user_chat_messages 삭제 시**:
  - `reply_to_message_id`가 해당 메시지를 참조하는 경우 → NULL로 설정

---

## 순환 참조 방지

### 현재 구조

1. **user_chat_rooms** → **user_chat_messages** (간접)
   - `last_message_id`는 FK 없음
   - 순환 참조 없음

2. **user_chat_messages** → **user_chat_messages** (self-reference)
   - `reply_to_message_id`만 FK
   - 순환 참조 없음 (단방향)

### 설계 원칙

- **FK 제약은 최소화**: 논리적 참조는 FK 없이 타입만 일치
- **순환 참조 방지**: 직접적인 FK 순환 없음
- **독립성 유지**: `outbox`는 완전히 독립

---

## 데이터 무결성

### FK 제약으로 보장되는 것

- 채팅방 삭제 시 멤버/메시지 자동 삭제
- 메시지 삭제 시 답장 참조 NULL 처리

### 애플리케이션 레벨에서 관리해야 하는 것

- `user_id` 참조 무결성 (users 테이블 존재 확인)
- `room_id` 참조 무결성 (outbox에서)
- `last_message_id` 업데이트 (메시지 생성 시)
- `last_read_message_id` 업데이트 (ACK 시)

---

## 마이그레이션 순서

스키마 생성 시 다음 순서로 생성해야 함:

1. `users` (독립)
2. `user_chat_rooms` (독립)
3. `user_chat_members` (user_chat_rooms 의존)
4. `user_chat_messages` (user_chat_rooms 의존)
5. `outbox` (독립)

---

## 요약

### 독립 테이블
- `users`
- `user_chat_rooms`
- `outbox`

### 의존 테이블
- `user_chat_members` → `user_chat_rooms`
- `user_chat_messages` → `user_chat_rooms` + 자기 자신

### FK 제약
- **있음**: `user_chat_members.room_id`, `user_chat_messages.room_id`, `user_chat_messages.reply_to_message_id`
- **없음**: `user_id` 참조, `outbox.room_id`, `last_message_id` 참조

### 설계 철학
- **최소한의 FK 제약**: 필요한 곳에만 FK 설정
- **독립성 유지**: Outbox 패턴을 위한 독립 테이블
- **유연성**: 논리적 참조는 애플리케이션 레벨에서 관리


-- 마이그레이션: 기존 채팅 스키마를 user_chat_* 스키마로 전환
-- 실행 전 백업 권장

BEGIN;

-- 1. 새로운 Enum 타입 생성
CREATE TYPE user_chat_member_role AS ENUM('owner', 'manager', 'participant');
CREATE TYPE user_chat_message_type AS ENUM('text', 'image', 'file', 'system');
CREATE TYPE user_chat_message_status AS ENUM('sent', 'delivered', 'read', 'deleted');

-- 2. 새 테이블 생성
CREATE TABLE user_chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  last_message_id bigint,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone
);

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
  FOREIGN KEY (room_id) REFERENCES user_chat_rooms(id) ON DELETE CASCADE
);

-- 3. 인덱스 생성
CREATE INDEX idx_user_chat_messages_room_id ON user_chat_messages(room_id);
CREATE INDEX idx_user_chat_messages_user_id ON user_chat_messages(user_id);
CREATE INDEX idx_user_chat_messages_created_at ON user_chat_messages(created_at DESC);
CREATE INDEX idx_user_chat_members_user_id ON user_chat_members(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_chat_members_room_id ON user_chat_members(room_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_chat_messages_deleted_at ON user_chat_messages(deleted_at) WHERE deleted_at IS NOT NULL;

-- 4. 데이터 마이그레이션
-- conversations → user_chat_rooms
INSERT INTO user_chat_rooms (id, name, description, created_at)
SELECT 
  id,
  'Chat Room ' || id::text,
  NULL,
  created_at
FROM conversations
ON CONFLICT (id) DO NOTHING;

-- participants → user_chat_members
INSERT INTO user_chat_members (room_id, user_id, role, created_at, last_read_message_id)
SELECT 
  conversation_id,
  user_id,
  CASE 
    WHEN role = 'admin' THEN 'manager'::user_chat_member_role
    ELSE 'participant'::user_chat_member_role
  END,
  NOW(),
  last_read_id
FROM participants
ON CONFLICT (room_id, user_id) DO NOTHING;

-- messages → user_chat_messages
INSERT INTO user_chat_messages (id, room_id, user_id, type, content, created_at)
SELECT 
  id,
  conversation_id,
  sender_id,
  'text'::user_chat_message_type,
  body,
  created_at
FROM messages
ON CONFLICT (id) DO NOTHING;

-- last_message_id 업데이트
UPDATE user_chat_rooms r
SET last_message_id = (
  SELECT MAX(id) 
  FROM user_chat_messages 
  WHERE room_id = r.id
);

-- 5. Outbox 테이블에 room_id 추가 (conversation_id와 병행)
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS room_id uuid;
-- 기존 데이터 마이그레이션
UPDATE outbox SET room_id = conversation_id WHERE room_id IS NULL;
-- NOT NULL 제약조건 추가 (데이터 마이그레이션 후)
-- ALTER TABLE outbox ALTER COLUMN room_id SET NOT NULL;

COMMIT;

-- 참고: 기존 테이블(conversations, participants, messages)은 
-- 코드 전환 완료 및 검증 후 별도로 삭제해야 합니다.
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS participants CASCADE;
-- DROP TABLE IF EXISTS conversations CASCADE;


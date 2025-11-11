-- 마이그레이션: user_chat_* 스키마를 arcyou_chat_* 스키마로 네이밍 전환
-- 실행 전 백업 권장

BEGIN;

-- 1. Enum 타입명 변경
ALTER TYPE user_chat_member_role RENAME TO arcyou_chat_member_role;
ALTER TYPE user_chat_message_type RENAME TO arcyou_chat_message_type;
ALTER TYPE user_chat_message_status RENAME TO arcyou_chat_message_status;

-- 2. 테이블명 변경
ALTER TABLE user_chat_rooms RENAME TO arcyou_chat_rooms;
ALTER TABLE user_chat_members RENAME TO arcyou_chat_members;
ALTER TABLE user_chat_messages RENAME TO arcyou_chat_messages;

-- 3. 인덱스명 변경
ALTER INDEX idx_user_chat_messages_room_id RENAME TO idx_arcyou_chat_messages_room_id;
ALTER INDEX idx_user_chat_messages_user_id RENAME TO idx_arcyou_chat_messages_user_id;
ALTER INDEX idx_user_chat_messages_created_at RENAME TO idx_arcyou_chat_messages_created_at;
ALTER INDEX idx_user_chat_members_user_id RENAME TO idx_arcyou_chat_members_user_id;
ALTER INDEX idx_user_chat_members_room_id RENAME TO idx_arcyou_chat_members_room_id;
ALTER INDEX idx_user_chat_messages_deleted_at RENAME TO idx_arcyou_chat_messages_deleted_at;

COMMIT;


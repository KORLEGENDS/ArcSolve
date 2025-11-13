-- 기존 데이터가 있다면 삭제 (개발 환경)
DELETE FROM "arcyou_chat_relationships";--> statement-breakpoint
DELETE FROM "arcyou_chat_messages";--> statement-breakpoint
DELETE FROM "arcyou_chat_members";--> statement-breakpoint
DELETE FROM "users";--> statement-breakpoint
-- users.id를 uuid로 변경 (USING 절로 변환 시도, 실패하면 NULL로 설정)
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid USING CASE WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid ELSE gen_random_uuid() END;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "arcyou_chat_members" ADD CONSTRAINT "arcyou_chat_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_messages" ADD CONSTRAINT "arcyou_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_relationships" ADD CONSTRAINT "arcyou_chat_relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_relationships" ADD CONSTRAINT "arcyou_chat_relationships_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
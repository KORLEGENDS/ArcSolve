-- users.id가 text인 경우 uuid로 변경 (데이터 없음)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'id' 
    AND data_type = 'text'
  ) THEN
    ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid USING CASE WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid ELSE gen_random_uuid() END;
    ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
  END IF;
END $$;--> statement-breakpoint
-- 기존 테이블 및 ENUM 삭제 (데이터 없음)
DROP TABLE IF EXISTS "arcyou_chat_relationships" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "arcyou_chat_relationship_status";--> statement-breakpoint
-- 새로운 ENUM 타입 생성 (이미 존재하면 스킵)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'arcyou_chat_relation_status') THEN
    CREATE TYPE "public"."arcyou_chat_relation_status" AS ENUM('pending', 'accepted', 'blocked', 'rejected');
  END IF;
END $$;--> statement-breakpoint
-- 새로운 테이블 생성 (이미 존재하면 스킵)
CREATE TABLE IF NOT EXISTS "arcyou_chat_relations" (
	"user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"status" "arcyou_chat_relation_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"blocked_at" timestamp with time zone,
	CONSTRAINT "arcyou_chat_relations_user_id_target_user_id_pk" PRIMARY KEY("user_id","target_user_id")
);--> statement-breakpoint
-- 외래키 제약조건 추가 (이미 존재하면 스킵)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'arcyou_chat_relations_user_id_users_id_fk') THEN
    ALTER TABLE "arcyou_chat_relations" ADD CONSTRAINT "arcyou_chat_relations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'arcyou_chat_relations_target_user_id_users_id_fk') THEN
    ALTER TABLE "arcyou_chat_relations" ADD CONSTRAINT "arcyou_chat_relations_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;


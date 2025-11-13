CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'in_progress', 'published', 'dead');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_member_role" AS ENUM('owner', 'manager', 'participant');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_message_status" AS ENUM('sent', 'delivered', 'read', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_message_type" AS ENUM('text', 'image', 'file', 'system');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_relationship_status" AS ENUM('pending', 'accepted', 'blocked', 'rejected');--> statement-breakpoint
CREATE TABLE "arcyou_chat_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"last_message_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "arcyou_chat_members" (
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "arcyou_chat_member_role" DEFAULT 'participant' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"last_read_message_id" bigint,
	CONSTRAINT "arcyou_chat_members_room_id_user_id_pk" PRIMARY KEY("room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "arcyou_chat_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "arcyou_chat_message_type" DEFAULT 'text' NOT NULL,
	"content" jsonb NOT NULL,
	"reply_to_message_id" bigint,
	"status" "arcyou_chat_message_status" DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "arcyou_chat_relationships" (
	"user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"status" "arcyou_chat_relationship_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"blocked_at" timestamp with time zone,
	CONSTRAINT "arcyou_chat_relationships_user_id_target_user_id_pk" PRIMARY KEY("user_id","target_user_id")
);
--> statement-breakpoint
ALTER TABLE "conversations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "participants" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "conversations" CASCADE;--> statement-breakpoint
DROP TABLE "messages" CASCADE;--> statement-breakpoint
DROP TABLE "participants" CASCADE;--> statement-breakpoint
ALTER TABLE "outbox" ALTER COLUMN "created_at" SET DEFAULT NOW();--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "room_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "status" "outbox_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "next_attempt_at" timestamp with time zone DEFAULT NOW() NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "arcyou_chat_members" ADD CONSTRAINT "arcyou_chat_members_room_id_arcyou_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."arcyou_chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_messages" ADD CONSTRAINT "arcyou_chat_messages_room_id_arcyou_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."arcyou_chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_messages" ADD CONSTRAINT "arcyou_chat_messages_reply_to_message_id_arcyou_chat_messages_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."arcyou_chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" DROP COLUMN "conversation_id";--> statement-breakpoint
ALTER TABLE "outbox" DROP COLUMN "processed";--> statement-breakpoint
ALTER TABLE "outbox" DROP COLUMN "processed_at";--> statement-breakpoint
ALTER TABLE "outbox" DROP COLUMN "retry_count";--> statement-breakpoint
DROP TYPE "public"."participant_role";
DROP TYPE IF EXISTS "public"."outbox_status" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."arcyou_chat_room_type" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."arcyou_chat_member_role" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."arcyou_chat_message_status" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."arcyou_chat_message_type" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."arcyou_chat_relation_status" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'in_progress', 'published', 'dead');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_room_type" AS ENUM('direct', 'group');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_member_role" AS ENUM('owner', 'manager', 'participant');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_message_status" AS ENUM('sent', 'delivered', 'read', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_message_type" AS ENUM('text', 'image', 'file', 'system');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_relation_status" AS ENUM('pending', 'accepted', 'rejected', 'blocked');--> statement-breakpoint
DROP TABLE IF EXISTS "auth"."account" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "auth"."user" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "outbox" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "arcyou_chat_rooms" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "arcyou_chat_members" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "arcyou_chat_messages" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "arcyou_chat_relations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "users" CASCADE;--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"room_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"locked_by" text,
	"locked_until" timestamp with time zone,
	"published_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arcyou_chat_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "arcyou_chat_room_type" DEFAULT 'direct' NOT NULL,
	"last_message_id" uuid,
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
	"last_read_message_id" uuid,
	CONSTRAINT "arcyou_chat_members_room_id_user_id_pk" PRIMARY KEY("room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "arcyou_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "arcyou_chat_message_type" DEFAULT 'text' NOT NULL,
	"content" jsonb NOT NULL,
	"reply_to_message_id" uuid,
	"status" "arcyou_chat_message_status" DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "arcyou_chat_relations" (
	"user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"status" "arcyou_chat_relation_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"blocked_at" timestamp with time zone,
	CONSTRAINT "arcyou_chat_relations_user_id_target_user_id_pk" PRIMARY KEY("user_id","target_user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"email" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"image_url" text,
	"preferences" jsonb,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_rooms" ADD CONSTRAINT "arcyou_chat_rooms_last_message_id_arcyou_chat_messages_id_fk" FOREIGN KEY ("last_message_id") REFERENCES "public"."arcyou_chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_members" ADD CONSTRAINT "arcyou_chat_members_room_id_arcyou_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."arcyou_chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_members" ADD CONSTRAINT "arcyou_chat_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_members" ADD CONSTRAINT "arcyou_chat_members_last_read_message_id_arcyou_chat_messages_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."arcyou_chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_messages" ADD CONSTRAINT "arcyou_chat_messages_room_id_arcyou_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."arcyou_chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_messages" ADD CONSTRAINT "arcyou_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_messages" ADD CONSTRAINT "arcyou_chat_messages_reply_to_message_id_arcyou_chat_messages_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."arcyou_chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_relations" ADD CONSTRAINT "arcyou_chat_relations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_relations" ADD CONSTRAINT "arcyou_chat_relations_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
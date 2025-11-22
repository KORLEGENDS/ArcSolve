CREATE TYPE "public"."arcyou_chat_member_role" AS ENUM('owner', 'manager', 'participant');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_message_status" AS ENUM('sent', 'delivered', 'read', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_message_type" AS ENUM('text', 'image', 'file', 'system');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_relation_status" AS ENUM('pending', 'accepted', 'rejected', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_room_type" AS ENUM('direct', 'group');--> statement-breakpoint
CREATE TYPE "public"."document_ai_message_role" AS ENUM('user', 'assistant', 'system', 'tool');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('folder', 'document');--> statement-breakpoint
CREATE TYPE "public"."document_processing_status" AS ENUM('pending', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."document_relation_type" AS ENUM('reference', 'summary', 'translation', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."document_upload_status" AS ENUM('pending', 'uploading', 'uploaded', 'upload_failed');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'in_progress', 'published', 'dead');--> statement-breakpoint
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
CREATE TABLE "arcyou_chat_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "arcyou_chat_room_type" DEFAULT 'direct' NOT NULL,
	"image_url" text,
	"last_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_ai_message" (
	"document_ai_message_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"ui_message_id" text NOT NULL,
	"role" "document_ai_message_role" NOT NULL,
	"index" integer NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_ai_part" (
	"document_ai_part_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_ai_message_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunk" (
	"document_chunk_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_content_id" uuid NOT NULL,
	"position" integer,
	"chunk_content" text NOT NULL,
	"chunk_embedding" vector(256) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_content" (
	"document_content_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"contents" jsonb,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_relation" (
	"document_relation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_document_id" uuid NOT NULL,
	"related_document_id" uuid NOT NULL,
	"relation_type" "document_relation_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document" (
	"document_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text,
	"path" "ltree" NOT NULL,
	"kind" "document_kind" NOT NULL,
	"mime_type" text,
	"file_size" bigint,
	"storage_key" text,
	"upload_status" "document_upload_status" DEFAULT 'uploaded' NOT NULL,
	"processing_status" "document_processing_status" DEFAULT 'pending' NOT NULL,
	"latest_content_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
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
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"auth_user_id" text,
	"email" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"image_url" text,
	"preferences" jsonb,
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "arcyou_chat_members" ADD CONSTRAINT "arcyou_chat_members_room_id_arcyou_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."arcyou_chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_members" ADD CONSTRAINT "arcyou_chat_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_members" ADD CONSTRAINT "arcyou_chat_members_last_read_message_id_arcyou_chat_messages_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."arcyou_chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_messages" ADD CONSTRAINT "arcyou_chat_messages_room_id_arcyou_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."arcyou_chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_messages" ADD CONSTRAINT "arcyou_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_messages" ADD CONSTRAINT "arcyou_chat_messages_reply_to_message_id_arcyou_chat_messages_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."arcyou_chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_relations" ADD CONSTRAINT "arcyou_chat_relations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_relations" ADD CONSTRAINT "arcyou_chat_relations_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcyou_chat_rooms" ADD CONSTRAINT "arcyou_chat_rooms_last_message_id_arcyou_chat_messages_id_fk" FOREIGN KEY ("last_message_id") REFERENCES "public"."arcyou_chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_ai_message" ADD CONSTRAINT "document_ai_message_document_id_document_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_ai_part" ADD CONSTRAINT "document_ai_part_document_ai_message_id_document_ai_message_document_ai_message_id_fk" FOREIGN KEY ("document_ai_message_id") REFERENCES "public"."document_ai_message"("document_ai_message_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunk" ADD CONSTRAINT "document_chunk_document_content_id_document_content_document_content_id_fk" FOREIGN KEY ("document_content_id") REFERENCES "public"."document_content"("document_content_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_content" ADD CONSTRAINT "document_content_document_id_document_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_relation" ADD CONSTRAINT "document_relation_base_document_id_document_document_id_fk" FOREIGN KEY ("base_document_id") REFERENCES "public"."document"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_relation" ADD CONSTRAINT "document_relation_related_document_id_document_document_id_fk" FOREIGN KEY ("related_document_id") REFERENCES "public"."document"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_account_user_id_idx" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_session_user_id_idx" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth_verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "document_ai_message_document_id_index_deleted_null_idx" ON "document_ai_message" USING btree ("document_id","index") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "document_ai_message_ui_message_id_idx" ON "document_ai_message" USING btree ("ui_message_id");--> statement-breakpoint
CREATE INDEX "document_chunk_embedding_ivfflat_idx" ON "document_chunk" USING ivfflat ("chunk_embedding" vector_cosine_ops) WITH (lists=100);--> statement-breakpoint
CREATE UNIQUE INDEX "document_content_document_id_version_deleted_null_idx" ON "document_content" USING btree ("document_id","version") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_relation_base_related_type_deleted_null_idx" ON "document_relation" USING btree ("base_document_id","related_document_id","relation_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_user_id_path_deleted_null_idx" ON "document" USING btree ("user_id","path") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "document_path_gist_idx" ON "document" USING gist ("path");
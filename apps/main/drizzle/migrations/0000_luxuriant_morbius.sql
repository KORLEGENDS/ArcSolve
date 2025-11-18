CREATE TYPE "public"."arcyou_chat_member_role" AS ENUM('owner', 'manager', 'participant');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_message_status" AS ENUM('sent', 'delivered', 'read', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_message_type" AS ENUM('text', 'image', 'file', 'system');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_relation_status" AS ENUM('pending', 'accepted', 'rejected', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."arcyou_chat_room_type" AS ENUM('direct', 'group');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('note', 'file', 'folder');--> statement-breakpoint
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
	"email" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"image_url" text,
	"preferences" jsonb,
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
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunk" ADD CONSTRAINT "document_chunk_document_content_id_document_content_document_content_id_fk" FOREIGN KEY ("document_content_id") REFERENCES "public"."document_content"("document_content_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_content" ADD CONSTRAINT "document_content_document_id_document_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_relation" ADD CONSTRAINT "document_relation_base_document_id_document_document_id_fk" FOREIGN KEY ("base_document_id") REFERENCES "public"."document"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_relation" ADD CONSTRAINT "document_relation_related_document_id_document_document_id_fk" FOREIGN KEY ("related_document_id") REFERENCES "public"."document"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_chunk_embedding_ivfflat_idx" ON "document_chunk" USING ivfflat ("chunk_embedding" vector_cosine_ops) WITH (lists=100);--> statement-breakpoint
CREATE UNIQUE INDEX "document_content_document_id_version_deleted_null_idx" ON "document_content" USING btree ("document_id","version") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_relation_base_related_type_deleted_null_idx" ON "document_relation" USING btree ("base_document_id","related_document_id","relation_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_user_id_path_deleted_null_idx" ON "document" USING btree ("user_id","path") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "document_path_gist_idx" ON "document" USING gist ("path");
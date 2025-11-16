CREATE TYPE "public"."document_kind" AS ENUM('note', 'file', 'folder');--> statement-breakpoint
CREATE TYPE "public"."document_relation_type" AS ENUM('reference', 'summary', 'translation', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."document_upload_status" AS ENUM('pending', 'uploading', 'uploaded', 'upload_failed');--> statement-breakpoint
CREATE TABLE "document_chunk" (
	"document_chunk_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_content_id" uuid NOT NULL,
	"position" integer,
	"chunk_content" text NOT NULL,
	"chunk_embedding" jsonb NOT NULL,
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
	"path" "ltree" NOT NULL,
	"kind" "document_kind" NOT NULL,
	"file_meta" jsonb,
	"upload_status" "document_upload_status" DEFAULT 'uploaded' NOT NULL,
	"latest_content_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "document_chunk" ADD CONSTRAINT "document_chunk_document_content_id_document_content_document_content_id_fk" FOREIGN KEY ("document_content_id") REFERENCES "public"."document_content"("document_content_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_content" ADD CONSTRAINT "document_content_document_id_document_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_relation" ADD CONSTRAINT "document_relation_base_document_id_document_document_id_fk" FOREIGN KEY ("base_document_id") REFERENCES "public"."document"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_relation" ADD CONSTRAINT "document_relation_related_document_id_document_document_id_fk" FOREIGN KEY ("related_document_id") REFERENCES "public"."document"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_content_document_id_version_deleted_null_idx" ON "document_content" USING btree ("document_id","version") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_relation_base_related_type_deleted_null_idx" ON "document_relation" USING btree ("base_document_id","related_document_id","relation_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_user_id_path_deleted_null_idx" ON "document" USING btree ("user_id","path") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "document_path_gist_idx" ON "document" USING gist ("path");
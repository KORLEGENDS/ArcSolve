CREATE TYPE "public"."document_ai_message_role" AS ENUM('user', 'assistant', 'system', 'tool');--> statement-breakpoint
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
ALTER TABLE "document_ai_message" ADD CONSTRAINT "document_ai_message_document_id_document_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_ai_part" ADD CONSTRAINT "document_ai_part_document_ai_message_id_document_ai_message_document_ai_message_id_fk" FOREIGN KEY ("document_ai_message_id") REFERENCES "public"."document_ai_message"("document_ai_message_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_ai_message_document_id_index_deleted_null_idx" ON "document_ai_message" USING btree ("document_id","index") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "document_ai_message_ui_message_id_idx" ON "document_ai_message" USING btree ("ui_message_id");
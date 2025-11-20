ALTER TABLE "document" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."document_kind";--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('folder', 'document');--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "kind" SET DATA TYPE "public"."document_kind" USING "kind"::"public"."document_kind";
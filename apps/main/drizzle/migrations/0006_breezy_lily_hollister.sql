-- 0006_breezy_lily_hollister.sql
-- chunk_embedding 컬럼을 jsonb → vector(1536)로 전환하고 ivfflat 인덱스를 생성합니다.
-- 개발 환경 기준으로 document_chunk 테이블에 데이터가 없다는 가정하에,
-- 캐스팅 대신 컬럼을 드롭 후 재생성합니다.

ALTER TABLE "document_chunk" DROP COLUMN "chunk_embedding";--> statement-breakpoint
ALTER TABLE "document_chunk" ADD COLUMN "chunk_embedding" vector(1536) NOT NULL;--> statement-breakpoint
CREATE INDEX "document_chunk_embedding_ivfflat_idx" ON "document_chunk" USING ivfflat ("chunk_embedding" vector_cosine_ops) WITH (lists=100);
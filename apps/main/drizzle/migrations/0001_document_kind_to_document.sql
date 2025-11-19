-- document_kind 값을 구조 정보('folder' | 'document')로 단순화하는 마이그레이션
-- - 기존 'note' / 'file' 값은 모두 'document'로 통합
-- - 'folder' 값은 그대로 유지

DO $$
BEGIN
  -- 1) 기존 enum 값 기준으로 document.kind 값을 임시 문자열 컬럼에 백업 (필요시 참조용)
  --    실제 로직에서는 바로 enum 값을 업데이트하므로 필수는 아니지만,
  --    마이그레이션 중 디버깅을 위해 남겨둘 수 있습니다.
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'document'
      AND column_name = 'kind_legacy'
  ) THEN
    ALTER TABLE "public"."document"
      ADD COLUMN "kind_legacy" text;

    UPDATE "public"."document"
    SET "kind_legacy" = "kind"::text;
  END IF;

  -- 2) 기존 enum 값('note','file','folder')을 사용하는 컬럼을 text로 캐스팅
  ALTER TABLE "public"."document"
    ALTER COLUMN "kind" TYPE text USING "kind"::text;

  -- 3) 기존 enum 타입에서 'note', 'file' 값을 제거하고 'document' 값을 추가하는 대신,
  --    새 enum 타입을 만들고 교체하는 전략을 사용합니다.

  -- 기존 enum 타입 이름을 임시로 변경
  ALTER TYPE "public"."document_kind" RENAME TO "document_kind_old";

  -- 새 enum 타입 생성: 'folder' | 'document'
  CREATE TYPE "public"."document_kind" AS ENUM ('folder', 'document');

  -- 4) document.kind 텍스트 값을 새 enum 값으로 매핑
  --    - 'folder'    -> 'folder'
  --    - 'note','file' 기타 값 -> 'document'
  UPDATE "public"."document"
  SET "kind" = CASE
    WHEN "kind" = 'folder' THEN 'folder'
    ELSE 'document'
  END;

  -- 5) 컬럼 타입을 새 enum으로 변경
  ALTER TABLE "public"."document"
    ALTER COLUMN "kind" TYPE "public"."document_kind" USING "kind"::"public"."document_kind";

  -- 6) 더 이상 필요 없는 이전 enum 타입 제거
  DROP TYPE "public"."document_kind_old";
END $$;



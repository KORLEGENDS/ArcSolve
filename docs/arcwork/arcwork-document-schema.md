## ArcWork 문서 스키마 개요

ArcSolve/ArcWork 문서 시스템은 다음 네 가지 테이블을 중심으로 동작합니다.

- **document**: 루트 엔티티 (정체성 + 계층 path + owner + 최신 버전 포인터)
- **document_content**: 버전 단위 실제 내용 및 메타데이터
- **document_relation**: 문서 간 그래프 관계(edge)
- **document_chunk**: 버전별 RAG 검색용 chunk + embedding

---

## 1. document (루트 + path + 최신 버전)

- **역할**
  - 문서/폴더의 정체성과 위치(path) + owner 관리
  - 최신 버전 콘텐츠를 가리키는 포인터(`latest_content_id`) 포함
- **핵심 컬럼**
  - `document_id (uuid, PK)`
  - `user_id (uuid)`: 문서 owner (tenant 기준)
  - `path (ltree)`: 유저 네임스페이스 내 계층 경로
  - `kind (document_kind)`: `note | file | folder`
  - `file_meta (jsonb | null)`: 파일 문서(`kind = 'file'`)에 대한 메타데이터
    - 예: `{ mimeType: 'application/pdf', fileSize: 12345, storageKey: 'users/{userId}/documents/{documentId}' }`
  - `upload_status (document_upload_status)`: 업로드 상태
    - `pending | uploading | uploaded | upload_failed`
    - `note/folder` 등 비파일 문서는 기본적으로 `uploaded`로 간주
  - `latest_content_id (uuid | null)`: FK → `document_content.document_content_id`
  - `created_at / updated_at / deleted_at`
- **제약/인덱스**
  - `UNIQUE (user_id, path) WHERE deleted_at IS NULL`
  - `GIST (path)` 인덱스로 subtree 쿼리 최적화

`path`는 `ltree` 타입으로, 예를 들어 `root.project.arcyou` 같은 형식으로 계층을 표현합니다.

---

## 2. document_content (버전 단위 내용)

- **역할**
  - 실제 본문/메타를 버전 단위로 저장
  - 버전별 author 정보 포함
- **핵심 컬럼**
  - `document_content_id (uuid, PK)`
  - `document_id (uuid)`: FK → `document.document_id`
  - `user_id (uuid)`: 해당 버전을 생성한 작성자
  - `contents (jsonb | null)`: 텍스트, PDF 파싱 결과, 음성 전사 등
  - `version (int)`: 동일 문서 내 1,2,3… 단조 증가
  - `created_at / updated_at / deleted_at`
- **제약**
  - `UNIQUE (document_id, version) WHERE deleted_at IS NULL`

`document.latest_content_id`는 애플리케이션에서 최신 `document_content`의 id로 유지/갱신합니다.

---

## 3. document_relation (문서 그래프)

- **역할**
  - 문서 간 관계(edge)를 명시적으로 표현
  - relation type으로 그래프 쿼리를 필터링
- **핵심 컬럼**
  - `document_relation_id (uuid, PK)`
  - `base_document_id (uuid)`: from/source, FK → `document.document_id`
  - `related_document_id (uuid)`: to/target, FK → `document.document_id`
  - `relation_type (document_relation_type)`:
    - `reference | summary | translation | derived | duplicate`
  - `created_at / updated_at / deleted_at`
- **제약**
  - `UNIQUE (base_document_id, related_document_id, relation_type) WHERE deleted_at IS NULL`

예시:

- “이 PDF의 summary 노트들” → `WHERE base_document_id = ? AND relation_type = 'summary'`
- “이 문서를 참조하는 모든 문서” → `WHERE related_document_id = ? AND relation_type = 'reference'`

---

## 4. document_chunk (RAG 인덱스)

- **역할**
  - 특정 `document_content` 버전의 chunk + embedding 저장
  - 벡터 유사도 검색의 실제 타겟 테이블
- **핵심 컬럼**
  - `document_chunk_id (uuid, PK)`
  - `document_content_id (uuid)`: FK → `document_content.document_content_id`
  - `position (int | null)`: 원문 내 순서 (옵션)
  - `chunk_content (text)`: chunk 텍스트
  - `chunk_embedding (vector(1536))`: pgvector embedding
  - `created_at / updated_at / deleted_at`
- **인덱스**
  - `USING ivfflat (chunk_embedding vector_cosine_ops) WITH (lists = 100)`
    - Drizzle 스키마에서 index 메타를 정의하고, DB에는 pgvector 확장 설치 필요

`document_chunk`에는 `user_id`를 넣지 않고, `document_content → document` 경로를 타고 tenant 정보를 얻습니다.

---

## 5. 한 사이클 예시 (생성 → 버전 → RAG → 그래프)

1. **새 노트 생성**
   - `document` insert: `user_id`, `path (ltree)`, `kind = 'note'`
   - `latest_content_id`는 아직 `null`
2. **내용 작성/수정**
   - `document_content` insert: `document_id`, `user_id`, `contents`, `version = n`
   - 해당 id를 `document.latest_content_id`로 업데이트
3. **임베딩 생성**
   - 최신 `document_content.contents`를 chunk로 쪼개어 `document_chunk`에 insert
   - 검색 시 `document_chunk`를 pgvector 인덱스로 질의
4. **폴더/프로젝트 뷰**
   - `WHERE user_id = ? AND path <@ 'root.project.arcyou'::ltree` 로 subtree 조회
5. **문서 간 관계 연결**
   - PDF ↔ 요약 노트 생성 시 `document_relation`에 edge 추가

이 네 테이블을 통해 ArcWork 문서 시스템에서 **계층(path) / 버전 / RAG / 그래프**를 한 번에 커버할 수 있습니다.



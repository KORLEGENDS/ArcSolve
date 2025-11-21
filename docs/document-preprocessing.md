## 1. 개요

이 문서는 ArcSolve `document` 도메인의 **파일 전처리 파이프라인** 전체 흐름을 정리합니다.  
클라이언트 업로드 완료 시점부터 Outbox 잡 생성, Outbox 워커, 사이드카(FastAPI), 전처리 파이프라인(파싱/청킹/임베딩/저장)까지를 한 번에 이해하는 것을 목표로 합니다.

- **범위**
  - `/api/document/upload/*` 업로드 3단계
  - Outbox(`document.preprocess.v1`) + `outbox-worker-document`
  - 사이드카 `POST /internal/documents/{document_id}/parse`
  - 사이드카 내부 파이프라인(`0_pipeline ~ 4_pg_save`)

자세한 `document` 도메인 스키마/CRUD 흐름은 `docs/document.md` 를,  
사이드카 내부 구현 세부 사항은 `apps/sidecar/docs/preprocessing.md` 를 함께 참고합니다.

---

## 2. 상태 및 DB 스키마 요약

전처리 파이프라인은 `documents` 테이블의 두 가지 상태를 중심으로 동작합니다.

- **업로드 상태 (`documents.uploadStatus`)**
  - `'pending'` → `'uploading'` → `'uploaded'` → `'upload_failed'`
  - 파일이 R2 스토리지에 정상 업로드되었는지를 나타냅니다.
- **전처리 상태 (`documents.processingStatus`)**
  - `'pending'` → `'processing'` → `'processed'` / `'failed'`
  - 업로드 이후, 파싱/임베딩/저장 전처리 파이프라인의 진행 상태를 나타냅니다.

기본 스키마는 다음과 같습니다(발췌, 전체는 `docs/document.md` 참고).

```55:124:apps/main/src/share/schema/drizzles/document-drizzle.ts
export const documents = pgTable(
  'document',
  {
    documentId: uuid('document_id').primaryKey().notNull().defaultRandom(),
    userId: uuid('user_id').notNull(),
    name: text('name'),
    path: ltree('path').notNull(),
    kind: documentKindEnum('kind').notNull(),                               // 'folder' | 'document'
    mimeType: text('mime_type'),
    fileSize: bigint('file_size', { mode: 'number' }),
    storageKey: text('storage_key'),
    uploadStatus: documentUploadStatusEnum('upload_status').default('uploaded').notNull(),
    processingStatus: documentProcessingStatusEnum('processing_status').default('pending').notNull(),
    latestContentId: uuid('latest_content_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  …
);
```

전처리 파이프라인 결과는 다음 테이블에 저장됩니다.

- `document_content`
  - 버전 단위(JSON) 콘텐츠 저장 (`contents` 필드에 마크다운/레이아웃/메트릭 등)
  - `version` 은 문서별 1, 2, 3, ... 으로 증가
  - `document.latestContentId` 로 최신 버전을 가리킴
- `document_chunk`
  - 각 청크 텍스트(`chunk_content`)와 임베딩 벡터(`chunkEmbedding`, 256차원)를 저장

---

## 3. 업로드 3단계 → Outbox 잡 생성

업로드 3단계는 다음과 같습니다(자세한 설명은 `docs/document.md` 4.x, 5.x 참고).

1. **`POST /api/document/upload/request`**
   - `DocumentRepository.createPendingFileForUpload` 를 통해 `documents` 에 **pending 파일 문서(kind='document')** 를 생성합니다.
   - 이때 `uploadStatus = 'pending'`, `processingStatus = 'pending'` 으로 초기화됩니다.
2. **`POST /api/document/upload/presigned`**
   - R2 업로드용 presigned URL 을 발급합니다.
   - `uploadStatus` 는 `'uploading'` 으로 변경됩니다.
3. **`POST /api/document/upload/confirm`**
   - R2 `HeadObject` 로 실제 객체 존재와 크기를 검증합니다.
   - 성공 시:
     - `uploadStatus = 'uploaded'`
     - `mimeType`, `fileSize`, `storageKey` 세팅
     - 업로드 프로세스 상태를 `'uploaded'` 로 전환
     - **전처리 파이프라인 진입 처리**:
       - `processingStatus` 를 `'pending'` 으로 설정
       - `outbox` 테이블에 `type = 'document.preprocess.v1'` 잡을 생성

Confirm 단계의 핵심 로직은 다음과 같습니다.

```150:180:apps/main/src/app/(backend)/api/document/upload/confirm/route.ts
const updated = await repository.updateUploadStatusAndMeta({
  documentId: document.documentId,
  userId,
  uploadStatus: 'uploaded',
  mimeType: process.mimeType,
  fileSize: headContentLength,
  storageKey: process.storageKey,
});

// 업로드가 정상 완료되었으므로, 전처리 파이프라인을 위한 job을 Outbox에 적재하고
// 문서의 processingStatus를 'pending' 으로 설정합니다.
await Promise.all([
  repository.updateProcessingStatusForOwner({
    documentId: document.documentId,
    userId,
    processingStatus: 'pending',
  }),
  db.insert(outbox).values({
    type: 'document.preprocess.v1',
    roomId: updated.documentId,
    payload: {
      kind: 'document.preprocess.v1',
      documentId: updated.documentId,
      userId,
    },
  }),
]);
```

이 시점부터 전처리는 **Outbox 워커 및 사이드카**가 맡게 됩니다.

---

## 4. Outbox 워커 (`worker-document.ts`)

문서 전처리 전용 Outbox 워커는 `apps/outbox-worker/worker-document.ts` 에 구현되어 있으며,  
Docker 서비스 `outbox-worker-document` (`arcsolve-outbox-worker-document-dev`) 로 실행됩니다.

- **환경 변수**
  - `DATABASE_URL`: PgBouncer 경유 Postgres URL
  - `SIDECAR_BASE_URL` 또는 `DOCUMENT_SIDECAR_BASE_URL`: 사이드카 기본 URL  
    - 로컬 개발에서 사이드카를 맥 호스트에서 8000 포트로 띄우는 경우  
      `SIDECAR_BASE_URL=http://host.docker.internal:8000` 로 설정
  - `POLL_INTERVAL_MS`, `BATCH_SIZE`, `LOCK_SECONDS`, `MAX_ATTEMPTS` 등(기본값 위주 사용)

### 4.1 처리 대상 잡

- `outbox` 테이블에서 **`type LIKE 'document.%'`** 인 레코드만 소비합니다.
- 현재 사용 중인 타입:
  - `document.preprocess.v1`

### 4.2 처리 흐름

각 잡(row)에 대해 워커는 다음 순서로 동작합니다.

1. **payload 검증**
   - `payload.documentId`, `payload.userId` 가 모두 존재하는지 확인
2. **문서 상태를 `'processing'` 으로 전환**
   - `documents` 테이블에서 `(documentId, userId)` 로 대상 문서를 조회
   - 없으면 에러로 간주하고 해당 Outbox 레코드를 `dead` 로 전환
3. **사이드카 호출**
   - `base = SIDECAR_BASE_URL` (뒷 슬래시는 제거)
   - `url = {base}/internal/documents/{documentId}/parse`
   - `POST` 바디:
     ```json
     { "userId": "<사용자 UUID 문자열>" }
     ```
   - HTTP 2xx 가 아니면 응답 본문을 포함해 에러로 처리
4. **성공 시**
   - `documents.processingStatus = 'processed'`
   - Outbox 레코드를 `published` 상태로 마킹
5. **실패 시**
   - `documents.processingStatus = 'failed'`
   - Outbox 레코드를 `dead` 로 전환하고 `error` 필드에 메시지 저장

> **재시도 정책**: 현재 구현은 **재시도/백오프 없이 1회 시도 후 실패 시 `failed/dead` 로 남기는** 단순 정책입니다.

---

## 5. 사이드카 엔드포인트 (`/internal/documents/{document_id}/parse`)

사이드카는 FastAPI 기반 Python 서비스(`apps/sidecar/main.py`)로,  
문서 전처리 파이프라인을 HTTP API 형태로 제공하며 메인 서버에서만 호출합니다.

- **엔드포인트**
  - `POST /internal/documents/{document_id}/parse`
- **요청 바디**
  - `{"userId": "<사용자 UUID 문자열>"}`  
    (메인 서버의 `userId` 와 동일해야 하며, DB 쿼리 시 검증됩니다.)
- **성공 응답**
  - `{"status": "ok", "document_id": "...", "content_id": "...", "chunk_count": 42}`

### 5.1 처리 단계

1. **파라미터 검증**
   - `document_id`, `userId` 가 모두 유효한 UUID 인지 검사
2. **Document 메타 조회**
   - `src/schema/db.py` 의 `get_session()` 으로 SQLAlchemy 세션 획득
   - `Document` 모델(`src/schema/document_schema.py`)을 이용해
     - `document.document_id == document_id`
     - `document.user_id == user_id`
     를 만족하는 문서를 조회
   - 문서가 없으면 `404`, `storage_key` 가 없으면 `400` 반환
3. **R2 에서 원본 파일 다운로드**
   - `src/processing/storage/r2_client.py` 의 `download_to_temp(storage_key)` 호출
   - Cloudflare R2 환경 변수:
     - `R2_ACCOUNT_ID`
     - `R2_ACCESS_KEY_ID`
     - `R2_SECRET_ACCESS_KEY`
     - `R2_BUCKET_NAME`
   - 지정된 `storage_key` 객체를 임시 디렉터리로 다운로드하고, 로컬 파일 경로를 돌려받습니다.
4. **전처리 파이프라인 실행**
   - `src.preprocessing.0_pipeline.run_pipeline_for_file(tmp_path, user_uuid, document_uuid)` 호출
   - 내부에서 파싱/청킹/임베딩/저장 4단계를 순차적으로 수행
5. **임시 파일 정리**
   - 파이프라인 성공/실패와 관계없이, 다운로드한 임시 파일과 디렉터리를 삭제

에러 발생 시:

- 입력/유효성 문제 → `400`
- R2 다운로드 실패 → `500`
- 파이프라인 내부 예외 → `500` (메시지는 FastAPI 공통 에러 핸들링에 위임)

---

## 6. 사이드카 내부 파이프라인 단계

사이드카 파이프라인 코드는 `apps/sidecar/src/preprocessing` 에 위치합니다.

- `0_pipeline.py` – 전체 오케스트레이션
- `1_parse.py` – Marker 기반 파싱(로컬/원격)
- `2_chunk.py` – 마크다운 청킹
- `3_embed.py` – 임베딩 생성
- `4_pg_save.py` – PostgreSQL 저장

### 6.1 0단계 – 오케스트레이션 (`0_pipeline.run_pipeline_for_file`)

```18:52:apps/sidecar/src/preprocessing/0_pipeline.py
def run_pipeline_for_file(
    file_path: str,
    user_id: uuid.UUID,
    document_id: uuid.UUID,
) -> Dict[str, Any]:
    # 1) 파싱
    parsed = parse_mod.parse_document_step(file_path)
    # 2) 청킹
    chunks = chunk_mod.chunk_markdown_step(parsed["markdown"], chunk_size=300, chunk_overlap=0)
    # 3) 임베딩
    embeddings = embed_mod.embed_chunks_step(chunks)
    # 4) 저장
    result = save_mod.save_to_pg_step(parsed, chunks, embeddings, user_id, document_id)
    …
```

입력으로 받은 `file_path`, `user_id`, `document_id` 를 그대로 하위 단계에 전달하여,  
**기존 Document 에 대한 새로운 콘텐츠 버전 및 청크를 생성**하는 구조입니다.

### 6.2 1단계 – 파싱 (`1_parse.parse_document_step`)

- **역할**
  - Marker 라이브러리를 이용해 PDF/이미지/Office 문서/EPUB/HTML 등을 파싱
  - 마크다운/레이아웃/메트릭을 포함한 공통 dict 를 반환
- **입력**
  - 로컬 파일 경로(`file_path`)
- **출력 필드**
  - `pdf_path`: 실제 파일 경로(키 이름은 레거시 호환을 위해 유지)
  - `file_name`: 파일명
  - `file_size`: 바이트 단위 크기
  - `mime_type`: 추론된 MIME 타입
  - `markdown`: 정제된 전체 마크다운 텍스트
  - `layout`: 최소 오버레이 레이아웃(페이지/블록 정보)
  - `metrics`: `{ contentLength, pageCount }`

#### 로컬 Marker vs Datalab Marker API

`1_parse.py` 는 환경 변수에 따라 **로컬 Marker 파서**와 **Datalab Marker API** 중 하나를 사용합니다.

- 환경 변수:
  - `MARKER_REMOTE_ENABLED=true|false`
  - `MARKER_REMOTE_API_KEY=...` (Datalab Marker API 키)

동작 규칙:

- `MARKER_REMOTE_ENABLED=true` 이고 `MARKER_REMOTE_API_KEY` 가 설정되어 있으면
  - `https://www.datalab.to/api/v1/marker` 로 파일을 업로드하고
  - 응답의 `request_check_url` 을 Polling 하여 `status == "complete"` 일 때까지 대기
  - 최종 payload 에서 `markdown` 과 `json` 을 읽어와
    - 기존 로컬 파서와 동일한 `_clean_markdown_remove_raw_html`, `_build_layout_from_json`, `_calculate_metrics` 로 후처리
  - 반환 형태는 로컬 파서와 완전히 동일합니다.
- 그렇지 않으면
  - 기존 로컬 Marker 파이프라인을 사용합니다.
  - `PdfConverter.build_document(...)` 로 문서 객체를 생성하고,
  - `JSONRenderer` / `MarkdownRenderer` 를 통해 JSON/Markdown 을 렌더링합니다.

이렇게 설계하여 **로컬/원격 파싱 백엔드를 바꾸더라도 파이프라인 나머지 단계 코드는 바뀌지 않도록** 했습니다.

### 6.3 2단계 – 마크다운 청킹 (`2_chunk.chunk_markdown_step`)

- `langchain_text_splitters.RecursiveCharacterTextSplitter.from_tiktoken_encoder` 를 사용해
  - 마크다운을 토큰 기준으로 재귀적 분할합니다.
- 기본 설정
  - `chunk_size = 300`
  - `chunk_overlap = 0`
  - tokenizer: `"gpt-4o"`(또는 호환 tiktoken)
- 출력은 `list[str]` 형태의 청크 리스트입니다.

### 6.4 3단계 – 임베딩 생성 (`3_embed.embed_chunks_step`)

- 모델: `Snowflake/snowflake-arctic-embed-m-v2.0` (다국어 검색 최적화 임베딩)
- 처리:
  - 각 청크를 토크나이즈 후 CLS 토큰 벡터를 임베딩으로 사용
  - Matryoshka 기법으로 앞 256차원만 사용
  - L2 정규화
- 출력: `list[list[float]]` (각 벡터 길이 256)

### 6.5 4단계 – PostgreSQL 저장 (`4_pg_save.save_to_pg_step`)

```35:116:apps/sidecar/src/preprocessing/4_pg_save.py
def save_to_pg_step(
    parsed: Dict[str, Any],
    chunks: List[str],
    embeddings: List[List[float]],
    user_id: uuid.UUID,
    document_id: uuid.UUID,
) -> Dict[str, Any]:
    …
    # 1) 기존 Document 조회 (document_id + user_id)
    # 2) DocumentContent 생성 (version = 기존 max + 1, contents JSONB에 markdown/layout/metrics 저장)
    # 3) Document.latest_content_id 갱신
    # 4) DocumentChunk N개 생성 (position, chunk_content, chunk_embedding)
    # 5) 커밋 후 { document_id, content_id, chunk_count } 반환
```

중요한 점:

- **새 Document 를 만들지 않습니다.**
  - 메인 서버에서 이미 생성해 둔 `document_id` 를 기준으로만 동작합니다.
- 전처리 성공 여부에 따른 `processingStatus` 변경은 **Outbox 워커**가 담당하며,  
  사이드카는 오직 콘텐츠/청크 저장만 수행합니다.

---

## 7. Cloudflare R2 연동

사이드카는 Cloudflare R2(S3 호환) 를 사용해 원본 파일을 다운로드합니다.

- 설정 파일: `apps/sidecar/src/processing/storage/r2_client.py`
- 필요 환경 변수:
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
- 헬퍼 함수:
  - `download_to_temp(storage_key: str) -> Path`
    - 임시 디렉터리를 생성하고,
    - 주어진 `storage_key` 객체를 해당 디렉터리에 다운로드한 뒤,
    - 로컬 파일 경로를 반환합니다.

메인 서버는 업로드 확인 시점에 이미 R2 객체 존재 여부/크기를 검증하므로,  
사이드카는 주로 **전처리 시점의 R2 네트워크/권한 문제**만 신경 쓰면 됩니다.

---

## 8. 개발/운영 노트

- **로컬 개발에서 사이드카 호출**
  - 사이드카를 맥에서 직접 `uvicorn main:app --port 8000` 으로 실행하는 경우,
  - Docker 컨테이너(`outbox-worker-document`) 에서는
    - `SIDECAR_BASE_URL=http://host.docker.internal:8000` 로 설정해야 합니다.
- **재시도/에러 처리**
  - 현재는 Outbox 워커에서 **1회 시도 후 실패 시 `documents.processingStatus='failed'`, Outbox `status='dead'`** 로 남기는 정책입니다.
  - 재시도나 수동 재실행은 추후 운영 정책에 맞춰 확장할 수 있습니다.
- **디버깅 시 단독 실행**
  - 사이드카 내부 파이프라인은 `0_pipeline.run_pipeline_for_file` 을 통해 독립적으로 실행할 수 있습니다.
  - 필요 시 특정 파일 경로와 `(user_id, document_id)` 를 직접 전달해 동작을 검증할 수 있습니다.

이 문서는 전처리 파이프라인 변경 시 반드시 최신 상태로 유지해야 하며,  
구현 수정 시에는 **메인 서버 Drizzle 스키마 / Outbox 워커 / 사이드카 코드와의 일관성**을 항상 함께 검토하는 것을 권장합니다.



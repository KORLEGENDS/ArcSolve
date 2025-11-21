## 개요

이 문서는 ArcYou 문서 전처리 파이프라인의 전체 흐름과 각 단계의 역할을 정리합니다.  
파이프라인은 **단일 파일(PDF / 이미지 / DOCX / PPTX / XLSX / EPUB / HTML 등)** 을 입력으로 받아,  
**파싱 → 청킹 → 임베딩 → PostgreSQL 저장**까지 자동으로 수행합니다.

- **코드 위치**: `src/`
  - `0_pipeline.py`
  - `1_parse.py`
  - `2_chunk.py`
  - `3_embed.py`
  - `4_pg_save.py`
- **DB 스키마**: `document_schema.py`

---

## 전체 파이프라인 흐름

### **단일 파일 처리 플로우**

1. **1단계 – 파싱 (`1_parse.parse_document_step`)**
2. **2단계 – 청킹 (`2_chunk.chunk_markdown_step`)**
3. **3단계 – 임베딩 (`3_embed.embed_chunks_step`)**
4. **4단계 – 저장 (`4_pg_save.save_to_pg_step`)**

이 4단계는 `0_pipeline.run_pipeline_for_file` 에서 순차적으로 호출됩니다.

실제 사용 시에는 다음과 같이 실행합니다:

```bash
cd /Users/gyeongmincho/Projects/ArcYou
source venv/bin/activate

# DB 연결 정보는 .env 또는 환경변수에서 읽음
POSTGRES_USER=test \
POSTGRES_PASSWORD=... \
POSTGRES_DB=test_dev \
python - << 'PY'
import uuid
from src import 0_pipeline  # 내부에서는 importlib로 모듈 로드

result = 0_pipeline.run_pipeline_for_pdf(
    'test/test.pdf',
    uuid.UUID('00000000-0000-0000-0000-000000000001'),
)
print(result)
PY
```

---

## 1단계: 파일 파싱 (`src/1_parse.py`)

- **함수(일반화 엔트리)**: `parse_document_step(file_path: str) -> dict`
- **호환용 래퍼**: `parse_pdf_step(pdf_path: str) -> dict` (내부적으로 `parse_document_step` 호출)
- **외부 의존성**: `marker`
  - Converter: `marker.converters.pdf.PdfConverter`
  - Provider 자동 선택: `marker.providers.registry.provider_from_filepath`
  - 공통: `marker.models.create_model_dict`
  - 공통: `marker.renderers.json.JSONRenderer`
  - 공통: `marker.renderers.markdown.MarkdownRenderer`

### **주요 처리 내용**

- 입력 파일 경로 유효성 검증 (`Path.is_file()`)
- `PdfConverter.build_document(...)` 로 **문서 객체 1회 빌드**
  - 내부적으로 `provider_from_filepath` 가 파일 내용을 검사해 적절한 Provider를 선택
  - 지원 예시:
    - PDF: `PdfProvider`
    - 이미지: `ImageProvider`
    - DOCX: `DocumentProvider`
    - XLSX: `SpreadSheetProvider`
    - PPTX: `PowerPointProvider`
    - EPUB: `EpubProvider`
    - HTML: `HTMLProvider`
- 동일 문서 객체에서:
  - `JSONRenderer` → Marker JSON 트리 생성
  - `MarkdownRenderer` → 전체 마크다운 생성
- JSON 트리 기반으로:
  - **레이아웃 최소 스키마 구성**
    - `pages[].blocks[]` 에 `{ id, type, bbox, text }`
    - 페이지 bbox 기반 `size.width/height` 추론
  - **텍스트 정규화**
    - HTML 태그 제거
    - `Page` 블록 제외
- 마크다운 정제
  - 코드블록/인라인코드 보호
  - `<http://...>` 오토링크 보호
  - 나머지 원시 HTML 제거
  - 과도한 개행 축소
-- **메트릭 계산**
  - `contentLength`: 정제된 마크다운 길이
  - `pageCount`: 레이아웃 `stats.pages`  
    - PDF: 물리 페이지 수  
    - 이미지(OCR): 이미지(페이지) 수

### **출력 스키마**

```python
{
  "pdf_path": str,        # 실제 파일 경로 (기존 키 이름 유지)
  "file_name": str,       # 파일명 (예: "test.pdf", "image.png")
  "file_size": int,       # 바이트 단위 파일 크기
  "mime_type": str | None,# 추론된 MIME 타입 (예: 'application/pdf', 'image/png')
  "markdown": str,        # 정제된 전체 마크다운 텍스트
  "layout": dict,         # 최소 오버레이 레이아웃
  "metrics": {
    "contentLength": int,
    "pageCount": int,
  },
}
```

---

## 2단계: 마크다운 청킹 (`src/2_chunk.py`)

- **함수**: `chunk_markdown_step(markdown: str, chunk_size=300, chunk_overlap=0) -> list[str]`
- **외부 의존성**: `langchain-text-splitters`, `tiktoken`
  - `langchain_text_splitters.RecursiveCharacterTextSplitter.from_tiktoken_encoder`

### **주요 처리 내용**

- 입력 마크다운 텍스트를 **토큰 기준**으로 재귀적 분할
- 설정:
  - **chunk_size**: 300 (대략적인 토큰 수)
  - **chunk_overlap**: 0 (현재는 중첩 없음)
  - tokenizer: `"gpt-4o"` (또는 `cl100k_base` 호환)
- 반환: 각 청크는 **RAG에 바로 넣을 수 있는 텍스트 단위**로 사용 가능

---

## 3단계: 임베딩 생성 (`src/3_embed.py`)

- **함수**: `embed_chunks_step(chunks: list[str], model_id=EMBED_MODEL_ID, dim=256) -> list[list[float]]`
- **외부 의존성**:
  - `transformers` (`AutoModel`, `AutoTokenizer`)
  - `torch`

### **모델 설정**

- **기본 모델**: `Snowflake/snowflake-arctic-embed-m-v2.0`
  - Snowflake Arctic Embed v2.0 **Medium**
  - 다국어 지원, 검색 최적화 전용 임베딩
- **Matryoshka Representation Learning**
  - 원래 임베딩 차원에서 **앞 256차원만 잘라 사용**
  - 스토리지 비용 절감 및 빠른 벡터 연산을 위한 설정

### **주요 처리 내용**

1. `AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)`
2. `AutoModel.from_pretrained(..., add_pooling_layer=False, use_memory_efficient_attention=False, unpad_inputs=False, attn_implementation="eager")`
3. 입력 청크 리스트를 토크나이징 (`max_length=8192`)
4. `last_hidden_state[:, 0]` (CLS 토큰) 을 베이스 임베딩으로 사용
5. Matryoshka 슬라이싱: `[:256]`
6. `F.normalize(..., p=2, dim=1)` 로 L2 정규화

### **출력**

- `embeddings: list[list[float]]`
  - 길이 = `len(chunks)`
  - 각 벡터 길이 = 256

---

## 4단계: PostgreSQL 저장 (`src/4_pg_save.py`)

- **함수**: `save_to_pg_step(parsed, chunks, embeddings, user_id, document_id) -> dict`
- **외부 의존성**:
  - `document_schema.py` (SQLAlchemy ORM 스키마)
  - `sqlalchemy`, `psycopg2-binary`, `pgvector`

### **DB 연결 및 초기화**

- 환경변수 사용:
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `POSTGRES_DB`
  - `POSTGRES_HOST` (기본값 `localhost`)
  - `POSTGRES_PORT` (기본값 `5432`)
- 확장:
  - `CREATE EXTENSION IF NOT EXISTS vector`
  - `CREATE EXTENSION IF NOT EXISTS ltree`
- 테이블 생성:
  - `Base.metadata.create_all(engine)` (`document_schema.py` 기준)

### **저장 로직**

- **Document**
  - `name`: 파일명
  - `path`: `root.<safe_name>_<uuid8>`
  - `kind`: `DocumentKind.DOCUMENT`
  - `mime_type`: `parsed["mime_type"]` (없으면 `"application/pdf"` 등 기본값)
  - `file_size`: `parsed["file_size"]`
  - `storage_key`: `"local_pipeline/<file_name>"`
  - `upload_status`: `DocumentUploadStatus.UPLOADED`
  - `processing_status`: `DocumentProcessingStatus.PROCESSED`

- **DocumentContent**
  - `version`: `1`
  - `contents` (JSONB):
    ```json
    {
      "schema_version": 1,
      "markdown": "...",
      "layout": { ... },
      "metrics": { "contentLength": ..., "pageCount": ... }
    }
    ```
  - `latest_content_id`는 `Document` 쪽에서 갱신

- **DocumentChunk**
  - `position`: 청크 인덱스 (0, 1, 2, ...)
  - `chunk_content`: 청크 텍스트
  - `chunk_embedding`: 256차원 벡터 (`list[float]` → `pgvector.Vector(256)`)

### **반환 값**

```python
{
  "document_id": uuid.UUID,
  "content_id": uuid.UUID,
  "chunk_count": int,
}
```

---

## 0단계: 전체 파이프라인 (`src/0_pipeline.py`)

- **함수(일반화 엔트리)**: `run_pipeline_for_file(file_path: str, user_id: uuid.UUID, document_id: uuid.UUID) -> dict`
- **역할**:
  - 1~4단계 모듈을 순차 호출하여 **단일 파일에 대한 전체 전처리 + 저장** 수행

### **실행 순서**

1. `parsed = parse_document_step(file_path)`
2. `chunks = chunk_markdown_step(parsed["markdown"])`
3. `embeddings = embed_chunks_step(chunks)`
4. `result = save_to_pg_step(parsed, chunks, embeddings, user_id, document_id)`

### **최종 반환**

```python
{
  "pdf_path": parsed["pdf_path"],
  "file_name": parsed["file_name"],
  "mime_type": parsed.get("mime_type"),
  "document_id": result["document_id"],
  "content_id": result["content_id"],
  "chunk_count": result["chunk_count"],
}
```

---

## 5단계: 사이드카 인입 API (`main.py`)

- **엔드포인트**: `POST /ingest/file`
- **역할**:
  - 업로드된 단일 파일을 임시 디스크에 저장한 뒤,
  - `run_pipeline_for_file` 을 동기적으로 호출하여
  - 파이프라인 전체(파싱 → 청킹 → 임베딩 → 저장)를 수행한다.

### **요청 형식**

- Content-Type: `multipart/form-data`
- 필드:
  - `user_id` (form): 대상 사용자 UUID (문자열)
  - `file` (file): 업로드할 단일 파일 (PDF / 이미지 / DOCX / PPTX / XLSX / EPUB / HTML 등)

### **응답 예시**

```json
{
  "status": "ok",
  "file_name": "e443058b87c1485cbf082dee17a607be_test.pdf",
  "mime_type": "application/pdf",
  "document_id": "6f585cf1-19b5-4449-943e-a7fe31ee238f",
  "content_id": "806fed5a-a0bd-435f-b2d2-8470e336821b",
  "chunk_count": 3
}
```

> 참고: 현재 구현은 **동기 처리**이기 때문에 파일 크기/페이지 수에 따라 수십 초까지 지연될 수 있습니다.  
> 운영 단계에서는 이 엔드포인트를 잡 생성용으로만 사용하고, 백그라운드 워커를 통해 실제 파이프라인을 비동기 처리하는 구조로 확장하는 것을 권장합니다.

---

## 운영 상 주의사항

- **성능**
  - Marker + Arctic Embed 모델 로딩 비용이 크므로, 실제 운영 환경에서는
    - 워커 프로세스 재사용
    - 배치 처리
    - GPU(CUDA) 사용 등을 고려해야 합니다.

- **DB**
  - Docker Compose (`docker-compose.dev.yml`) 기반 PG 컨테이너 사용 시
    - `.env` 의 `POSTGRES_*` 값과 일치해야 합니다.

- **확장**
  - 현재 파이프라인은 **PDF → markdown/layout → 청킹 → 임베딩 → 저장** 에 집중되어 있습니다.
  - 추후 이미지/오디오 등 다른 타입을 추가할 경우, 1단계 모듈을 타입별로 분기하거나, 별도 파이프라인을 설계하는 것을 권장합니다.


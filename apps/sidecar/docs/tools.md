## 개요

이 문서는 ArcYou 사이드카 서버에서 제공하는 **문서 트리/검색 도구들**의 역할과 사용 방법을 정리합니다.  
모든 도구는 PostgreSQL(ltree, pgvector, full-text search)에 저장된 사용자의 문서/청크를 대상으로 동작합니다.

- **코드 위치**: `src/processing/tools/`
  - `queyr_tree_list.py` – 사용자별 Document 트리 조회
  - `query_text_search.py` – 텍스트 매칭 기반 청크 검색
  - `query_embed_search.py` – 임베딩 기반 의미 검색
- **공통 특징**
  - `POSTGRES_*` 환경변수 기반 DB 연결
  - `user_id` 기준으로 **현재 사용자 문서만** 조회
  - 삭제(`deleted_at`)된 레코드는 모두 제외

---

## 공통 동작 원칙

### **DB 연결 (`_get_db_engine`)**

모든 도구는 `sqlalchemy.create_engine`를 사용해 동일한 방식으로 PostgreSQL 엔진을 생성합니다.

- 환경변수:
  - `POSTGRES_USER` (기본값: `"postgres"`)
  - `POSTGRES_PASSWORD` (기본값: `"postgres"`)
  - `POSTGRES_DB` (기본값: `"postgres"`)
  - `POSTGRES_HOST` (기본값: `"localhost"`)
  - `POSTGRES_PORT` (기본값: `"5432"`)
- 연결 문자열:
  - `postgresql://{user}:{password}@{host}:{port}/{db}`

### **user_id 정규화 (`_normalize_user_id`)**

- 입력 타입:
  - `uuid.UUID` 혹은 `str` 만 허용
  - 그 외 타입은 `TypeError` 발생
- 문자열인 경우 `uuid.UUID(user_id)` 로 변환 후 내부에서 항상 `uuid.UUID` 로 취급합니다.

---

## Document 트리 조회 도구 (`queyr_tree_list.py`)

### **핵심 함수: `query_tree_list`**

```python
def query_tree_list(
    user_id: uuid.UUID | str,
    root_path: str = "root",
    max_depth: int = 2,
) -> list[dict]:
    ...
```

- **입력 인자**
  - `user_id`: 대상 사용자의 UUID (문자열 혹은 `uuid.UUID`)
  - `root_path`: `ltree` 기반 Document.path prefix (예: `"root"`, `"root.folder"`)
  - `max_depth`: `root_path` 기준으로 내려갈 최대 깊이
    - `0`이면 `root_path` 바로 하위만 포함
    - 0 미만 값은 `ValueError` 발생

- **출력 스키마** (`DocumentTreeItem.to_dict`)

```python
{
  "document_id": str,   # Document.document_id
  "name": str | None,   # 문서/폴더 이름
  "path": str,          # 전체 ltree 경로 (예: "root.folder.doc_1234")
  "kind": str,          # Document.kind (예: "FILE", "FOLDER" 등)
  "level": int,         # nlevel(d.path)
  "relative_path": str, # root_path 기준 상대 경로 (예: "", "sub", "sub.child")
}
```

### **내부 동작**

- `WITH root AS (...)` CTE를 이용해 `root_path` 를 `ltree` 로 캐스팅
- `document` 테이블을 대상으로 다음 조건으로 필터링:
  - `d.user_id = :user_id`
  - `d.deleted_at IS NULL`
  - `d.path <@ root.root_path` (지정한 루트 트리 하위만)
  - `nlevel(d.path) <= nlevel(root.root_path) + :max_depth`
- 경로(`d.path`) 기준으로 정렬하여 트리 순서 보장
- 각 row를 `DocumentTreeItem` 으로 감싼 뒤 `.to_dict()` 로 변환해 리스트로 반환

### **CLI 출력 포매터 (`_format_tree_for_cli`)**

- `relative_path` 의 `"."` 개수를 이용해 들여쓰기 깊이 계산
- 이름이 없으면 `"<unnamed>"`, kind 가 없으면 `"unknown"` 으로 표시
- 출력 예시:

```text
- [FOLDER] root (root)
  - [FILE] test.pdf (root.test_pdf_xxxxxx)
```

### **CLI 사용 예시**

```bash
cd /Users/gyeongmincho/Projects/ArcYou
source venv/bin/activate

python apps/sidecar/src/processing/tools/queyr_tree_list.py \
  --user-id "00000000-0000-0000-0000-000000000001" \
  --root-path "root" \
  --max-depth 2
```

---

## 텍스트 기반 청크 검색 도구 (`query_text_search.py`)

### **핵심 함수: `query_text_search`**

```python
def query_text_search(
    user_id: uuid.UUID | str,
    query: str,
    top_k: int = 5,
    path_prefix: str | None = None,
) -> list[dict]:
    ...
```

- **입력 인자**
  - `user_id`: 검색 대상 사용자
  - `query`: 자연어/키워드 질의 문자열
  - `top_k`: 최대 반환 개수 (0 이하일 경우 빈 리스트 반환)
  - `path_prefix`: `ltree` 기반 Document.path prefix
    - `None` 이면 전체 경로에서 검색
    - `"root.some_folder"` 처럼 특정 폴더 하위만 제한 가능

- **입력 검증**
  - `query` 가 비어있거나 문자열이 아니면 `[]` 반환
  - `top_k <= 0` 이면 `[]` 반환

- **출력 스키마** (`TextSearchResult.to_dict`)

```python
{
  "document_id": str,
  "document_content_id": str,
  "document_name": str | None,
  "document_path": str,
  "document_chunk_id": str,
  "position": int | None,
  "chunk_content": str,
  "rank": float,  # PostgreSQL ts_rank 결과
}
```

### **내부 동작 (Full-text search)**

- `WITH q AS (SELECT plainto_tsquery('simple', :query) AS ts_query)` CTE 사용
- `document_chunk` / `document_content` / `document` 조인:
  - `dc.document_content_id = dct.document_content_id`
  - `dct.document_id = d.document_id`
- 필터 조건:
  - `d.user_id = :user_id`
  - 세 테이블 모두 `deleted_at IS NULL`
  - `q.ts_query @@ to_tsvector('simple', coalesce(dc.chunk_content, ''))`
  - `(:path_prefix IS NULL OR d.path <@ CAST(:path_prefix AS ltree))`
- 랭킹 및 정렬:
  - `ts_rank(to_tsvector('simple', ...), q.ts_query) AS rank`
  - `ORDER BY rank DESC, dct.created_at DESC, dc.position NULLS FIRST`
  - `LIMIT :limit`

### **CLI 출력 포매터 (`_format_results_for_cli`)**

- 결과를 순번과 함께 한 덩어리씩 출력

```text
[1] doc=<document_id> content=<content_id> pos=<position> rank=0.1234
<chunk_content ...>
--------------------------------------------------------------------------------
```

### **CLI 사용 예시**

```bash
cd /Users/gyeongmincho/Projects/ArcYou
source venv/bin/activate

python apps/sidecar/src/processing/tools/query_text_search.py \
  --user-id "00000000-0000-0000-0000-000000000001" \
  --query "벡터 데이터베이스" \
  --top-k 5 \
  --path-prefix "root.my_folder"
```

---

## 임베딩 기반 의미 검색 도구 (`query_embed_search.py`)

### **모델 설정**

- **임베딩 모델**: `Snowflake/snowflake-arctic-embed-m-v2.0`
- **Matryoshka Representation**:
  - 원래 임베딩에서 **앞 256차원만 사용**
  - `F.normalize(..., p=2, dim=1)` 로 L2 정규화
- 디바이스 선택:
  - `cuda` → 사용 가능 시 최우선
  - `mps` → macOS Metal 지원 시
  - 그 외에는 `cpu`

### **모델 로딩 (`_load_embed_model`)**

- 토크나이저/모델/디바이스를 **전역 캐시**하여 최초 1회만 로딩
- `AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)`
- `AutoModel.from_pretrained(..., add_pooling_layer=False, attn_implementation="eager")`
- `model.to(device)` 후 `model.eval()` 로 평가 모드 전환

### **질의 임베딩 함수: `embed_query_to_vector`**

```python
def embed_query_to_vector(
    query: str,
    model_id: str = EMBED_MODEL_ID,
    dim: int = 256,
) -> list[float]:
    ...
```

- **입력 검증**
  - `query` 가 비어있거나 문자열이 아니면 `ValueError` 발생
- **처리 흐름**
  - `_load_embed_model`로 토크나이저/모델/디바이스 로딩
  - `tokenizer([query], padding=True, truncation=True, max_length=8192, return_tensors="pt")`
  - `model(**inputs)` 후 `last_hidden_state[:, 0]` (CLS 토큰) 사용
  - 앞 `dim`(기본 256) 차원만 슬라이싱
  - L2 정규화 후 `list[float]` 로 반환

---

### **핵심 함수: `query_embed_search`**

```python
def query_embed_search(
    user_id: uuid.UUID | str,
    query: str,
    top_k: int = 5,
    path_prefix: str | None = None,
) -> list[dict]:
    ...
```

- **입력 인자 및 검증**
  - `query` 가 비어있거나 문자열이 아니면 `[]` 반환
  - `top_k <= 0` 이면 `[]` 반환
  - `user_id` 는 `_normalize_user_id` 를 통해 `uuid.UUID` 로 정규화
  - `query_vec = embed_query_to_vector(query)` 로 256차원 임베딩 생성

- **출력 스키마** (`ChunkSearchResult.to_dict`)

```python
{
  "document_id": str,
  "document_content_id": str,
  "document_name": str | None,
  "document_path": str,
  "document_chunk_id": str,
  "position": int | None,
  "chunk_content": str,
  "similarity": float,  # 1 - cosine 거리
}
```

### **내부 동작 (pgvector + cosine 거리)**

- `document_chunk` / `document_content` / `document` 조인 구조는 텍스트 검색과 동일
- 필터 조건:
  - `d.user_id = :user_id`
  - 세 테이블 모두 `deleted_at IS NULL`
  - `(:path_prefix IS NULL OR d.path <@ CAST(:path_prefix AS ltree))`
- 벡터 유사도:
  - `dc.chunk_embedding <=> CAST(:query_embedding AS vector)` 로 **cosine 거리** 계산
  - 정렬:
    - `ORDER BY dc.chunk_embedding <=> CAST(:query_embedding AS vector)`
    - 거리가 작을수록 상위에 노출
  - 반환 필드에서:
    - `similarity = 1 - (거리)` 로 **0~1 사이 유사도 점수**로 변환

### **CLI 출력 포매터 (`_format_results_for_cli`)**

```text
[1] doc=<document_id> content=<content_id> pos=<position> score=0.9123
<chunk_content ...>
--------------------------------------------------------------------------------
```

### **CLI 사용 예시**

```bash
cd /Users/gyeongmincho/Projects/ArcYou
source venv/bin/activate

python apps/sidecar/src/processing/tools/query_embed_search.py \
  --user-id "00000000-0000-0000-0000-000000000001" \
  --query "두 번째 뇌 개념과 개인 지식 관리" \
  --top-k 5 \
  --path-prefix "root.my_folder"
```

---

## 운영 상 주의사항

- **성능**
  - 임베딩 검색 도구는 Snowflake Arctic Embed 모델을 로딩하므로
    - 워커 프로세스 재사용
    - 모델 로딩 캐시 유지
    - GPU(CUDA / MPS) 사용 등을 권장합니다.
- **DB 확장**
  - `ltree` / `pgvector` / full-text index 생성 여부를 주기적으로 모니터링해야 합니다.
  - 대규모 데이터셋에서는 쿼리 계획과 인덱스를 점검해 검색 성능을 튜닝해야 합니다.
- **API 연동**
  - 실제 운영 시에는 이 도구들을 **직접 CLI로 호출하기보다는**
    - FastAPI 사이드카 서버의 서비스/엔드포인트 레이어에서
    - 공통 DB 세션/에러 핸들링 로직과 함께 래핑하여 사용하는 것이 좋습니다.



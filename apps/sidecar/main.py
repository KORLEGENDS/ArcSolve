from __future__ import annotations

"""
FastAPI 사이드카 서버 진입점.

- 역할:
  - RAG 파이프라인에서 사용하는 DB 검색 도구들을 HTTP API 형태로 노출
  - Next.js 메인 서버는 이 API를 호출하는 툴을 AI SDK에 등록해 사용

노출 엔드포인트:
- POST /tools/embed-search  -> query_embed_search
- POST /tools/text-search   -> query_text_search
- POST /tools/tree-list     -> query_tree_list
"""

import importlib
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.processing.tools.query_embed_search import query_embed_search
from src.processing.tools.query_text_search import query_text_search
from src.processing.tools.queyr_tree_list import query_tree_list

# ---------------------------------------------------------------------------
# .env 로부터 환경변수 로드
# - /Users/gyeongmincho/Projects/ArcYou/apps/sidecar/.env 기준
# - 이미 설정된 환경변수보다 .env 값을 우선 사용(override=True)
# ---------------------------------------------------------------------------
_BASE_DIR = Path(__file__).resolve().parent
load_dotenv(_BASE_DIR / ".env", override=True)
_UPLOAD_ROOT = _BASE_DIR / "uploads"

# 전처리 파이프라인 모듈 (0_pipeline.py) 동적 로드
_PIPELINE_MOD = importlib.import_module("src.preprocessing.0_pipeline")


app = FastAPI(
    title="ArcYou Sidecar Tools API",
    description="ArcYou RAG 파이프라인용 DB 검색 도구들을 노출하는 사이드카 API.",
    version="0.1.0",
)


# Next.js 개발 서버 및 기타 클라이언트에서 호출 가능하도록 CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 필요 시 환경변수 기반으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EmbedSearchRequest(BaseModel):
    """임베딩 기반 검색 요청 바디."""

    user_id: str = Field(..., description="검색 대상 사용자 UUID (문자열)")
    query: str = Field(..., description="검색 질의 문자열")
    top_k: int = Field(5, ge=1, le=100, description="반환할 최대 청크 개수")
    path_prefix: Optional[str] = Field(
        default=None,
        description="ltree 기반 Document.path prefix (예: 'root.demo')",
    )


class EmbedSearchResultItem(BaseModel):
    """query_embed_search 결과 아이템 스키마."""

    document_id: str
    document_content_id: str
    document_name: Optional[str]
    document_path: str
    document_chunk_id: str
    position: Optional[int]
    chunk_content: str
    similarity: float


class TextSearchRequest(BaseModel):
    """텍스트(full-text) 기반 검색 요청 바디."""

    user_id: str = Field(..., description="검색 대상 사용자 UUID (문자열)")
    query: str = Field(..., description="검색 질의 문자열")
    top_k: int = Field(5, ge=1, le=100, description="반환할 최대 청크 개수")
    path_prefix: Optional[str] = Field(
        default=None,
        description="ltree 기반 Document.path prefix (예: 'root.demo')",
    )


class TextSearchResultItem(BaseModel):
    """query_text_search 결과 아이템 스키마."""

    document_id: str
    document_content_id: str
    document_name: Optional[str]
    document_path: str
    document_chunk_id: str
    position: Optional[int]
    chunk_content: str
    rank: float


class TreeListRequest(BaseModel):
    """문서 트리 조회 요청 바디."""

    user_id: str = Field(..., description="대상 사용자 UUID (문자열)")
    root_path: str = Field(
        "root",
        description="ltree 기반 Document.path prefix (예: 'root', 'root.folder')",
    )
    max_depth: int = Field(
        2,
        ge=0,
        le=10,
        description="root_path 기준으로 내려갈 최대 깊이 (0이면 바로 하위만)",
    )


class TreeListItem(BaseModel):
    """query_tree_list 결과 아이템 스키마."""

    document_id: str
    name: Optional[str]
    path: str
    kind: str
    level: int
    relative_path: str


class IngestFileResponse(BaseModel):
    """단일 파일 인입 파이프라인의 최소 응답 스키마."""

    status: str = Field("ok", description="요청 처리 결과 상태 (항상 'ok')")
    file_name: str = Field(..., description="업로드된 원본 파일명")
    mime_type: Optional[str] = Field(
        None,
        description="추론된 MIME 타입 (예: application/pdf, image/png, text/html 등)",
    )
    document_id: str = Field(..., description="저장된 Document.document_id")
    content_id: str = Field(..., description="저장된 DocumentContent.document_content_id")
    chunk_count: int = Field(..., description="저장된 DocumentChunk 개수")


@app.get("/")
async def health_check() -> Dict[str, Any]:
    """헬스 체크 및 간단한 정보 제공."""
    return {
        "status": "ok",
        "service": "ArcYou Sidecar Tools API",
        "endpoints": [
            "/tools/embed-search",
            "/tools/text-search",
            "/tools/tree-list",
        ],
    }


@app.post("/ingest/file", response_model=IngestFileResponse, status_code=201)
def ingest_file(
    user_id: str = Form(..., description="업로드 대상 사용자 UUID (문자열)"),
    file: UploadFile = File(..., description="업로드할 단일 파일"),
) -> IngestFileResponse:
    """
    단일 파일을 업로드 받아 전처리 파이프라인(파싱 → 청킹 → 임베딩 → PostgreSQL 저장)을
    동기적으로 수행하는 MVP 인입 엔드포인트.

    - 입력: multipart/form-data (user_id + file)
    - 출력: 성공 여부 및 저장된 Document/Content/Chunk 메타데이터
    """
    # 1) user_id 검증
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="user_id는 UUID 문자열이어야 합니다.")

    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="file 이 제공되지 않았습니다.")

    # 2) 업로드 파일을 로컬 디스크에 저장
    uploads_dir = _UPLOAD_ROOT / str(user_uuid)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    original_name = Path(file.filename).name
    # 경로 구분자/공백 등 최소한의 sanitizing
    safe_name = original_name.replace("/", "_").replace("\\", "_").replace(" ", "_")
    tmp_name = f"{uuid.uuid4().hex}_{safe_name}"
    tmp_path = uploads_dir / tmp_name

    try:
        with tmp_path.open("wb") as dst:
            shutil.copyfileobj(file.file, dst)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="파일 저장 중 오류가 발생했습니다.") from exc

    # 3) 전처리 파이프라인 실행 (동기)
    try:
        result: Dict[str, Any] = _PIPELINE_MOD.run_pipeline_for_file(str(tmp_path), user_uuid)
    except ValueError as exc:
        # 예: 지원하지 않는 파일 형식 등 사용자 입력 문제
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="파일 인입 파이프라인 처리에 실패했습니다.") from exc

    # 4) 최소 메타데이터만 응답
    return IngestFileResponse(
        status="ok",
        file_name=str(result.get("file_name") or original_name),
        mime_type=result.get("mime_type"),
        document_id=str(result.get("document_id")),
        content_id=str(result.get("content_id")),
        chunk_count=int(result.get("chunk_count") or 0),
    )


@app.post("/tools/embed-search", response_model=List[EmbedSearchResultItem])
async def embed_search_endpoint(payload: EmbedSearchRequest) -> List[Dict[str, Any]]:
    """
    Snowflake Arctic Embed v2.0 + pgvector 기반 임베딩 검색을 수행하는 엔드포인트.

    - 내부적으로 `query_embed_search` 를 호출합니다.
    """
    try:
        results = query_embed_search(
            user_id=payload.user_id,
            query=payload.query,
            top_k=payload.top_k,
            path_prefix=payload.path_prefix,
        )
        return results
    except Exception as exc:  # pragma: no cover - FastAPI에서 공통 에러로 처리
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/tools/text-search", response_model=List[TextSearchResultItem])
async def text_search_endpoint(payload: TextSearchRequest) -> List[Dict[str, Any]]:
    """
    PostgreSQL full-text search 기반 텍스트 검색을 수행하는 엔드포인트.

    - 내부적으로 `query_text_search` 를 호출합니다.
    """
    try:
        results = query_text_search(
            user_id=payload.user_id,
            query=payload.query,
            top_k=payload.top_k,
            path_prefix=payload.path_prefix,
        )
        return results
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/tools/tree-list", response_model=List[TreeListItem])
async def tree_list_endpoint(payload: TreeListRequest) -> List[Dict[str, Any]]:
    """
    특정 사용자/루트 경로 기준으로 Document 트리를 조회하는 엔드포인트.

    - 내부적으로 `query_tree_list` 를 호출합니다.
    """
    try:
        results = query_tree_list(
            user_id=payload.user_id,
            root_path=payload.root_path,
            max_depth=payload.max_depth,
        )
        return results
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    # 개발 편의를 위한 직접 실행 진입점
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )



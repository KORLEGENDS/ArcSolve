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
import logging
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.processing.storage.r2_client import download_to_temp
from src.processing.tools.query_embed_search import query_embed_search
from src.processing.tools.query_text_search import query_text_search
from src.processing.tools.queyr_tree_list import query_tree_list
from src.schema.db import get_session
from src.schema.document_schema import Document

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

# 로깅 설정
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

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
    root_path: Optional[str] = Field(
        default=None,
        description="조회할 문서 트리의 시작 경로. None이거나 빈 문자열이면 모든 문서를 조회합니다. 경로는 점(.)으로 구분된 계층 구조입니다 (예: 'test', 'test.folder').",
    )
    max_depth: int = Field(
        4,
        ge=0,
        le=10,
        description="root_path 기준으로 내려갈 최대 깊이 (0이면 바로 하위만). root_path가 None이면 전체 트리의 최대 깊이를 의미합니다.",
    )


class TreeListItem(BaseModel):
    """query_tree_list 결과 아이템 스키마."""

    document_id: str
    name: Optional[str]
    path: str
    kind: str
    level: int
    relative_path: str


class DocumentParseRequest(BaseModel):
    """기존 Document에 대한 전처리(파싱/청킹/임베딩) 요청 바디."""

    user_id: str = Field(
        ...,
        alias="userId",
        description="전처리 대상 사용자 UUID (문자열)",
    )


@app.get("/")
async def health_check() -> Dict[str, Any]:
    """헬스 체크 및 간단한 정보 제공."""
    return {
        "status": "ok",
        "service": "ArcYou Sidecar Tools API",
        "endpoints": [
            "/internal/documents/{documentId}/parse",
            "/tools/embed-search",
            "/tools/text-search",
            "/tools/tree-list",
        ],
    }


@app.post(
    "/internal/documents/{document_id}/parse",
    status_code=200,
)
def parse_document(
    document_id: str,
    payload: DocumentParseRequest,
) -> Dict[str, Any]:
    """
    기존 Document(Next 서버에서 생성된 업로드 문서)에 대해
    파일 다운로드 → 파싱 → 청킹 → 임베딩 → PostgreSQL 저장을 수행하는 엔드포인트.

    - 입력: path param document_id + body.userId
    - 출력: 최소한의 파이프라인 결과 메타데이터
    """
    # 1) document_id, userId 검증
    try:
        document_uuid = uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="document_id는 UUID 문자열이어야 합니다.")

    try:
        user_uuid = uuid.UUID(payload.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="userId는 UUID 문자열이어야 합니다.")

    # 2) Document 메타 조회 (storage_key 확인)
    session = get_session()
    try:
        document = (
            session.query(Document)
            .filter(
                Document.document_id == document_uuid,
                Document.user_id == user_uuid,
            )
            .first()
        )
        if document is None:
            raise HTTPException(
                status_code=404,
                detail="해당 Document를 찾을 수 없습니다.",
            )
        if not document.storage_key:
            raise HTTPException(
                status_code=400,
                detail="Document에 storage_key가 설정되어 있지 않습니다.",
            )
        storage_key = str(document.storage_key)
    finally:
        session.close()

    # 3) R2에서 임시 파일로 다운로드
    tmp_path: Path | None = None
    try:
        tmp_path = download_to_temp(storage_key)
    except Exception as exc:  # pragma: no cover - 스토리지 오류는 런타임에서만 재현 가능
        raise HTTPException(
            status_code=500,
            detail=f"R2에서 파일을 다운로드하지 못했습니다: {exc}",
        ) from exc

    # 4) 전처리 파이프라인 실행 (동기)
    try:
        logger.info(
            f"[parse] 파이프라인 시작: document_id={document_id}, "
            f"user_id={payload.user_id}, storage_key={storage_key}"
        )
        result: Dict[str, Any] = _PIPELINE_MOD.run_pipeline_for_file(
            str(tmp_path),
            user_uuid,
            document_uuid,
        )
        logger.info(
            f"[parse] 파이프라인 완료: document_id={document_id}, "
            f"content_id={result.get('content_id')}, chunk_count={result.get('chunk_count')}"
        )
    except ValueError as exc:
        # 예: 지원하지 않는 파일 형식 등 사용자 입력 문제
        logger.warning(f"[parse] 입력 검증 실패: document_id={document_id}, error={exc}")
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - FastAPI에서 공통 에러로 처리
        import traceback
        error_detail = f"파일 전처리 파이프라인 처리에 실패했습니다: {str(exc)}\n{traceback.format_exc()}"
        logger.error(
            f"[parse] 파이프라인 실패: document_id={document_id}, error={exc}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=error_detail,
        ) from exc
    finally:
        # 임시 파일/디렉터리 정리 (실패하더라도 무시)
        if tmp_path is not None:
            try:
                if tmp_path.exists():
                    tmp_path.unlink()
                parent = tmp_path.parent
                parent.rmdir()
            except Exception:
                pass

    return {
        "status": "ok",
        "document_id": str(document_uuid),
        "content_id": str(result.get("content_id")),
        "chunk_count": int(result.get("chunk_count") or 0),
    }


@app.post("/tools/embed-search", response_model=List[EmbedSearchResultItem])
async def embed_search_endpoint(payload: EmbedSearchRequest) -> List[Dict[str, Any]]:
    """
    Snowflake Arctic Embed v2.0 + pgvector 기반 임베딩 검색을 수행하는 엔드포인트.

    - 내부적으로 `query_embed_search` 를 호출합니다.
    """
    logger.info(
        f"[embed-search] 요청: user_id={payload.user_id}, query={payload.query[:100]}, "
        f"top_k={payload.top_k}, path_prefix={payload.path_prefix}"
    )
    try:
        results = query_embed_search(
            user_id=payload.user_id,
            query=payload.query,
            top_k=payload.top_k,
            path_prefix=payload.path_prefix,
        )
        result_count = len(results)
        if result_count > 0:
            first_result = results[0]
            logger.info(
                f"[embed-search] 응답: 결과 {result_count}개, "
                f"첫 결과 - document_id={first_result.get('document_id')}, "
                f"similarity={first_result.get('similarity', 0):.4f}, "
                f"chunk_content_preview={first_result.get('chunk_content', '')[:100]}"
            )
        else:
            logger.info("[embed-search] 응답: 결과 없음")
        return results
    except Exception as exc:  # pragma: no cover - FastAPI에서 공통 에러로 처리
        logger.error(f"[embed-search] 오류: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/tools/text-search", response_model=List[TextSearchResultItem])
async def text_search_endpoint(payload: TextSearchRequest) -> List[Dict[str, Any]]:
    """
    PostgreSQL full-text search 기반 텍스트 검색을 수행하는 엔드포인트.

    - 내부적으로 `query_text_search` 를 호출합니다.
    """
    logger.info(
        f"[text-search] 요청: user_id={payload.user_id}, query={payload.query[:100]}, "
        f"top_k={payload.top_k}, path_prefix={payload.path_prefix}"
    )
    try:
        results = query_text_search(
            user_id=payload.user_id,
            query=payload.query,
            top_k=payload.top_k,
            path_prefix=payload.path_prefix,
        )
        result_count = len(results)
        if result_count > 0:
            first_result = results[0]
            logger.info(
                f"[text-search] 응답: 결과 {result_count}개, "
                f"첫 결과 - document_id={first_result.get('document_id')}, "
                f"rank={first_result.get('rank', 0):.4f}, "
                f"chunk_content_preview={first_result.get('chunk_content', '')[:100]}"
            )
        else:
            logger.info("[text-search] 응답: 결과 없음")
        return results
    except Exception as exc:  # pragma: no cover
        logger.error(f"[text-search] 오류: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/tools/tree-list", response_model=List[TreeListItem])
async def tree_list_endpoint(payload: TreeListRequest) -> List[Dict[str, Any]]:
    """
    특정 사용자/루트 경로 기준으로 Document 트리를 조회하는 엔드포인트.

    - 내부적으로 `query_tree_list` 를 호출합니다.
    """
    logger.info(
        f"[tree-list] 요청: user_id={payload.user_id}, "
        f"root_path={payload.root_path}, max_depth={payload.max_depth}"
    )
    try:
        results = query_tree_list(
            user_id=payload.user_id,
            root_path=payload.root_path,
            max_depth=payload.max_depth,
        )
        result_count = len(results)
        if result_count > 0:
            first_result = results[0]
            logger.info(
                f"[tree-list] 응답: 결과 {result_count}개, "
                f"첫 결과 - document_id={first_result.get('document_id')}, "
                f"name={first_result.get('name')}, path={first_result.get('path')}, "
                f"kind={first_result.get('kind')}"
            )
        else:
            logger.info("[tree-list] 응답: 결과 없음")
        return results
    except Exception as exc:  # pragma: no cover
        logger.error(f"[tree-list] 오류: {exc}", exc_info=True)
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



"""
텍스트 매칭 기반 DocumentChunk 검색 도구.

- 입력:
  - user_id (uuid.UUID 또는 str)
  - query (str)
- 출력:
  - 관련 텍스트를 포함하는 청크 목록(list[dict])

내부 규칙:
- 검색 대상은 DocumentChunk.chunk_content 기준
- PostgreSQL full-text search (plainto_tsquery + to_tsvector) 기반 랭킹
"""

from __future__ import annotations

import math
import os
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Sequence

from sqlalchemy import Integer, bindparam, create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

# document_schema 모듈 import 경로 보정
_SRC_DIR = Path(__file__).resolve().parents[2]  # .../src
_SCHEMA_DIR = _SRC_DIR / "schema"
if str(_SCHEMA_DIR) not in sys.path:
    sys.path.append(str(_SCHEMA_DIR))

from document_schema import (  # type: ignore[import]
    Document,
    DocumentChunk,
    DocumentContent,
)

_ = (Document, DocumentContent, DocumentChunk)


def _sanitize_float(value: Any, default: float = 0.0) -> float:
  """
  JSON 직렬화 가능한 finite float 로 정규화한다.

  - NaN / inf / None / 비숫자 값은 default 로 치환한다.
  """
  try:
      f = float(value)
  except (TypeError, ValueError):
      return default
  if not math.isfinite(f):
      return default
  return f


def _get_db_engine() -> Engine:
    """환경변수 기반 PostgreSQL 엔진 생성."""
    db_user = os.getenv("POSTGRES_USER", "postgres")
    db_password = os.getenv("POSTGRES_PASSWORD", "postgres")
    db_name = os.getenv("POSTGRES_DB", "postgres")
    db_host = os.getenv("POSTGRES_HOST", "localhost")
    db_port = os.getenv("POSTGRES_PORT", "5432")

    database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    return create_engine(database_url)


@dataclass
class TextSearchResult:
    document_id: uuid.UUID
    document_content_id: uuid.UUID
    document_name: str | None
    document_path: str
    document_chunk_id: uuid.UUID
    position: int | None
    chunk_content: str
    rank: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": str(self.document_id),
            "document_content_id": str(self.document_content_id),
            "document_name": self.document_name,
            "document_path": self.document_path,
            "document_chunk_id": str(self.document_chunk_id),
            "position": self.position,
            "chunk_content": self.chunk_content,
            "rank": float(self.rank),
        }


def _normalize_user_id(user_id: uuid.UUID | str) -> uuid.UUID:
    if isinstance(user_id, uuid.UUID):
        return user_id
    if not isinstance(user_id, str):
        raise TypeError("user_id는 uuid.UUID 또는 str이어야 합니다.")
    return uuid.UUID(user_id)


def query_text_search(
    user_id: uuid.UUID | str,
    query: str,
    top_k: int = 5,
    path_prefix: str | None = None,
) -> List[Dict[str, Any]]:
    """
    텍스트 매칭(full-text search) 기반으로 DocumentChunk를 검색한다.

    - user_id: 해당 사용자의 문서만 대상으로 검색
    - query: 자연어 질의
    - top_k: 상위 N개 결과
    """
    if not query or not isinstance(query, str):
        return []
    if top_k <= 0:
        return []

    normalized_user_id = _normalize_user_id(user_id)

    engine = _get_db_engine()
    SessionLocal = sessionmaker(bind=engine)

    # PostgreSQL full-text search (simple configuration) 사용
    stmt = text(
        """
        WITH q AS (
            SELECT plainto_tsquery('simple', :query) AS ts_query
        )
        SELECT
            d.document_id AS document_id,
            d.name AS document_name,
            d.path AS document_path,
            dc.document_content_id AS document_content_id,
            dc.document_chunk_id AS document_chunk_id,
            dc.position AS position,
            dc.chunk_content AS chunk_content,
            ts_rank(
                to_tsvector('simple', coalesce(dc.chunk_content, '')),
                q.ts_query
            ) AS rank
        FROM q,
            document_chunk AS dc
        JOIN document_content AS dct
            ON dc.document_content_id = dct.document_content_id
        JOIN document AS d
            ON dct.document_id = d.document_id
        WHERE
            d.user_id = :user_id
            AND d.deleted_at IS NULL
            AND dct.deleted_at IS NULL
            AND dc.deleted_at IS NULL
            AND q.ts_query @@ to_tsvector('simple', coalesce(dc.chunk_content, ''))
            AND (:path_prefix IS NULL OR d.path <@ CAST(:path_prefix AS ltree))
        ORDER BY rank DESC, dct.created_at DESC, dc.position NULLS FIRST
        LIMIT :limit
        """
    ).bindparams(
        bindparam("user_id", value=normalized_user_id),
        bindparam("query", value=query),
        bindparam("limit", value=top_k, type_=Integer),
        bindparam("path_prefix", value=path_prefix),
    )

    results: List[TextSearchResult] = []

    with SessionLocal() as session:
        rows = session.execute(stmt).mappings().all()

    for row in rows:
        results.append(
            TextSearchResult(
                document_id=row["document_id"],
                document_content_id=row["document_content_id"],
                document_name=row.get("document_name"),
                document_path=row["document_path"],
                document_chunk_id=row["document_chunk_id"],
                position=row.get("position"),
                chunk_content=row["chunk_content"],
                rank=_sanitize_float(row.get("rank")),
            )
        )

    return [r.to_dict() for r in results]


def _format_results_for_cli(results: Sequence[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for idx, r in enumerate(results, start=1):
        header = f"[{idx}] doc={r['document_id']} content={r['document_content_id']} pos={r['position']} rank={r['rank']:.4f}"
        lines.append(header)
        lines.append(r["chunk_content"])
        lines.append("-" * 80)
    return "\n".join(lines)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="텍스트(full-text) 기반 DocumentChunk 검색 도구")
    parser.add_argument("--user-id", required=True, help="UUID 형식의 사용자 ID")
    parser.add_argument("--query", required=True, help="검색 질의 문자열")
    parser.add_argument("--top-k", type=int, default=5, help="반환할 최대 청크 개수")
    parser.add_argument(
        "--path-prefix",
        help="ltree 기반 Document.path prefix (예: 'root.some_folder') 로 문서 범위 필터링",
        default=None,
    )

    args = parser.parse_args()

    user_uuid = _normalize_user_id(args.user_id)
    search_results = query_text_search(
        user_uuid,
        args.query,
        top_k=args.top_k,
        path_prefix=args.path_prefix,
    )

    if not search_results:
        print("검색 결과가 없습니다.")
    else:
        print(_format_results_for_cli(search_results))



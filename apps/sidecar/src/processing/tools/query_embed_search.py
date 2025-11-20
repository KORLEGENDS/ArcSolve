"""
임베딩 기반 DocumentChunk 검색 도구.

- 입력:
  - user_id (uuid.UUID 또는 str)
  - query (str)
- 출력:
  - 관련도가 높은 청크 목록(list[dict])

내부 규칙:
- 검색 대상은 DocumentChunk.chunk_content 기준
- 동일한 Snowflake Arctic Embed v2.0 + Matryoshka(256차원) 설정 사용
"""

from __future__ import annotations

import math
import os
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Sequence

import torch
import torch.nn.functional as F
from sqlalchemy import Integer, bindparam, create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from transformers import AutoModel, AutoTokenizer

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
# 사용하지 않더라도 스키마 의존성을 명시적으로 유지하기 위해 참조
_ = (Document, DocumentContent, DocumentChunk)

# Snowflake Arctic Embed Model 설정 (전처리 파이프라인과 동일하게 유지)
EMBED_MODEL_ID = "Snowflake/snowflake-arctic-embed-m-v2.0"
MATRYOSHKA_DIM = 256

_tokenizer: AutoTokenizer | None = None
_model: AutoModel | None = None
_device: str | None = None


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


def _load_embed_model(model_id: str = EMBED_MODEL_ID):
    """Arctic Embed 모델/토크나이저를 1회 로딩 후 캐시."""
    global _tokenizer, _model, _device

    if _tokenizer is not None and _model is not None and _device is not None:
        return _tokenizer, _model, _device

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    if torch.cuda.is_available():
        device = "cuda"

    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
    model = AutoModel.from_pretrained(
        model_id,
        trust_remote_code=True,
        add_pooling_layer=False,
        use_memory_efficient_attention=False,
        unpad_inputs=False,
        attn_implementation="eager",
    )
    model.to(device)
    model.eval()

    _tokenizer = tokenizer
    _model = model
    _device = device
    return tokenizer, model, device


def embed_query_to_vector(
    query: str,
    model_id: str = EMBED_MODEL_ID,
    dim: int = MATRYOSHKA_DIM,
) -> List[float]:
    """
    단일 질의 문자열을 Arctic Embed v2.0으로 임베딩해 256차원 정규화 벡터로 반환.
    """
    if not query or not isinstance(query, str):
        raise ValueError("query는 비어 있지 않은 문자열이어야 합니다.")

    tokenizer, model, device = _load_embed_model(model_id)

    with torch.no_grad():
        inputs = tokenizer(
            [query],
            padding=True,
            truncation=True,
            return_tensors="pt",
            max_length=8192,
        ).to(device)

        outputs = model(**inputs)
        full_embeddings = outputs.last_hidden_state[:, 0]  # CLS 토큰
        compressed_embeddings = full_embeddings[:, :dim]
        compressed_embeddings = F.normalize(compressed_embeddings, p=2, dim=1)

    vec: List[float] = compressed_embeddings[0].tolist()
    return vec


@dataclass
class ChunkSearchResult:
    document_id: uuid.UUID
    document_content_id: uuid.UUID
    document_name: str | None
    document_path: str
    document_chunk_id: uuid.UUID
    position: int | None
    chunk_content: str
    similarity: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": str(self.document_id),
            "document_content_id": str(self.document_content_id),
            "document_name": self.document_name,
            "document_path": self.document_path,
            "document_chunk_id": str(self.document_chunk_id),
            "position": self.position,
            "chunk_content": self.chunk_content,
            "similarity": float(self.similarity),
        }


def _normalize_user_id(user_id: uuid.UUID | str) -> uuid.UUID:
    if isinstance(user_id, uuid.UUID):
        return user_id
    if not isinstance(user_id, str):
        raise TypeError("user_id는 uuid.UUID 또는 str이어야 합니다.")
    return uuid.UUID(user_id)


def query_embed_search(
    user_id: uuid.UUID | str,
    query: str,
    top_k: int = 5,
    path_prefix: str | None = None,
) -> List[Dict[str, Any]]:
    """
    임베딩 기반으로 DocumentChunk를 검색한다.

    - user_id: 해당 사용자의 문서만 대상으로 검색
    - query: 자연어 질의
    - top_k: 상위 N개 결과
    """
    if not query or not isinstance(query, str):
        return []
    if top_k <= 0:
        return []

    normalized_user_id = _normalize_user_id(user_id)
    query_vec = embed_query_to_vector(query)

    engine = _get_db_engine()
    SessionLocal = sessionmaker(bind=engine)

    # pgvector cosine 거리 연산자를 직접 사용 (<=>)
    stmt = text(
        """
        SELECT
            d.document_id AS document_id,
            d.name AS document_name,
            d.path AS document_path,
            dc.document_content_id AS document_content_id,
            dc.document_chunk_id AS document_chunk_id,
            dc.position AS position,
            dc.chunk_content AS chunk_content,
            (1 - (dc.chunk_embedding <=> CAST(:query_embedding AS vector))) AS similarity
        FROM document_chunk AS dc
        JOIN document_content AS dct
            ON dc.document_content_id = dct.document_content_id
        JOIN document AS d
            ON dct.document_id = d.document_id
        WHERE
            d.user_id = :user_id
            AND d.deleted_at IS NULL
            AND dct.deleted_at IS NULL
            AND dc.deleted_at IS NULL
            AND (:path_prefix IS NULL OR d.path <@ CAST(:path_prefix AS ltree))
        ORDER BY dc.chunk_embedding <=> CAST(:query_embedding AS vector)
        LIMIT :limit
        """
    )

    results: List[ChunkSearchResult] = []

    with SessionLocal() as session:
        rows = (
            session.execute(
                stmt,
                {
                    "user_id": normalized_user_id,
                    "query_embedding": query_vec,
                    "limit": top_k,
                    "path_prefix": path_prefix,
                },
            )
            .mappings()
            .all()
        )

    for row in rows:
        results.append(
            ChunkSearchResult(
                document_id=row["document_id"],
                document_content_id=row["document_content_id"],
                document_name=row.get("document_name"),
                document_path=row["document_path"],
                document_chunk_id=row["document_chunk_id"],
                position=row.get("position"),
                chunk_content=row["chunk_content"],
                similarity=_sanitize_float(row.get("similarity")),
            )
        )

    return [r.to_dict() for r in results]


def _format_results_for_cli(results: Sequence[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for idx, r in enumerate(results, start=1):
        header = f"[{idx}] doc={r['document_id']} content={r['document_content_id']} pos={r['position']} score={r['similarity']:.4f}"
        lines.append(header)
        lines.append(r["chunk_content"])
        lines.append("-" * 80)
    return "\n".join(lines)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="임베딩 기반 DocumentChunk 검색 도구")
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
    search_results = query_embed_search(
        user_uuid,
        args.query,
        top_k=args.top_k,
        path_prefix=args.path_prefix,
    )

    if not search_results:
        print("검색 결과가 없습니다.")
    else:
        print(_format_results_for_cli(search_results))



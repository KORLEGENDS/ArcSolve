"""
0단계: 전체 파이프라인 오케스트레이션 모듈.

역할:
- 1_parse / 2_chunk / 3_embed / 4_pg_save 모듈을 순서대로 호출하여
  단일 파일(1차: PDF + 이미지)을 파싱 → 청킹 → 임베딩 → PostgreSQL 저장까지 수행한다.

주요 함수:
- run_pipeline_for_file(file_path: str, user_id: uuid.UUID, document_id: uuid.UUID) -> dict
"""

from __future__ import annotations

import importlib
import uuid
from typing import Any, Dict


def run_pipeline_for_file(
    file_path: str,
    user_id: uuid.UUID,
    document_id: uuid.UUID,
) -> Dict[str, Any]:
    """
    단일 파일에 대해 전체 파이프라인을 실행한다.

    1차 버전에서는 PDF + 이미지(OCR)를 지원하며,
    1_parse.parse_document_step 가 파일 타입에 따라 적절한 Converter를 선택한다.

    순서:
    1) 1_parse.parse_document_step
    2) 2_chunk.chunk_markdown_step
    3) 3_embed.embed_chunks_step
    4) 4_pg_save.save_to_pg_step
    """
    # 동적 모듈 로딩 (파일명이 숫자로 시작하므로 importlib 사용)
    parse_mod = importlib.import_module("src.preprocessing.1_parse")
    chunk_mod = importlib.import_module("src.preprocessing.2_chunk")
    embed_mod = importlib.import_module("src.preprocessing.3_embed")
    save_mod = importlib.import_module("src.preprocessing.4_pg_save")

    # 1) 파싱
    parsed = parse_mod.parse_document_step(file_path)

    # 2) 청킹
    chunks = chunk_mod.chunk_markdown_step(parsed["markdown"], chunk_size=300, chunk_overlap=0)

    # 3) 임베딩
    embeddings = embed_mod.embed_chunks_step(chunks)

    # 4) 저장
    result = save_mod.save_to_pg_step(parsed, chunks, embeddings, user_id, document_id)

    # 파이프라인 메타 정보 포함
    out: Dict[str, Any] = {
        "pdf_path": parsed["pdf_path"],
        "file_name": parsed["file_name"],
        "mime_type": parsed.get("mime_type"),
        "document_id": result.get("document_id"),
        "content_id": result.get("content_id"),
        "chunk_count": result.get("chunk_count"),
    }
    return out


"""
4단계: PostgreSQL 저장 단계 모듈.

역할:
- Document / DocumentContent / DocumentChunk 테이블에 파이프라인 결과를 저장한다.

단일 함수:
- save_to_pg_step(parsed, chunks, embeddings, user_id) -> dict

입력:
- parsed: 1_parse.parse_pdf_step의 반환 dict
- chunks: 2_chunk.chunk_markdown_step의 반환 list[str]
- embeddings: 3_embed.embed_chunks_step의 반환 list[list[float]]
- user_id: uuid.UUID

출력(dict):
{
  "document_id": uuid.UUID,
  "content_id": uuid.UUID,
  "chunk_count": int,
}
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List

from sqlalchemy import func

from src.schema.db import get_session
from src.schema.document_schema import Document, DocumentContent, DocumentChunk

logger = logging.getLogger(__name__)


def save_to_pg_step(
    parsed: Dict[str, Any],
    chunks: List[str],
    embeddings: List[List[float]],
    user_id: uuid.UUID,
    document_id: uuid.UUID,
) -> Dict[str, Any]:
    """
    파싱/청킹/임베딩 결과를 PostgreSQL에 저장한다.

    - Document: 파일 메타데이터
    - DocumentContent: 마크다운/레이아웃/메트릭(JSONB)
    - DocumentChunk: 청킹 텍스트 + 임베딩
    """
    if len(chunks) != len(embeddings):
        raise ValueError(
            f"chunks({len(chunks)})와 embeddings({len(embeddings)}) 길이가 다릅니다",
        )

    session = get_session()

    try:
        logger.info(
            f"[save_to_pg] 시작: document_id={document_id}, user_id={user_id}, "
            f"chunks={len(chunks)}, embeddings={len(embeddings)}"
        )

        # 1) 기존 Document 조회 및 검증
        doc = (
            session.query(Document)
            .filter(
                Document.document_id == document_id,
                Document.user_id == user_id,
            )
            .first()
        )
        if doc is None:
            raise ValueError(
                f"Document를 찾을 수 없습니다: document_id={document_id}, user_id={user_id}",
            )

        logger.info(f"[save_to_pg] Document 조회 성공: document_id={doc.document_id}")

        # 2) DocumentContent 생성 (contents JSONB에 markdown/layout/metrics 저장)
        content_json = {
            "schema_version": 1,
            "markdown": parsed.get("markdown") or "",
            "layout": parsed.get("layout") or {},
            "metrics": parsed.get("metrics") or {},
        }

        latest_version = (
            session.query(func.max(DocumentContent.version))
            .filter(DocumentContent.document_id == doc.document_id)
            .scalar()
            or 0
        )

        logger.info(f"[save_to_pg] 최신 버전: {latest_version}, 새 버전: {latest_version + 1}")

        new_content = DocumentContent(
            document_content_id=uuid.uuid4(),
            document_id=doc.document_id,
            user_id=user_id,
            version=latest_version + 1,
            contents=content_json,
        )
        session.add(new_content)
        session.flush()

        logger.info(
            f"[save_to_pg] DocumentContent 생성: content_id={new_content.document_content_id}"
        )

        # latest_content_id 갱신
        doc.latest_content_id = new_content.document_content_id

        # 3) DocumentChunk 생성
        chunk_count = 0
        for idx, (chunk_text, embed_vec) in enumerate(zip(chunks, embeddings)):
            new_chunk = DocumentChunk(
                document_chunk_id=uuid.uuid4(),
                document_content_id=new_content.document_content_id,
                position=idx,
                chunk_content=chunk_text,
                chunk_embedding=embed_vec,
            )
            session.add(new_chunk)
            chunk_count += 1

        logger.info(f"[save_to_pg] DocumentChunk {chunk_count}개 추가 완료, 커밋 시작")

        session.commit()

        logger.info(
            f"[save_to_pg] 커밋 완료: document_id={doc.document_id}, "
            f"content_id={new_content.document_content_id}, chunk_count={chunk_count}"
        )

        return {
            "document_id": doc.document_id,
            "content_id": new_content.document_content_id,
            "chunk_count": len(chunks),
        }

    except Exception as exc:
        logger.error(
            f"[save_to_pg] 저장 실패: document_id={document_id}, error={exc}",
            exc_info=True,
        )
        session.rollback()
        raise
    finally:
        session.close()



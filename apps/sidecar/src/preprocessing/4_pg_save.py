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

import os
import uuid
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from document_schema import (
    Base,
    Document,
    DocumentContent,
    DocumentChunk,
    DocumentKind,
    DocumentUploadStatus,
    DocumentProcessingStatus,
)


def save_to_pg_step(
    parsed: Dict[str, Any],
    chunks: List[str],
    embeddings: List[List[float]],
    user_id: uuid.UUID,
) -> Dict[str, Any]:
    """
    파싱/청킹/임베딩 결과를 PostgreSQL에 저장한다.

    - Document: 파일 메타데이터
    - DocumentContent: 마크다운/레이아웃/메트릭(JSONB)
    - DocumentChunk: 청킹 텍스트 + 임베딩
    """
    if len(chunks) != len(embeddings):
        raise ValueError(f"chunks({len(chunks)})와 embeddings({len(embeddings)}) 길이가 다릅니다")

    # DB 접속 설정 (환경변수 또는 기본값)
    db_user = os.getenv("POSTGRES_USER", "postgres")
    db_password = os.getenv("POSTGRES_PASSWORD", "postgres")
    db_name = os.getenv("POSTGRES_DB", "postgres")
    db_host = os.getenv("POSTGRES_HOST", "localhost")
    db_port = os.getenv("POSTGRES_PORT", "5432")

    database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    engine = create_engine(database_url)

    # 확장 및 테이블 초기화
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS ltree"))
        conn.commit()
    Base.metadata.create_all(engine)

    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        pdf_path = Path(parsed.get("pdf_path") or parsed.get("file_name", ""))
        mime_type = parsed.get("mime_type") or "application/pdf"

        # Document 생성
        safe_name = (pdf_path.stem if pdf_path.stem else parsed.get("file_name", "document")).replace("-", "_").replace(
            " ", "_"
        )
        doc_path = f"root.{safe_name}_{uuid.uuid4().hex[:8]}"

        new_doc = Document(
            document_id=uuid.uuid4(),
            user_id=user_id,
            name=parsed.get("file_name"),
            path=doc_path,
            kind=DocumentKind.DOCUMENT,
            mime_type=mime_type,
            file_size=int(parsed.get("file_size") or 0),
            storage_key=f"local_pipeline/{parsed.get('file_name')}",
            upload_status=DocumentUploadStatus.UPLOADED,
            processing_status=DocumentProcessingStatus.PROCESSED,
        )
        session.add(new_doc)
        session.flush()

        # DocumentContent 생성 (contents JSONB에 markdown/layout/metrics 저장)
        content_json = {
            "schema_version": 1,
            "markdown": parsed.get("markdown") or "",
            "layout": parsed.get("layout") or {},
            "metrics": parsed.get("metrics") or {},
        }

        new_content = DocumentContent(
            document_content_id=uuid.uuid4(),
            document_id=new_doc.document_id,
            user_id=user_id,
            version=1,
            contents=content_json,
        )
        session.add(new_content)
        session.flush()

        new_doc.latest_content_id = new_content.document_content_id

        # DocumentChunk 생성
        for idx, (chunk_text, embed_vec) in enumerate(zip(chunks, embeddings)):
            new_chunk = DocumentChunk(
                document_chunk_id=uuid.uuid4(),
                document_content_id=new_content.document_content_id,
                position=idx,
                chunk_content=chunk_text,
                chunk_embedding=embed_vec,
            )
            session.add(new_chunk)

        session.commit()

        return {
            "document_id": new_doc.document_id,
            "content_id": new_content.document_content_id,
            "chunk_count": len(chunks),
        }

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()



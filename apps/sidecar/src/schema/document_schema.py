"""
Document schema for PostgreSQL using SQLAlchemy ORM.

This module defines the database schema for documents, document contents,
document relations, and document chunks with vector embeddings.
"""

import uuid
from datetime import datetime
from typing import Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, ForeignKey, Index, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID, ENUM as PGEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator


# Base class for all models
class Base(DeclarativeBase):
    pass


# Custom ltree type for hierarchical document paths
class Ltree(TypeDecorator):
    """PostgreSQL ltree type for hierarchical paths."""

    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            # Use ltree type directly in PostgreSQL
            return dialect.type_descriptor(Text())
        else:
            return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is not None:
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return str(value)
        return value

    def get_col_spec(self, **kw):
        """Return the column type for PostgreSQL."""
        return "ltree"


# PostgreSQL enum 타입 정의 (Drizzle 스키마와 1:1 매핑)
document_kind_enum = PGEnum(
    "folder",
    "document",
    name="document_kind",
    create_type=False,
)

document_relation_type_enum = PGEnum(
    "reference",
    "summary",
    "translation",
    "duplicate",
    name="document_relation_type",
    create_type=False,
)

document_upload_status_enum = PGEnum(
    "pending",
    "uploading",
    "uploaded",
    "upload_failed",
    name="document_upload_status",
    create_type=False,
)

document_processing_status_enum = PGEnum(
    "pending",
    "processing",
    "processed",
    "failed",
    name="document_processing_status",
    create_type=False,
)


# Table definitions
class Document(Base):
    """Document table for storing document metadata."""

    __tablename__ = "document"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )

    # owner (tenant 기준)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    """
    표시용 문서 이름
    - path는 ltree용 slug 경로이므로, 실제 UI에서는 항상 name을 사용합니다.
    - name은 UTF-8 전체 범위를 허용하며, 한글/이모지 등도 그대로 저장합니다.
    """
    name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # hierarchical path within the user's namespace
    path: Mapped[str] = mapped_column(Ltree, nullable=False)

    # Drizzle: documentKindEnum('document_kind', ['folder', 'document'])
    kind: Mapped[str] = mapped_column(
        document_kind_enum,
        nullable=False,
    )

    """
    MIME 타입
    - file 문서: 실제 파일 MIME (예: 'application/pdf', 'video/youtube')
    - note 문서: 노트 타입 구분 (예: 'application/vnd.arc.note+plate', 'application/vnd.arc.note+draw')
    - folder 문서: null
    """
    mime_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    """
    파일 크기 (bytes)
    - file 문서: 실제 파일 크기
    - note/folder 문서: null
    """
    file_size: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True,
    )

    """
    스토리지 키 또는 외부 URL
    - file 문서: R2 스토리지 키 또는 외부 URL (예: YouTube URL)
    - note/folder 문서: null
    """
    storage_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 업로드 상태 (note/folder 등 비파일 문서는 기본적으로 'uploaded' 상태로 간주)
    # Drizzle: documentUploadStatusEnum('document_upload_status', [...])
    upload_status: Mapped[str] = mapped_column(
        document_upload_status_enum,
        nullable=False,
    )

    """
    전처리(파싱/임베딩 등) 상태
    - 파일 업로드 이후, 백엔드 전처리 파이프라인의 진행 상태를 나타냅니다.
    - note/folder 등 비파일 문서는 생성 시점에 'processed' 로 간주할 수 있습니다.
    """
    # Drizzle: documentProcessingStatusEnum('document_processing_status', [...])
    processing_status: Mapped[str] = mapped_column(
        document_processing_status_enum,
        nullable=False,
    )

    # points to the latest content version (nullable for empty documents)
    latest_content_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    # Relationships
    contents: Mapped[list["DocumentContent"]] = relationship(
        "DocumentContent",
        back_populates="document",
    )
    latest_content: Mapped[Optional["DocumentContent"]] = relationship(
        "DocumentContent",
        foreign_keys=[latest_content_id],
        primaryjoin="Document.latest_content_id == DocumentContent.document_content_id",
        post_update=True,
    )
    base_relations: Mapped[list["DocumentRelation"]] = relationship(
        "DocumentRelation",
        back_populates="base_document",
        foreign_keys="[DocumentRelation.base_document_id]",
    )
    related_relations: Mapped[list["DocumentRelation"]] = relationship(
        "DocumentRelation",
        back_populates="related_document",
        foreign_keys="[DocumentRelation.related_document_id]",
    )

    __table_args__ = (
        # per-user unique path for non-deleted documents (partial unique index)
        Index(
            "document_user_id_path_deleted_null_idx",
            "user_id",
            "path",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        # subtree queries on path (ltree) - created manually via DDL
        # Note: GIST index for ltree must be created with explicit operator class
        # CREATE INDEX document_path_gist_idx ON document USING gist (path gist_ltree_ops);
    )


class DocumentContent(Base):
    """Document content table for storing document versions."""

    __tablename__ = "document_content"

    document_content_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document.document_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # author of this specific version (may differ from owner)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    # arbitrary structured contents (text, parsed pdf, transcription, etc.)
    contents: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # monotonically increasing version per document (1, 2, 3, ...)
    version: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    # Relationships
    document: Mapped["Document"] = relationship(
        "Document",
        back_populates="contents",
    )
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        "DocumentChunk",
        back_populates="document_content",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        # unique version per document for non-deleted rows (partial unique index)
        Index(
            "document_content_document_id_version_deleted_null_idx",
            "document_id",
            "version",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class DocumentRelation(Base):
    """Document relation table for storing relationships between documents."""

    __tablename__ = "document_relation"

    document_relation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )

    base_document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document.document_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    related_document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document.document_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Drizzle: documentRelationTypeEnum('document_relation_type', [...])
    relation_type: Mapped[str] = mapped_column(
        document_relation_type_enum,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    # Relationships
    base_document: Mapped["Document"] = relationship(
        "Document",
        back_populates="base_relations",
        foreign_keys="[DocumentRelation.base_document_id]",
    )
    related_document: Mapped["Document"] = relationship(
        "Document",
        back_populates="related_relations",
        foreign_keys="[DocumentRelation.related_document_id]",
    )

    __table_args__ = (
        # unique edge per type for non-deleted relations (partial unique index)
        Index(
            "document_relation_base_related_type_deleted_null_idx",
            "base_document_id",
            "related_document_id",
            "relation_type",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class DocumentChunk(Base):
    """Document chunk table for storing document chunks with vector embeddings."""

    __tablename__ = "document_chunk"

    document_chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )

    document_content_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_content.document_content_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # optional position of the chunk within the original content
    position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    chunk_content: Mapped[str] = mapped_column(Text, nullable=False)

    # pgvector column for semantic search (configure dimensions as needed)
    chunk_embedding: Mapped[list[float]] = mapped_column(
        Vector(256),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    # Relationships
    document_content: Mapped["DocumentContent"] = relationship(
        "DocumentContent",
        back_populates="chunks",
    )

    __table_args__ = (
        # vector similarity index; requires pgvector extension
        Index(
            "document_chunk_embedding_ivfflat_idx",
            "chunk_embedding",
            postgresql_using="ivfflat",
            postgresql_ops={"chunk_embedding": "vector_cosine_ops"},
            postgresql_with={"lists": 100},
        ),
    )


# Type aliases for convenience (similar to Drizzle's $inferSelect and $inferInsert)
# These are not used by SQLAlchemy but can be useful for type hints in application code
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # Select types (what you get when querying)
    DocumentSelect = Document
    DocumentContentSelect = DocumentContent
    DocumentRelationSelect = DocumentRelation
    DocumentChunkSelect = DocumentChunk

    # Insert types (what you pass when creating)
    DocumentInsert = dict
    DocumentContentInsert = dict
    DocumentRelationInsert = dict
    DocumentChunkInsert = dict


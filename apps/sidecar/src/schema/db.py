"""
공용 SQLAlchemy 세션 헬퍼.

- DATABASE_URL 이 설정되어 있으면 우선 사용
- 없으면 POSTGRES_* 환경변수 기반으로 PostgreSQL URL을 생성
- 스키마 생성이나 확장 설치는 담당하지 않으며, 마이그레이션이 선행되었다는 가정을 사용
"""

from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def _build_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        # Ensure postgresql:// scheme (not postgres://) for SQLAlchemy 2.0
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        return database_url

    db_user = os.getenv("POSTGRES_USER", "postgres")
    db_password = os.getenv("POSTGRES_PASSWORD", "postgres")
    db_name = os.getenv("POSTGRES_DB", "postgres")
    db_host = os.getenv("POSTGRES_HOST", "localhost")
    db_port = os.getenv("POSTGRES_PORT", "5432")

    return f"postgresql+psycopg2://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


DATABASE_URL = _build_database_url()

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def get_session():
    """새 SQLAlchemy 세션을 반환합니다."""
    return SessionLocal()




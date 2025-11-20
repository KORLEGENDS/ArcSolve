"""
사용자별 Document 트리 구조를 나열하는 도구.

- 입력:
  - user_id (uuid.UUID 또는 str)
  - root_path (ltree 문자열, 예: 'root' 또는 'root.folder')
  - max_depth (root_path 기준으로 얼마나 깊이까지 내려갈지)
- 출력:
  - 평탄한 document 리스트 (CLI에서는 들여쓰기 형태 트리로 출력)
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Sequence

from sqlalchemy import Integer, create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker


def _get_db_engine() -> Engine:
    """환경변수 기반 PostgreSQL 엔진 생성."""
    db_user = os.getenv("POSTGRES_USER", "postgres")
    db_password = os.getenv("POSTGRES_PASSWORD", "postgres")
    db_name = os.getenv("POSTGRES_DB", "postgres")
    db_host = os.getenv("POSTGRES_HOST", "localhost")
    db_port = os.getenv("POSTGRES_PORT", "5432")

    database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    return create_engine(database_url)


def _normalize_user_id(user_id: uuid.UUID | str) -> uuid.UUID:
    if isinstance(user_id, uuid.UUID):
        return user_id
    if not isinstance(user_id, str):
        raise TypeError("user_id는 uuid.UUID 또는 str이어야 합니다.")
    return uuid.UUID(user_id)


@dataclass
class DocumentTreeItem:
    document_id: uuid.UUID
    name: str | None
    path: str
    kind: str
    level: int
    relative_path: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": str(self.document_id),
            "name": self.name,
            "path": self.path,
            "kind": self.kind,
            "level": int(self.level),
            "relative_path": self.relative_path,
        }


def query_tree_list(
    user_id: uuid.UUID | str,
    root_path: str = "root",
    max_depth: int = 2,
) -> List[Dict[str, Any]]:
    """
    특정 사용자/루트 경로 기준으로 Document 트리를 평탄 리스트로 조회한다.

    - root_path: 포함하고 싶은 트리의 루트(l tree prefix). 기본값 'root'.
    - max_depth: root_path 기준으로 내려갈 최대 깊이 (0이면 바로 하위만).
    """
    if not isinstance(max_depth, int) or max_depth < 0:
        raise ValueError("max_depth는 0 이상의 정수여야 합니다.")

    normalized_user_id = _normalize_user_id(user_id)
    root_path = root_path or "root"

    engine = _get_db_engine()
    SessionLocal = sessionmaker(bind=engine)

    stmt = text(
        """
        WITH root AS (
            SELECT CAST(:root_path AS ltree) AS root_path
        )
        SELECT
            d.document_id AS document_id,
            d.name AS name,
            d.path::text AS path,
            d.kind::text AS kind,
            nlevel(d.path) AS level,
            subpath(d.path, nlevel(root.root_path))::text AS relative_path
        FROM document AS d, root
        WHERE
            d.user_id = :user_id
            AND d.deleted_at IS NULL
            AND d.path <@ root.root_path
            AND nlevel(d.path) <= nlevel(root.root_path) + :max_depth
        ORDER BY d.path
        """
    )

    results: List[DocumentTreeItem] = []

    with SessionLocal() as session:
        rows = (
            session.execute(
                stmt,
                {
                    "user_id": normalized_user_id,
                    "root_path": root_path,
                    "max_depth": max_depth,
                },
            )
            .mappings()
            .all()
        )

    for row in rows:
        results.append(
            DocumentTreeItem(
                document_id=row["document_id"],
                name=row.get("name"),
                path=row["path"],
                kind=row["kind"],
                level=row["level"],
                relative_path=row["relative_path"],
            )
        )

    return [r.to_dict() for r in results]


def _format_tree_for_cli(items: Sequence[Dict[str, Any]]) -> str:
    if not items:
        return "문서가 없습니다."

    lines: List[str] = []
    for item in items:
        rel = item.get("relative_path") or ""
        if not rel:
            depth_offset = 0
        else:
            depth_offset = rel.count(".") + 1

        indent = "  " * depth_offset
        name = item.get("name") or "<unnamed>"
        kind = item.get("kind") or "unknown"
        lines.append(f"{indent}- [{kind}] {name} ({item.get('path')})")
    return "\n".join(lines)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="사용자 Document 트리 나열 도구")
    parser.add_argument("--user-id", required=True, help="UUID 형식의 사용자 ID")
    parser.add_argument(
        "--root-path",
        default="root",
        help="ltree 기반 Document.path prefix (예: 'root', 'root.folder')",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        default=2,
        help="root-path 기준으로 내려갈 최대 깊이 (0이면 바로 하위만)",
    )

    args = parser.parse_args()

    user_uuid = _normalize_user_id(args.user_id)
    docs = query_tree_list(
        user_uuid,
        root_path=args.root_path,
        max_depth=args.max_depth,
    )

    print(_format_tree_for_cli(docs))


"""
검색 매니저 (의사 코드)
- 목적: 검색 라우트들이 공통으로 사용하는 실행기/유틸/어댑터 집약
- 주의: 실제 쿼리 로직은 추후 구현. 인터페이스/시그니처와 동작 설명만 제공

역할 범주
 1) 스코프/메타: 파일 범위 조회, 메타/경로 매핑
 2) 텍스트 처리: 스니펫, 라인/오프셋, 점수 정규화, 커서 페이징
 3) Lexical 실행기: FTS/TRGM/Regex
 4) 시맨틱: 쿼리 임베딩, KNN, 리랭크, 하이브리드
 5) 인덱스/가드: PG/RediSearch 인덱스 보장, 타임아웃/상한
 6) 어댑터: 그래프/VCS/심볼/문서 (인터페이스만)
"""

from __future__ import annotations

import json
from typing import (Any, Awaitable, Callable, Dict, Iterable, List, Literal,
                    Optional, Tuple)

import numpy as np

from src.config.resources import resource_config
from src.config.services import service_config


class SearchManager:
    def __init__(self, database_provider: Optional[object] = None, embedding_accessor: Optional[Callable[[], Awaitable[Any]]] = None) -> None:
        self.config = service_config.search if hasattr(service_config, "search") else None
        self._database_provider = database_provider
        self._embedding_accessor = embedding_accessor

    def set_database_provider(self, database_provider: object) -> None:
        self._database_provider = database_provider

    def set_embedding_accessor(self, embedding_accessor: Callable[[], Awaitable[Any]]) -> None:
        self._embedding_accessor = embedding_accessor

    async def _get_em(self):
        if self._embedding_accessor is None:
            raise RuntimeError("SearchManager: embedding accessor가 설정되지 않았습니다")
        return await self._embedding_accessor()

    # ====== 스코프/메타 ======
    async def list_file_ids_by_path_prefix(
        self,
        user_id: str,
        path_prefix: Optional[str],
        *,
        limit: int = 500,
    ) -> List[str]:
        """path_prefix로 파일 id를 조회 (삭제 제외). 실제 SQL은 추후 구현.
        반환: file_id 목록 (상한 적용)
        """
        if self._database_provider is None:
            raise RuntimeError("SearchManager: database_provider가 설정되지 않았습니다")
        pg = await self._database_provider.get_postgresql(resource_config.postgresql)
        if path_prefix:
            rows = await pg.fetch(
                """
                SELECT id
                FROM files
                WHERE user_id = %s AND deleted_at IS NULL AND path LIKE %s
                LIMIT %s
                """,
                user_id,
                f"{path_prefix}%",
                limit,
            )
        else:
            rows = await pg.fetch(
                """
                SELECT id
                FROM files
                WHERE user_id = %s AND deleted_at IS NULL
                LIMIT %s
                """,
                user_id,
                limit,
            )
        return [r["id"] for r in rows]

    async def get_file_meta(self, user_id: str, file_id: str) -> Dict[str, Any]:
        """파일 메타데이터 조회 (path 등)."""
        if self._database_provider is None:
            raise RuntimeError("SearchManager: database_provider가 설정되지 않았습니다")
        pg = await self._database_provider.get_postgresql(resource_config.postgresql)
        row = await pg.fetchrow(
            """
            SELECT id, path, name, item_type, file_size, updated_at
            FROM files
            WHERE id = %s AND user_id = %s AND deleted_at IS NULL
            """,
            file_id,
            user_id,
        )
        return row or {}

    async def map_doc_ids_to_paths(self, user_id: str, file_ids: Iterable[str]) -> Dict[str, str]:
        """여러 file_id를 path로 매핑."""
        ids = list(file_ids)
        if not ids:
            return {}
        if self._database_provider is None:
            raise RuntimeError("SearchManager: database_provider가 설정되지 않았습니다")
        pg = await self._database_provider.get_postgresql(resource_config.postgresql)
        rows = await pg.fetch(
            """
            SELECT id, path
            FROM files
            WHERE user_id = %s AND deleted_at IS NULL AND id = ANY(%s::uuid[])
            """,
            user_id,
            ids,
        )
        return {r["id"]: r["path"] for r in rows}

    async def build_tree_nodes(
        self,
        user_id: str,
        path_prefix: str,
        *,
        depth: int = 2,
        include_files: bool = True,
        limit: int = 10000,
    ) -> Dict[str, Any]:
        """path_prefix 하위 파일/디렉터리를 트리 노드로 반환 (MVP).

        - 디렉터리는 children을 비워둔 노드로만 표기
        - 파일에는 최소 메타(fileId/size/updatedAt) 포함
        """
        # 입력 가드
        if not path_prefix or not path_prefix.startswith("/"):
            path_prefix = "/" + (path_prefix or "")
        depth = max(1, min(5, int(depth)))
        limit = max(1, min(5000, int(limit)))

        if self._database_provider is None:
            raise RuntimeError("SearchManager: database_provider가 설정되지 않았습니다")
        pg = await self._database_provider.get_postgresql(resource_config.postgresql)
        rows = await pg.fetch(
            """
            SELECT id, path, file_size, updated_at
            FROM files
            WHERE user_id = %s AND deleted_at IS NULL AND path LIKE %s
            LIMIT %s
            """,
            user_id,
            f"{path_prefix}%",
            limit,
        )

        seen_dirs = set()
        file_nodes: List[Dict[str, Any]] = []
        for r in rows:
            p = r["path"]
            rel = p[len(path_prefix):] if p.startswith(path_prefix) else p
            rel = rel.lstrip("/")
            parts = [s for s in rel.split("/") if s]
            if not parts:
                continue
            # 디렉터리 수집 (depth 제한)
            for i in range(min(depth, max(0, len(parts) - 1))):
                dir_path = (path_prefix.rstrip("/") + "/" + "/".join(parts[: i + 1])).rstrip("/")
                seen_dirs.add(dir_path)
            # 파일 포함 (depth 이내)
            if include_files and len(parts) <= depth:
                updated_at = r.get("updated_at") if isinstance(r, dict) else r["updated_at"]
                file_nodes.append(
                    {
                        "type": "file",
                        "name": parts[-1],
                        "path": p,
                        "fileId": str(r["id"]),
                        "size": r.get("file_size") if isinstance(r, dict) else r["file_size"],
                        "updatedAt": (updated_at.isoformat() if hasattr(updated_at, "isoformat") and updated_at else None),
                    }
                )

        dir_nodes = [
            {"type": "dir", "name": dp.split("/")[-1], "path": dp, "children": []}
            for dp in sorted(seen_dirs)
        ]
        return {"nodes": dir_nodes + file_nodes}

    # ====== 파일 단위 청킹/시맨틱 질의 ======
    async def query_file_chunks(
        self,
        user_id: str,
        file_id: str,
        query: str,
        *,
        top_k: int = 8,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """임시 사용 중단: 파일 단위 청킹/시맨틱 질의는 MVP에서 보류되었습니다.

        이 메서드는 인터페이스를 유지하지만, 실제 시맨틱 워크플로우는 MVP에서 사용되지 않습니다.
        """
        # 파일에서 markdown 콘텐츠 로드
        if self._database_provider is None:
            raise RuntimeError("SearchManager: database_provider가 설정되지 않았습니다")
        pg = await self._database_provider.get_postgresql(resource_config.postgresql)
        row = await pg.fetchrow(
            """
            SELECT content
            FROM files
            WHERE id = %s AND user_id = %s AND deleted_at IS NULL
            """,
            file_id,
            user_id,
        )
        if not row:
            return []
        content = row.get("content") if isinstance(row, dict) else row["content"]
        # files.content는 TEXT 스칼라 문자열로 저장됩니다. 그대로 마크다운으로 사용.
        markdown = content if isinstance(content, str) else ""

        if not markdown:
            return []
        # 마크다운을 직접 청킹
        em = await self._get_em()
        chunks = em.chunk_text(markdown, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        if not chunks:
            return []

        doc_vecs = await em.encode_texts_cached(chunks, usage="doc")
        query_vec = await em.encode_texts_cached([query], usage="query")
        if getattr(query_vec, "ndim", 1) == 2:
            query_vec = query_vec[0]
        try:
            import numpy as _np
        except Exception:
            pass
        sims = np.dot(doc_vecs, query_vec.astype(np.float32)) if getattr(doc_vecs, "size", 0) else np.zeros((0,), dtype=np.float32)

        k = max(1, int(top_k))
        top_idx = np.argsort(-sims)[:k]
        results: List[Dict[str, Any]] = []
        for i in top_idx.tolist():
            score = float(sims[i]) if i < sims.shape[0] else 0.0
            results.append({"index": int(i), "text": chunks[i], "score": score})
        return results
# 전역 인스턴스 제거: ServiceProvider를 통해서만 접근합니다.
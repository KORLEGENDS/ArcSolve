"""
하위 노드 조회 툴 라우터

엔드포인트 (상위 라우터에서 prefix=/api/v1/tools 부여)
- POST /find/files_children
- POST /find/notes_children
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, Request

from src.resources.resource_provider import resource_provider
from src.config.resources import resource_config


router = APIRouter()


def _normalize_prefix(path_prefix: Optional[str]) -> str:
    p = path_prefix or "/"
    if not p.startswith("/"):
        p = "/" + p
    # 루트 허용, 그 외는 후속 쿼리에서 접미사 '/%'
    return p.rstrip("/") or "/"


def _clamp(n: Optional[int], default_val: int, min_val: int, max_val: int) -> int:
    try:
        x = int(n) if n is not None else int(default_val)
    except Exception:
        x = int(default_val)
    if x < min_val:
        x = min_val
    if x > max_val:
        x = max_val
    return x


async def _fetch_children(
    *,
    table: str,
    user_id: str,
    path_prefix: str,
    limit: int,
    include_files: bool,
    depth: int,
) -> Dict[str, Any]:
    """
    주어진 테이블(files/notes)에서 path_prefix 하위의 디렉터리/아이템을 트리 형태로 구성.
    - depth: 디렉터리/파일을 포함할 최대 깊이(1~5)
    - include_files: 파일/노트 아이템 포함 여부
    """
    pg = await resource_provider.database.get_postgresql(resource_config.postgresql)

    like_pattern = (path_prefix.rstrip("/") + "/%") if path_prefix != "/" else "%"
    # notes/files 공통 컬럼 하위 집합만 사용
    if table == "files":
        rows = await pg.fetch(
            f"""
            SELECT id, path, name, item_type, updated_at, file_size
            FROM {table}
            WHERE user_id = %s AND deleted_at IS NULL AND path LIKE %s
            LIMIT %s
            """,
            user_id,
            like_pattern,
            limit,
        )
    else:
        rows = await pg.fetch(
            f"""
            SELECT id, path, name, item_type, updated_at
            FROM {table}
            WHERE user_id = %s AND deleted_at IS NULL AND path LIKE %s
            LIMIT %s
            """,
            user_id,
            like_pattern,
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
        # 파일/아이템 포함 (depth 이내)
        if include_files and len(parts) <= depth:
            updated_at = r.get("updated_at") if isinstance(r, dict) else r["updated_at"]
            node: Dict[str, Any] = {
                "type": "item",
                "name": parts[-1],
                "path": p,
                "id": str(r["id"]),
                "itemType": str(r["item_type"]) if isinstance(r["item_type"], (str,)) else str(r["item_type"]),
                "updatedAt": (updated_at.isoformat() if hasattr(updated_at, "isoformat") and updated_at else None),
            }
            if table == "files":
                node["fileSize"] = int(r["file_size"]) if r.get("file_size") is not None else None
            file_nodes.append(node)

    dir_nodes = [
        {"type": "dir", "name": dp.split("/")[-1], "path": dp, "children": []}
        for dp in sorted(seen_dirs)
    ]
    return {"nodes": dir_nodes + file_nodes}


def _build_tree(nodes: List[Dict[str, Any]], *, path_prefix: str) -> Dict[str, Any]:
    """평면 nodes를 디렉터리 기준 트리로 변환."""
    path_to_dir: Dict[str, Dict[str, Any]] = {}
    root: Dict[str, Any] = {"path": path_prefix.rstrip("/") or "/", "children": []}
    path_to_dir[root["path"]] = root

    # 디렉터리를 먼저 등록
    for n in nodes:
        if n.get("type") == "dir":
            path_to_dir.setdefault(n["path"], {"path": n["path"], "name": n.get("name"), "children": []})
    # 부모-자식 연결(디렉터리)
    for p, d in path_to_dir.items():
        if p == root["path"]:
            continue
        parent_path = p.rsplit("/", 1)[0] or "/"
        if not parent_path.startswith(path_prefix.rstrip("/")) and parent_path != "/":
            parent_path = path_prefix.rstrip("/") or "/"
        parent = path_to_dir.get(parent_path)
        if parent is None:
            parent = root
        if d is not root:
            # 이름 보장
            if not d.get("name"):
                d["name"] = d["path"].split("/")[-1]
            parent.setdefault("children", []).append({"type": "dir", "name": d.get("name"), "path": d["path"], "children": d.get("children", [])})

    # 아이템 할당
    for n in nodes:
        if n.get("type") == "item":
            parent_path = n["path"].rsplit("/", 1)[0] or "/"
            if not parent_path.startswith(path_prefix.rstrip("/")) and parent_path != "/":
                parent_path = path_prefix.rstrip("/") or "/"
            parent = path_to_dir.get(parent_path)
            if parent is None:
                parent = root
            parent.setdefault("children", []).append(n)

    return root


def _render_markdown_tree(root: Dict[str, Any], *, heading: str) -> str:
    lines: List[str] = [heading, ""]

    def render_node(node: Dict[str, Any], level: int) -> None:
        indent = "  " * level
        if node.get("type") == "dir":
            lines.append(f"{indent}- [dir] {node.get('name')} (path: {node.get('path')})")
            for child in sorted(node.get("children", []), key=lambda x: (x.get("type") != "dir", x.get("name", ""))):
                render_node(child, level + 1)
        else:
            name = node.get("name")
            path = node.get("path")
            idv = node.get("id")
            item_type = node.get("itemType")
            updated = node.get("updatedAt")
            extra: List[str] = [f"path: {path}", f"id: {idv}", f"itemType: {item_type}"]
            if updated:
                extra.append(f"updatedAt: {updated}")
            if "fileSize" in node and node.get("fileSize") is not None:
                extra.append(f"fileSize: {node.get('fileSize')}")
            lines.append(f"{indent}- [item] {name} (" + ", ".join(extra) + ")")

    # 루트의 자식부터 출력
    for child in sorted(root.get("children", []), key=lambda x: (x.get("type") != "dir", x.get("name", ""))):
        render_node(child, 0)

    return "\n".join(lines)


async def _resolve_folder_path(*, table: str, user_id: str, folder_id: str) -> Optional[str]:
    """폴더 id로부터 해당 폴더의 절대 path를 조회 (folder 유형만 허용)."""
    pg = await resource_provider.database.get_postgresql(resource_config.postgresql)
    if table == "files":
        row = await pg.fetchrow(
            """
            SELECT path
            FROM files
            WHERE id = %s AND user_id = %s AND deleted_at IS NULL AND item_type = 'folder'
            """,
            folder_id,
            user_id,
        )
    else:
        row = await pg.fetchrow(
            """
            SELECT path
            FROM notes
            WHERE id = %s AND user_id = %s AND deleted_at IS NULL AND item_type = 'folder'
            """,
            folder_id,
            user_id,
        )
    if not row:
        return None
    return row["path"]


@router.post("/find/files_children")
async def find_files_children(request: Request, body: Dict[str, Any]) -> str:
    user_id: str = getattr(request.state, "user_id", None)
    folder_id = body.get("id")
    depth = _clamp(body.get("depth"), 1, 1, 5)
    limit = _clamp(body.get("limit"), 1000, 1, 5000)

    # tracing removed

    if not user_id:
        return ""
    if not folder_id:
        return ""

    # 폴더 id -> path 해석
    folder_path = await _resolve_folder_path(table="files", user_id=user_id, folder_id=str(folder_id))
    if not folder_path:
        return ""
    path_prefix = _normalize_prefix(folder_path)

    result = await _fetch_children(
        table="files",
        user_id=user_id,
        path_prefix=path_prefix,
        limit=limit,
        include_files=True,
        depth=depth,
    )
    tree_root = _build_tree(result.get("nodes", []), path_prefix=path_prefix)
    heading = f"## Files children (pathPrefix: {path_prefix}, depth: {depth})"
    md = _render_markdown_tree(tree_root, heading=heading)
    return md


@router.post("/find/notes_children")
async def find_notes_children(request: Request, body: Dict[str, Any]) -> str:
    user_id: str = getattr(request.state, "user_id", None)
    folder_id = body.get("id")
    depth = _clamp(body.get("depth"), 1, 1, 5)
    limit = _clamp(body.get("limit"), 1000, 1, 5000)

    # tracing removed
    # test logging removed

    if not user_id:
        return ""
    if not folder_id:
        return ""

    # 폴더 id -> path 해석
    folder_path = await _resolve_folder_path(table="notes", user_id=user_id, folder_id=str(folder_id))
    if not folder_path:
        return ""
    path_prefix = _normalize_prefix(folder_path)

    result = await _fetch_children(
        table="notes",
        user_id=user_id,
        path_prefix=path_prefix,
        limit=limit,
        include_files=True,
        depth=depth,
    )
    tree_root = _build_tree(result.get("nodes", []), path_prefix=path_prefix)
    heading = f"## Notes children (pathPrefix: {path_prefix}, depth: {depth})"
    md = _render_markdown_tree(tree_root, heading=heading)
    return md



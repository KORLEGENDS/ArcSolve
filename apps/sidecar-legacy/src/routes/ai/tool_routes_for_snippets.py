"""
스니펫 관련 하위 라우터

엔드포인트 (상위 라우터에서 prefix=/api/v1/tools 부여)
- POST /files/fetch_snippets
- POST /notes/fetch_snippets
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request

from src.resources.resource_provider import resource_provider

router = APIRouter()


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


def _to_list(ids: Any) -> List[str]:
    if ids is None:
        return []
    if isinstance(ids, list):
        return [str(x) for x in ids]
    return [str(ids)]


@router.post("/files/fetch_snippets")
async def files_fetch_snippets(request: Request, body: Dict[str, Any]) -> Dict[str, Any]:
    user_id: str = getattr(request.state, "user_id", None)
    ids = _to_list(body.get("ids"))
    allowed = body.get("allowed") or {}
    query: str = body.get("query") or ""
    k = _clamp(body.get("k"), 8, 1, 50)

    if not user_id or not ids or not query.strip():
        return {"results": [{"id": i, "strings": []} for i in ids]}
    if not isinstance(allowed, dict) or not isinstance(allowed.get("fileIds"), list):
        raise ValueError("Forbidden: allowed.fileIds missing")
    req = set(ids)
    allow = set(allowed["fileIds"])
    if not req.issubset(allow):
        raise ValueError("Forbidden: some fileIds not allowed")

    search_manager = await resource_provider.service.get_search()
    results: List[Dict[str, Any]] = []
    for fid in ids:
        try:
            chunks = await search_manager.query_file_chunks(user_id, fid, query, top_k=k)
        except Exception as e:
            chunks = []
        strings = [c.get("text", "") for c in chunks][:k]
        results.append({"id": fid, "strings": strings})
    return {"results": results}


@router.post("/notes/fetch_snippets")
async def notes_fetch_snippets(request: Request, body: Dict[str, Any]) -> Dict[str, Any]:
    query: str = body.get("query") or ""
    k = _clamp(body.get("k"), 8, 1, 50)
    docs = body.get("docs") or []

    # docs 형식 검증 및 가드
    if not isinstance(docs, list):
        raise ValueError("Invalid body.docs: expected list")
    normalized_docs: List[Dict[str, str]] = []
    for d in docs:
        if not isinstance(d, dict):
            continue
        did = str(d.get("id")) if d.get("id") is not None else None
        md = d.get("md") if isinstance(d.get("md"), str) else ""
        if did:
            normalized_docs.append({"id": did, "md": md})

    if not query.strip():
        return {"results": [{"id": d["id"], "strings": []} for d in normalized_docs]}

    # 메인서버가 전달한 md(마크다운)를 바로 대상으로 임베딩 기반 Top-k 스니펫 검색
    embed = await resource_provider.service.get_embedding()
    results: List[Dict[str, Any]] = []

    import numpy as np

    # 쿼리 임베딩은 한 번만 계산
    q_vec = await embed.encode_texts_cached([query], usage="query")
    if getattr(q_vec, "ndim", 1) == 2:
        q_vec = q_vec[0]

    for d in normalized_docs:
        nid = d["id"]
        raw_text = d["md"] or ""

        chunks = embed.chunk_text(raw_text)
        if not chunks:
            results.append({"id": nid, "strings": []})
            continue

        try:
            doc_vecs = await embed.encode_texts_cached(chunks, usage="doc")
        except Exception:
            results.append({"id": nid, "strings": []})
            continue
        sims = np.dot(doc_vecs, q_vec.astype(np.float32)) if getattr(doc_vecs, "size", 0) else np.zeros((0,), dtype=np.float32)
        top_idx = np.argsort(-sims)[:k]
        strings = [chunks[int(i)] for i in top_idx.tolist()]

        results.append({"id": nid, "strings": strings[:k]})

    return {"results": results}

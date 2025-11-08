"""
Tools 라우터: 스니펫 관련 하위 라우터를 포함

엔드포인트(prefix=/api/v1/tools)
- POST /files/fetch_snippets
- POST /notes/fetch_snippets
"""

from __future__ import annotations

from fastapi import APIRouter

from src.routes.ai.tool_routes_for_snippets import router as snippets_router
from src.routes.ai.tool_routes_for_find import router as find_router


router = APIRouter(prefix="/api/v1/tools", tags=["tools"])

# 하위 라우터 포함 (경로는 하위 라우터에서 상대 경로로 정의됨)
router.include_router(snippets_router)
router.include_router(find_router)
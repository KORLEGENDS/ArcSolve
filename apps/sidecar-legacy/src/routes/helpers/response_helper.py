"""
Response helper utilities for FastAPI routes

- Matches NextJS StandardApiResponse / ApiErrorResponse envelope
  defined in `ArcSolve-main/src/types/api/api.types.ts`

- Provides typed Pydantic models and builder functions to
  return consistent JSON responses across services.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Dict, Generic, List, Literal, Optional, TypeVar
from uuid import uuid4

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ==================== Pydantic Models (Aligned with NextJS) ====================


class ApiResponseMeta(BaseModel):
    timestamp: str
    version: str
    requestId: str
    correlationId: Optional[str] = None
    # Next meta.user is optional and typed on the Next side; keep as generic mapping here
    user: Optional[Dict[str, Any]] = None


T = TypeVar("T")


class StandardApiResponse(BaseModel, Generic[T]):
    success: Literal[True]
    data: T
    message: Optional[str] = None
    meta: ApiResponseMeta


class ApiErrorItem(BaseModel):
    detail: str
    pointer: Optional[str] = None
    parameter: Optional[str] = None
    header: Optional[str] = None
    code: Optional[str] = None


class ApiErrorResponse(BaseModel):
    # RFC 9457 Problem Details (+ project-specific fields)
    type: str
    title: str
    status: int
    detail: Optional[str] = None
    instance: Optional[str] = None
    success: Literal[False]
    correlationId: Optional[str] = None
    timestamp: str
    errors: Optional[List[ApiErrorItem]] = None


# ==================== Common Error Types (Project-wide) ====================


class ERROR_TYPES(StrEnum):
    MISSING_HEADERS = "missing_headers"
    MISSING_STORAGE_KEY = "missing_storage_key"
    INVALID_MIME = "invalid_mime"
    INVALID_BODY = "invalid_body"
    INVALID_OPTIONS = "invalid_options"

    STORAGE_DOWNLOAD_FAILED = "storage_download_failed"
    STORAGE_NOT_FOUND = "storage_not_found"

    DB_SELECT_FAILED = "db_select_failed"
    DB_UPDATE_FAILED = "db_update_failed"
    FILE_NOT_FOUND = "file_not_found"

    PARSE_FAILED = "parse_failed"

# ==================== Builders ====================


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_meta(request: Request, *, version: str = "1.0", user: Optional[Dict[str, Any]] = None) -> ApiResponseMeta:
    """Build ApiResponseMeta from request headers.

    - X-Request-ID → requestId (fallback: uuid4)
    - Correlation-Id → correlationId
    - user is optional and passed by caller if needed
    """
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    correlation_id = request.headers.get("Correlation-Id")
    return ApiResponseMeta(
        timestamp=_now_iso(),
        version=version,
        requestId=request_id,
        correlationId=correlation_id,
        user=user,
    )


def ok_response(
    request: Request,
    *,
    data: T,
    message: Optional[str] = None,
    status_code: int = 200,
    version: str = "1.0",
    user: Optional[Dict[str, Any]] = None,
) -> JSONResponse:
    """Return a StandardApiResponse[T] JSON response."""
    body = StandardApiResponse[T](
        success=True,
        data=data,
        message=message,
        meta=build_meta(request, version=version, user=user),
    )
    return JSONResponse(status_code=status_code, content=body.model_dump())


def error_response(
    request: Request,
    *,
    status_code: int,
    title: str,
    detail: str = "",
    type_: str = "about:blank",
    instance: Optional[str] = None,
    errors: Optional[List[ApiErrorItem]] = None,
) -> JSONResponse:
    """Return a project-standard ApiErrorResponse JSON response (RFC 9457 style)."""
    body = ApiErrorResponse(
        type=type_,
        title=title,
        status=status_code,
        detail=detail or None,
        instance=instance,
        success=False,
        correlationId=request.headers.get("Correlation-Id"),
        timestamp=_now_iso(),
        errors=errors,
    )
    return JSONResponse(status_code=status_code, content=body.model_dump())



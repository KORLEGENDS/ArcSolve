"""
File 도메인 모델 (메인 서버 Drizzle 스키마 동기화)
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class FileItemType(str, Enum):
    folder = "folder"
    item = "item"


class FileStatus(str, Enum):
    pending = "pending"
    uploading = "uploading"
    uploaded = "uploaded"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class FileBase(BaseModel):
    user_id: str
    name: str = Field(..., max_length=255)
    path: str
    item_type: FileItemType
    last_modified: datetime
    tags: List[str]
    # content를 문자열로 전환 (DB 마이그레이션은 별도)
    content: str
    # 전사 세그먼트(JSONB 대응)
    segments: Optional[List[Dict[str, Any]]] = None
    # 새 레이아웃 컬럼(files.layout)에 대응
    layout: Optional[Dict[str, Any]] = None

    file_size: int = 0
    mime_type: Optional[str] = Field(None, max_length=100)
    storage_key: Optional[str] = None
    status: FileStatus = FileStatus.pending
    metadata: Optional[Dict[str, Any]] = None

    deleted_at: Optional[datetime] = None


class FileCreate(FileBase):
    pass


class FileUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    path: Optional[str] = None
    item_type: Optional[FileItemType] = None
    last_modified: Optional[datetime] = None
    tags: Optional[List[str]] = None
    content: Optional[str] = None
    segments: Optional[List[Dict[str, Any]]] = None
    layout: Optional[Dict[str, Any]] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = Field(None, max_length=100)
    storage_key: Optional[str] = None
    status: Optional[FileStatus] = None
    metadata: Optional[Dict[str, Any]] = None
    deleted_at: Optional[datetime] = None


class File(FileBase):
    id: str
    created_at: datetime
    updated_at: datetime


class FileResponse(FileBase):
    id: str
    created_at: datetime
    updated_at: datetime



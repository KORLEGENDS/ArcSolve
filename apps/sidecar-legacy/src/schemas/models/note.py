"""
Note 도메인 모델 (메인 서버 Drizzle 스키마 동기화)
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class NoteItemType(str, Enum):
    folder = "folder"
    item = "item"


class NoteBase(BaseModel):
    user_id: str
    name: str = Field(..., max_length=255)
    path: str
    item_type: NoteItemType
    last_modified: datetime
    tags: List[str]
    content: Dict[str, Any]
    deleted_at: Optional[datetime] = None


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    path: Optional[str] = None
    item_type: Optional[NoteItemType] = None
    last_modified: Optional[datetime] = None
    tags: Optional[List[str]] = None
    content: Optional[Dict[str, Any]] = None
    deleted_at: Optional[datetime] = None


class Note(NoteBase):
    id: str
    created_at: datetime
    updated_at: datetime


class NoteResponse(NoteBase):
    id: str
    created_at: datetime
    updated_at: datetime



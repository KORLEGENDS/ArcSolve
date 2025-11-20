"""
User 도메인 모델 정의 (메인 서버 Drizzle 스키마 동기화)
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    user = "user"
    manager = "manager"
    admin = "admin"


class UserBase(BaseModel):
    """User 기본 도메인 모델"""

    email: EmailStr
    name: str = Field(..., max_length=100)
    role: UserRole = UserRole.user
    preferences: Optional[Dict[str, Any]] = None
    email_verified: Optional[datetime] = None
    image: Optional[str] = None
    deleted_at: Optional[datetime] = None
    

class UserCreate(UserBase):
    """User 생성 요청 모델 (비밀번호 제거)"""
    pass
    

class UserUpdate(BaseModel):
    """User 업데이트 요청 모델"""

    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, max_length=100)
    role: Optional[UserRole] = None
    preferences: Optional[Dict[str, Any]] = None
    email_verified: Optional[datetime] = None
    image: Optional[str] = None
    deleted_at: Optional[datetime] = None
    

class User(UserBase):
    """User 도메인 엔티티"""

    id: str
    created_at: datetime
    updated_at: datetime
    

class UserResponse(UserBase):
    """User API 응답 모델"""

    id: str
    created_at: datetime
    updated_at: datetime
"""
User Repository (Drizzle 스키마 동기화)
비밀번호 컬럼 제거, 이름 및 역할 컬럼 등 신규 스키마 반영
"""

from typing import List, Optional
from uuid import uuid4

from src.resources.database import PostgreSQLManager
from ..models.user import User, UserCreate, UserUpdate


class UserRepository:
    """User 엔티티 Repository (간소화 버전)"""
    
    def __init__(self, db: PostgreSQLManager):
        """
        Args:
            db: PostgreSQL 매니저
        """
        self.db = db
        
    async def create(self, user: UserCreate) -> User:
        """사용자 생성"""
        query = """
            INSERT INTO users (id, email, name, role, preferences, email_verified, image, deleted_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """
        
        generated_id = getattr(user, "id", None) or uuid4().hex

        record = await self.db.fetchrow(
            query,
            generated_id,
            user.email,
            user.name,
            user.role.value if hasattr(user.role, "value") else user.role,
            user.preferences,
            user.email_verified,
            user.image,
            user.deleted_at,
        )
        
        if record:
            return User(**record)  # dict이므로 바로 언패킹
        raise Exception("사용자 생성 실패")
        
    async def get(self, user_id: str) -> Optional[User]:
        """ID로 사용자 조회"""
        record = await self.db.fetchrow(
            "SELECT * FROM users WHERE id = %s",
            user_id
        )
        return User(**record) if record else None
        
    async def get_by_email(self, email: str) -> Optional[User]:
        """이메일로 사용자 조회"""
        record = await self.db.fetchrow(
            "SELECT * FROM users WHERE email = %s",
            email
        )
        return User(**record) if record else None
        
    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> List[User]:
        """사용자 목록 조회"""
        query = f"SELECT * FROM users ORDER BY created_at DESC LIMIT {limit} OFFSET {skip}"
        params = []
        
        records = await self.db.fetch(query, *params)
        return [User(**record) for record in records]
        
    async def update(self, user_id: str, user_update: UserUpdate) -> Optional[User]:
        """사용자 업데이트"""
        update_data = user_update.model_dump(exclude_unset=True)
        
        if not update_data:
            return await self.get(user_id)
            
        # UPDATE 쿼리 생성
        set_clauses = []
        params = []
        
        for i, (field, value) in enumerate(update_data.items(), 1):
            set_clauses.append(f"{field} = %s")
            params.append(value)
            
        params.append(user_id)
        
        query = f"""
            UPDATE users
            SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *
        """
        
        record = await self.db.fetchrow(query, *params, user_id)
        return User(**record) if record else None
        
    async def delete(self, user_id: str) -> bool:
        """사용자 삭제"""
        result = await self.db.execute(
            "DELETE FROM users WHERE id = %s",
            user_id
        )
        return result == "DELETE 1"
        
    async def bulk_create(self, users: List[UserCreate]) -> int:
        """대량 사용자 생성"""
        data = [
            (
                getattr(user, "id", None),
                user.email,
                user.name,
                user.role.value if hasattr(user.role, "value") else user.role,
                user.preferences,
                user.email_verified,
                user.image,
                user.deleted_at,
            )
            for user in users
        ]
        
        return await self.db.bulk_insert(
            "users",
            [
                "id",
                "email",
                "name",
                "role",
                "preferences",
                "email_verified",
                "image",
                "deleted_at"
            ],
            data
        )
"""
데이터베이스 매니저 - Factory & Provider
필수 기능만 포함: 생성, 초기화, 싱글톤 관리
PostgreSQL, Redis, R2 통합 관리
"""

from typing import Optional, Dict, Any
import asyncio

from src.config.resources import PostgreSQLConfig, RedisConfig, R2Config
from .postgresql.postgresql_manager import PostgreSQLManager
from .redis.redis_manager import RedisManager
from .r2.r2_storage_manager import R2StorageManager


class DatabaseFactory:
    """데이터베이스 인스턴스 생성 팩토리"""
    
    @staticmethod
    async def create_postgresql(config: PostgreSQLConfig) -> PostgreSQLManager:
        """PostgreSQL Manager 생성 및 초기화"""
        manager = PostgreSQLManager(config)
        await manager.initialize()
        return manager
    
    @staticmethod
    async def create_redis(config: RedisConfig) -> RedisManager:
        """Redis Manager 생성 및 초기화"""
        manager = RedisManager(config)
        await manager.initialize()
        return manager
    
    @staticmethod
    async def create_r2(config: R2Config) -> R2StorageManager:
        """R2 Storage Manager 생성 및 초기화"""
        manager = R2StorageManager(config)
        await manager.initialize()
        return manager


class DatabaseProvider:
    """데이터베이스 인스턴스 제공자 (싱글톤 관리)"""
    
    def __init__(self):
        """프로바이더 초기화"""
        # 각 서비스별 인스턴스
        self._postgresql: Optional[PostgreSQLManager] = None
        self._redis: Optional[RedisManager] = None
        self._r2: Optional[R2StorageManager] = None
        
        # 각 서비스별 락
        self._postgresql_lock = asyncio.Lock()
        self._redis_lock = asyncio.Lock()
        self._r2_lock = asyncio.Lock()
    
    async def get_postgresql(self, config: PostgreSQLConfig) -> PostgreSQLManager:
        """PostgreSQL Manager 인스턴스 반환 (싱글톤)"""
        if self._postgresql is not None:
            return self._postgresql
        
        async with self._postgresql_lock:
            if self._postgresql is not None:
                return self._postgresql
            
            self._postgresql = await DatabaseFactory.create_postgresql(config)
            return self._postgresql
    
    async def get_redis(self, config: RedisConfig) -> RedisManager:
        """Redis Manager 인스턴스 반환 (싱글톤)"""
        if self._redis is not None:
            return self._redis
        
        async with self._redis_lock:
            if self._redis is not None:
                return self._redis
            
            self._redis = await DatabaseFactory.create_redis(config)
            return self._redis
    
    async def get_r2(self, config: R2Config) -> R2StorageManager:
        """R2 Storage Manager 인스턴스 반환 (싱글톤)"""
        if self._r2 is not None:
            return self._r2
        
        async with self._r2_lock:
            if self._r2 is not None:
                return self._r2
            
            self._r2 = await DatabaseFactory.create_r2(config)
            return self._r2
    
    async def close_all(self) -> None:
        """모든 인스턴스 종료 및 정리"""
        if self._postgresql is not None:
            await self._postgresql.close()
            self._postgresql = None
        
        if self._redis is not None:
            await self._redis.close()
            self._redis = None
        
        if self._r2 is not None:
            await self._r2.close()
            self._r2 = None
    
    async def health_check_all(self) -> Dict[str, bool]:
        """모든 서비스 헬스체크"""
        results = {}
        
        if self._postgresql is not None:
            results['postgresql'] = await self._postgresql.health_check()
        
        if self._redis is not None:
            results['redis'] = await self._redis.health_check()
        
        if self._r2 is not None:
            results['r2'] = await self._r2.health_check()
        
        results['overall'] = all(results.values()) if results else False
        return results
    
    def get_status(self) -> Dict[str, bool]:
        """초기화 상태 확인"""
        return {
            'postgresql': self._postgresql is not None,
            'redis': self._redis is not None,
            'r2': self._r2 is not None
        }


# 전역 프로바이더 인스턴스 (애플리케이션 레벨)
database_provider = DatabaseProvider()
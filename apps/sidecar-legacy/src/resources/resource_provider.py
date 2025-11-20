"""
통합 리소스 프로바이더
모든 리소스 (Database, Service)를 한 곳에서 관리
"""

from typing import Dict, Any

from src.config.resources import resource_config
from src.config.services import service_config
from src.resources.database.database_manager import database_provider
from src.resources.service.service_manager import service_provider
from src.resources.logging.logging_manager import trace_class


@trace_class
class ResourceProvider:
    """통합 리소스 프로바이더"""
    
    def __init__(self):
        """프로바이더 초기화"""
        self.database = database_provider
        self.service = service_provider
        # 순환 의존 방지: ServiceProvider에 DatabaseProvider 주입
        try:
            self.service.set_database_provider(self.database)
        except Exception:
            pass
    
    async def initialize_all(self) -> None:
        """
        모든 리소스 초기화
        Database 먼저 초기화 후 Service 초기화
        """
        # 1. Database 초기화
        postgresql = await self.database.get_postgresql(resource_config.postgresql)
        redis = await self.database.get_redis(resource_config.redis)
        
        # R2는 선택적
        if hasattr(resource_config, 'r2') and resource_config.r2:
            r2 = await self.database.get_r2(resource_config.r2)
        
        # 2. Service 초기화 (Database 의존성 있음)
        # Checkpointer는 PostgreSQL Pool 필요
        if postgresql and postgresql._pool:
            await self.service.get_checkpointer(
                backend="postgresql",
                connection=postgresql._pool
            )

        # Embedding 매니저 준비(지연 로딩이지만, 초기 접근 경로 보장)
        try:
            await self.service.get_embedding()
        except Exception:
            pass
    
    async def close_all(self) -> None:
        """모든 리소스 정리"""
        # Service는 자동 정리 (참조만 가지고 있음)
        
        # Database 정리
        await self.database.close_all()
    
    async def health_check_all(self) -> Dict[str, Any]:
        """모든 리소스 헬스체크"""
        results = {}
        
        # Database 헬스체크
        db_health = await self.database.health_check_all()
        results['database'] = db_health
        
        # Service 상태 체크
        results['service'] = {
            'checkpointer': self.service.is_checkpointer_initialized(),
            'embedding': self.service.get_embedding_stats(),
        }
        
        # 전체 상태
        results['overall'] = (
            db_health.get('overall', False) and
            self.service.is_checkpointer_initialized()
        )
        
        return results
    
    def get_status(self) -> Dict[str, Any]:
        """전체 리소스 상태"""
        return {
            'database': self.database.get_status(),
            'service': {
                'checkpointer': self.service.is_checkpointer_initialized()
            }
        }


# 전역 통합 프로바이더
resource_provider = ResourceProvider()
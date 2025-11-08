"""
서비스 매니저 - Factory & Provider
필수 기능만 포함: Checkpointer 생성 및 관리
"""

import asyncio
from typing import Any, Dict, Optional

from src.config.runtime import RuntimeState
from src.config.services import service_config
from src.resources.logging import trace_class
from src.resources.service.ai.search_manager import SearchManager
from src.resources.service.business.embed_manager import EmbedManager
from src.resources.service.business.parse_manager import ParseManager


class ServiceFactory:
    """서비스 인스턴스 생성 팩토리"""
    
    @staticmethod
    async def create_checkpointer(backend: str, connection: Any) -> Any:
        """
        체크포인터 생성
        
        Args:
            backend: 체크포인터 백엔드 (postgresql, redis 등)
            connection: 연결 객체 (Pool 등)
            
        Returns:
            체크포인터 인스턴스
        """
        if backend == "postgresql":
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
            
            checkpointer = AsyncPostgresSaver(connection)
            await checkpointer.setup()
            return checkpointer
        
        # TODO: 추가 백엔드 지원 (redis, mongodb 등)
        else:
            raise ValueError(f"지원하지 않는 백엔드: {backend}")


@trace_class
class ServiceProvider:
    """서비스 인스턴스 제공자 (캐싱 & 싱글톤)"""
    
    def __init__(self):
        """프로바이더 초기화"""
        
        # 체크포인터 (싱글톤)
        self._checkpointer: Optional[Any] = None
        self._checkpointer_lock = asyncio.Lock()

        # 임베딩 매니저 (싱글톤)
        self._embed_manager: Optional[EmbedManager] = None
        self._embed_lock = asyncio.Lock()

        # 파서 매니저 (싱글톤)
        self._parse_manager: Optional[ParseManager] = None
        self._parse_lock = asyncio.Lock()

        # 검색 매니저 (싱글톤)
        self._search_manager: Optional[SearchManager] = None
        self._search_lock = asyncio.Lock()
        # 외부 주입: DatabaseProvider (순환 의존 방지)
        self._database_provider: Optional[object] = None

    def set_database_provider(self, database_provider: object) -> None:
        self._database_provider = database_provider
    
    async def get_checkpointer(
        self,
        backend: str = "postgresql",
        connection: Any = None
    ) -> Any:
        """
        체크포인터 반환 (싱글톤)
        
        Args:
            backend: 체크포인터 백엔드
            connection: 연결 객체
            
        Returns:
            체크포인터 인스턴스
        """
        # 이미 존재하면 반환
        if self._checkpointer is not None:
            return self._checkpointer
        
        # 동시 접근 방지
        async with self._checkpointer_lock:
            # Double-check locking
            if self._checkpointer is not None:
                return self._checkpointer
            
            if connection is None:
                raise ValueError("체크포인터 생성에 연결 객체가 필요합니다")
            
            # 체크포인터 생성
            self._checkpointer = await ServiceFactory.create_checkpointer(
                backend, connection
            )
            return self._checkpointer

    async def get_embedding(self) -> EmbedManager:
        """임베딩 매니저 반환 (싱글톤)"""
        if self._embed_manager is not None:
            return self._embed_manager
        async with self._embed_lock:
            if self._embed_manager is not None:
                return self._embed_manager
            # 클래스 직접 생성 + DatabaseProvider 주입
            mgr = EmbedManager(database_provider=self._database_provider, runtime=RuntimeState.detect())
            self._embed_manager = mgr
            return self._embed_manager

    async def get_parser(self) -> ParseManager:
        """파서 매니저 반환 (싱글톤)"""
        if self._parse_manager is not None:
            return self._parse_manager
        async with self._parse_lock:
            if self._parse_manager is not None:
                return self._parse_manager
            self._parse_manager = ParseManager()
            return self._parse_manager

    async def get_search(self) -> SearchManager:
        """검색 매니저 반환 (싱글톤)"""
        if self._search_manager is not None:
            return self._search_manager
        async with self._search_lock:
            if self._search_manager is not None:
                return self._search_manager
            # 클래스 직접 생성 + DatabaseProvider 주입
            mgr = SearchManager(
                database_provider=self._database_provider,
                embedding_accessor=lambda: self.get_embedding(),
            )
            self._search_manager = mgr
            return self._search_manager
    
    def is_checkpointer_initialized(self) -> bool:
        """체크포인터 초기화 상태"""
        return self._checkpointer is not None

    def get_embedding_stats(self) -> Dict[str, Any]:
        """임베딩 설정/상태 요약"""
        emb_cfg = service_config.embedding
        return {
            "model": emb_cfg.model_id,
            "dim": emb_cfg.mrl_dim,
        }


# 전역 프로바이더 인스턴스
service_provider = ServiceProvider()
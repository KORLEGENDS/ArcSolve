"""
PostgreSQL 매니저 (통합 버전)
필수 기능만 포함한 단순하고 효율적인 구조
"""

import time
import os
import shutil
from typing import Optional, List, Dict, Any, Tuple, Callable
from contextlib import asynccontextmanager
import time

import psycopg
from psycopg_pool import AsyncConnectionPool
from psycopg import rows
import ssl

from src.config.resources import PostgreSQLConfig
from src.resources.logging import trace_class


@trace_class
class PostgreSQLManager:
    """
    PostgreSQL 매니저 (핵심 기능만)
    연결 풀 관리, 트랜잭션, 쿼리 실행 담당
    """
    
    def __init__(self, config: PostgreSQLConfig):
        self.config = config
        self._pool: Optional[AsyncConnectionPool] = None
        self._last_health_check = 0
        self._health_status = False
        
        # 스키마 캐싱 시스템
        self._schema_cache: Dict[str, Dict] = {}
        self._schema_cache_ttl: Dict[str, float] = {}
        
        # 비즈니스 로직 훅 시스템
        self._mutation_hooks: Dict[str, Callable] = {}
        
    # ========== 연결 관리 ==========
        
    async def initialize(self) -> None:
        """연결 풀 초기화"""
        if self._pool is not None:
            return
            
        # psycopg3: host/hostaddr 분리로 SNI 강제 (host=servername, hostaddr=IP)
        connect_kwargs = {
            "port": self.config.port,
            "user": self.config.user,
            "password": self.config.password,
            "dbname": self.config.database,
            # 행을 dict 형태로 반환
            "row_factory": rows.dict_row,
        }

        # SNI/검증 정책
        if self.config.ssl_reject_unauthorized:
            connect_kwargs["sslmode"] = "verify-full"
        else:
            connect_kwargs["sslmode"] = "disable"

        # host, hostaddr 분리 적용
        if self.config.ssl_servername:
            connect_kwargs["host"] = self.config.ssl_servername
            connect_kwargs["hostaddr"] = self.config.host
        else:
            # SNI 필요 없으면 일반 설정
            connect_kwargs["host"] = self.config.host

        # CUDA 환경일 경우 시스템 CA 번들을 기본으로 사용하도록 sslrootcert 동적 지정
        if connect_kwargs.get("sslmode") == "verify-full":
            explicit_ca_path = os.getenv("PG_SSL_ROOT_CERT")
            if explicit_ca_path and os.path.exists(explicit_ca_path):
                connect_kwargs["sslrootcert"] = explicit_ca_path
            else:
                def _is_cuda_env() -> bool:
                    return (
                        shutil.which("nvidia-smi") is not None
                        or os.path.exists("/usr/local/cuda/version.txt")
                        or bool(os.getenv("CUDA_HOME"))
                        or bool(os.getenv("CUDA_PATH"))
                    )

                cuda_system_ca = "/etc/ssl/certs/ca-certificates.crt"
                if _is_cuda_env() and os.path.exists(cuda_system_ca):
                    connect_kwargs["sslrootcert"] = cuda_system_ca

        # 풀 생성 (psycopg AsyncConnectionPool)
        # note: psycopg_pool 크기 설정은 min_size/max_size가 아니라 min_size/max_size
        self._pool = AsyncConnectionPool(
            kwargs=connect_kwargs,
            min_size=self.config.min_connections,
            max_size=self.config.max_connections,
            timeout=self.config.command_timeout,
            open=False,
        )
        # psycopg_pool 권고: 생성 후 명시적으로 open
        await self._pool.open()
        
    async def close(self) -> None:
        """연결 풀 종료"""
        if self._pool is not None:
            await self._pool.close()
            self._pool = None
            self._health_status = False
            
    async def _ensure_pool(self) -> AsyncConnectionPool:
        """연결 풀 확인 (지연 초기화)"""
        if self._pool is None:
            await self.initialize()
        return self._pool
        
    # ========== 기본 쿼리 실행 ==========
    
    async def execute(self, query: str, *args, timeout: float = None) -> str:
        """
        쿼리 실행 (INSERT, UPDATE, DELETE 등)
        Returns: 실행 결과 문자열 (예: "DELETE 1")
        """
        pool = await self._ensure_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, args if args else None)
                # psycopg3는 execute 결과 문자열을 직접 반환하지 않음 → 영향 없는 단순 OK 문자열로 통일
                return "OK"
            
    async def fetch(self, query: str, *args, timeout: float = None) -> List[Dict[str, Any]]:
        """
        여러 행 조회
        Returns: 딕셔너리 리스트
        """
        pool = await self._ensure_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, args if args else None)
                rows_ = await cur.fetchall()
                return rows_ or []
            
    async def fetchrow(self, query: str, *args, timeout: float = None) -> Optional[Dict[str, Any]]:
        """
        단일 행 조회
        Returns: 딕셔너리 또는 None
        """
        pool = await self._ensure_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, args if args else None)
                row = await cur.fetchone()
                return row if row else None
            
    async def fetchval(self, query: str, *args, column: int = 0, timeout: float = None) -> Any:
        """
        단일 값 조회
        Returns: 첫 번째 행의 첫 번째 컬럼 값
        """
        pool = await self._ensure_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, args if args else None)
                row = await cur.fetchone()
                if not row:
                    return None
                # dict_row 이므로 첫 컬럼 값 반환
                return list(row.values())[column]
            
    # ========== 트랜잭션 ==========
    
    @asynccontextmanager
    async def transaction(self):
        """
        트랜잭션 컨텍스트 매니저
        
        Usage:
            async with manager.transaction() as conn:
                await conn.execute("UPDATE ...")
                await conn.execute("INSERT ...")
                # 자동 커밋 또는 롤백
        """
        pool = await self._ensure_pool()
        async with pool.connection() as conn:
            async with conn.transaction():
                yield conn
                
    # ========== 유용한 추가 기능 ==========
    
    async def bulk_insert(
        self,
        table_name: str,
        columns: List[str],
        data: List[Tuple],
    ) -> int:
        """
        대량 데이터 삽입 (COPY 명령 사용으로 10배 빠름)
        
        Args:
            table_name: 테이블 이름
            columns: 컬럼 리스트
            data: 데이터 튜플 리스트
            
        Returns:
            삽입된 행 수
        """
        if not data:
            return 0
            
        pool = await self._ensure_pool()
        async with pool.connection() as conn:
            await conn.copy_records_to_table(table_name, records=data, columns=columns)
            return len(data)
            
    async def execute_many(self, query: str, args: List[Tuple]) -> None:
        """
        여러 쿼리 배치 실행
        
        Args:
            query: SQL 쿼리
            args: 파라미터 튜플 리스트
        """
        pool = await self._ensure_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.executemany(query, args)
            
    async def health_check(self) -> bool:
        """
        연결 상태 확인 (5초 캐싱)
        
        Returns:
            연결 정상 여부
        """
        current_time = time.time()
        
        # 캐시된 결과 사용 (30초 -> 5초로 단축)
        if current_time - self._last_health_check < 5:
            return self._health_status
            
        try:
            await self.fetchval("SELECT 1")
            self._health_status = True
        except Exception as e:
            self._health_status = False
        finally:
            self._last_health_check = current_time
            
        return self._health_status
        
    async def table_exists(self, table_name: str) -> bool:
        """
        테이블 존재 여부 확인
        
        Args:
            table_name: 테이블 이름
            
        Returns:
            존재 여부
        """
        query = """
            SELECT EXISTS (
                SELECT FROM pg_tables
                WHERE schemaname = 'public'
                AND tablename = %s
            )
        """
        return await self.fetchval(query, table_name)
        
    # ========== 컨텍스트 매니저 지원 ==========
    
    async def __aenter__(self):
        """비동기 컨텍스트 매니저 진입"""
        await self.initialize()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """비동기 컨텍스트 매니저 종료"""
        await self.close()
    
    # ========== 동적 스키마 관리 ==========
    
    async def get_table_schema(self, table_name: str) -> Dict[str, Dict[str, Any]]:
        """
        테이블 스키마 동적 조회
        
        Args:
            table_name: 테이블 이름
            
        Returns:
            컬럼별 스키마 정보
        """
        query = """
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_name = %s
            ORDER BY ordinal_position
        """
        
        records = await self.fetch(query, table_name)
        
        return {
            row['column_name']: {
                'type': row['data_type'],
                'nullable': row['is_nullable'] == 'YES',
                'default': row['column_default'],
                'max_length': row['character_maximum_length']
            }
            for row in records
        }
    
    async def get_table_schema_cached(
        self, 
        table_name: str,
        ttl: int = 300  # 5분 캐싱
    ) -> Dict[str, Dict[str, Any]]:
        """
        캐싱된 스키마 조회
        
        Args:
            table_name: 테이블 이름
            ttl: 캐시 유효 시간 (초)
            
        Returns:
            컬럼별 스키마 정보
        """
        current_time = time.time()
        
        # 캐시 확인
        if (table_name in self._schema_cache and 
            current_time - self._schema_cache_ttl.get(table_name, 0) < ttl):
            return self._schema_cache[table_name]
        
        # 새로 조회
        schema = await self.get_table_schema(table_name)
        self._schema_cache[table_name] = schema
        self._schema_cache_ttl[table_name] = current_time
        
        return schema
    
    # ========== 범용 뮤테이션 메서드 ==========
    
    async def insert_dynamic(
        self, 
        table: str, 
        data: Dict[str, Any],
        returning: str = '*'
    ) -> Optional[Dict[str, Any]]:
        """
        동적 INSERT (테이블 무관)
        
        Args:
            table: 테이블 이름
            data: 삽입할 데이터
            returning: RETURNING 절
            
        Returns:
            삽입된 레코드
        """
        # 스키마 확인 후 유효한 컬럼만 필터링
        schema = await self.get_table_schema_cached(table)
        valid_data = {k: v for k, v in data.items() if k in schema}
        
        if not valid_data:
            raise ValueError(f"No valid columns for table {table}")
        
        columns = list(valid_data.keys())
        placeholders = ["%s" for _ in range(len(columns))]
        
        query = f"""
            INSERT INTO {table} ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            RETURNING {returning}
        """
        
        return await self.fetchrow(query, *valid_data.values())
    
    async def update_dynamic(
        self,
        table: str,
        id_column: str,
        id_value: Any,
        data: Dict[str, Any],
        returning: str = '*'
    ) -> Optional[Dict[str, Any]]:
        """
        동적 UPDATE
        
        Args:
            table: 테이블 이름
            id_column: ID 컬럼 이름
            id_value: ID 값
            data: 업데이트할 데이터
            returning: RETURNING 절
            
        Returns:
            업데이트된 레코드
        """
        schema = await self.get_table_schema_cached(table)
        valid_data = {k: v for k, v in data.items() if k in schema and k != id_column}
        
        if not valid_data:
            return None
        
        set_clauses = [f"{col} = %s" for col in valid_data.keys()]
        
        query = f"""
            UPDATE {table}
            SET {', '.join(set_clauses)}
            WHERE {id_column} = %s
            RETURNING {returning}
        """
        
        values = list(valid_data.values()) + [id_value]
        return await self.fetchrow(query, *values)
    
    async def delete_dynamic(
        self,
        table: str,
        id_column: str,
        id_value: Any
    ) -> bool:
        """
        동적 DELETE
        
        Args:
            table: 테이블 이름
            id_column: ID 컬럼 이름
            id_value: ID 값
            
        Returns:
            삭제 성공 여부
        """
        query = f"DELETE FROM {table} WHERE {id_column} = %s"
        result = await self.execute(query, id_value)
        return result.split()[-1] == '1'
    
    async def upsert_dynamic(
        self,
        table: str,
        data: Dict[str, Any],
        conflict_columns: List[str],
        returning: str = '*'
    ) -> Optional[Dict[str, Any]]:
        """
        INSERT ON CONFLICT UPDATE (UPSERT)
        
        Args:
            table: 테이블 이름
            data: 삽입/업데이트할 데이터
            conflict_columns: 충돌 감지 컬럼들
            returning: RETURNING 절
            
        Returns:
            처리된 레코드
        """
        schema = await self.get_table_schema_cached(table)
        valid_data = {k: v for k, v in data.items() if k in schema}
        
        if not valid_data:
            raise ValueError(f"No valid columns for table {table}")
        
        columns = list(valid_data.keys())
        placeholders = ["%s" for _ in range(len(columns))]
        
        # UPDATE 절 생성 (충돌 컬럼 제외)
        update_cols = [c for c in columns if c not in conflict_columns]
        update_clause = ', '.join([f"{c} = EXCLUDED.{c}" for c in update_cols])
        
        query = f"""
            INSERT INTO {table} ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            ON CONFLICT ({', '.join(conflict_columns)})
            DO UPDATE SET {update_clause}
            RETURNING {returning}
        """
        
        return await self.fetchrow(query, *valid_data.values())
    
    # ========== 통합 뮤테이션 인터페이스 ==========
    
    async def mutate(
        self,
        operation: str,
        table: str,
        data: Dict[str, Any] = None,
        where: Dict[str, Any] = None,
        returning: str = '*'
    ) -> Any:
        """
        통합 뮤테이션 메서드
        
        Args:
            operation: 작업 유형 (insert, update, delete, upsert)
            table: 테이블 이름
            data: 처리할 데이터
            where: 조건 (update, delete용)
            returning: RETURNING 절
            
        Returns:
            작업 결과
        """
        # 비즈니스 로직 훅 실행
        hook_key = f"{table}.{operation}"
        if hook_key in self._mutation_hooks and data:
            data = await self._mutation_hooks[hook_key](data)
        
        # 작업 실행
        if operation == 'insert':
            return await self.insert_dynamic(table, data, returning)
        elif operation == 'update':
            if not where:
                raise ValueError("UPDATE requires 'where' parameter")
            id_col, id_val = next(iter(where.items()))
            return await self.update_dynamic(table, id_col, id_val, data, returning)
        elif operation == 'delete':
            if not where:
                raise ValueError("DELETE requires 'where' parameter")
            id_col, id_val = next(iter(where.items()))
            return await self.delete_dynamic(table, id_col, id_val)
        elif operation == 'upsert':
            if not where:
                raise ValueError("UPSERT requires 'where' parameter for conflict columns")
            return await self.upsert_dynamic(table, data, list(where.keys()), returning)
        else:
            raise ValueError(f"Unknown operation: {operation}")
    
    def register_hook(self, table: str, operation: str, hook: Callable):
        """
        비즈니스 로직 훅 등록
        
        Args:
            table: 테이블 이름
            operation: 작업 유형
            hook: 훅 함수 (async function)
        """
        self._mutation_hooks[f"{table}.{operation}"] = hook
    
    def clear_schema_cache(self, table_name: Optional[str] = None):
        """
        스키마 캐시 초기화
        
        Args:
            table_name: 특정 테이블만 초기화 (None이면 전체)
        """
        if table_name:
            self._schema_cache.pop(table_name, None)
            self._schema_cache_ttl.pop(table_name, None)
        else:
            self._schema_cache.clear()
            self._schema_cache_ttl.clear()
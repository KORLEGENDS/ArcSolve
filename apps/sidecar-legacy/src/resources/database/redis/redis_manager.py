"""
Redis Manager (통일된 네이밍)
필수 기능만 포함: 연결, 기본 작업, 헬스체크
"""

import time
import socket
from typing import Optional, Any
import redis
import ssl
from redis.connection import ConnectionPool, Connection
from redis.exceptions import ConnectionError, TimeoutError

from src.config.resources import RedisConfig
from src.resources.logging import trace_class


@trace_class
class RedisManager:
    """Redis 매니저 - 필수 기능만 포함"""
    
    def __init__(self, config: RedisConfig):
        self.config = config
        self._client: Optional[redis.Redis] = None
        self._pool: Optional[ConnectionPool] = None
        self._last_health_check = 0
        self._health_status = False
    
    async def initialize(self) -> None:
        """연결 풀 초기화 (PostgreSQL과 동일 패턴)"""
        if self._client is not None:
            return
            
        try:
            # 커스텀 SNI Connection
            class SNIConnection(Connection):
                def __init__(self, *args, sni_servername: str | None = None, **kwargs):
                    super().__init__(*args, **kwargs)
                    self._sni_servername = sni_servername

                def _connect(self):
                    # 원본 구현을 참고하여 소켓 생성 후 필요 시 TLS 래핑
                    sock = self._connect_tcp()
                    if not self._ssl:
                        return sock
                    # SSL 컨텍스트 준비
                    context = self._ssl_context
                    # server_hostname 지정으로 SNI 강제
                    return context.wrap_socket(sock, server_hostname=self._sni_servername or self.host)

                def _connect_tcp(self):
                    # redis-py 내부 구현과 동일하게 TCP 소켓 생성
                    # host에는 실제 접속 IP를 둠 (예: 127.0.0.1)
                    err = None
                    for res in socket.getaddrinfo(self.host, self.port, 0, socket.SOCK_STREAM):
                        af, socktype, proto, canonname, sa = res
                        sock = None
                        try:
                            sock = socket.socket(af, socktype, proto)
                            sock.settimeout(self.socket_timeout)
                            sock.connect(sa)
                            return sock
                        except OSError as e:
                            err = e
                            if sock is not None:
                                try:
                                    sock.close()
                                except Exception:
                                    pass
                            continue
                    if err is not None:
                        raise err

            # 연결 풀 생성 (직접 파라미터 방식)
            pool_kwargs: dict[str, Any] = {
                "connection_class": SNIConnection if self.config.tls_enabled else Connection,
                "host": self.config.host,
                "port": self.config.port,
                "password": self.config.password,
                "max_connections": self.config.max_connections,
                "socket_timeout": self.config.socket_timeout,
                "socket_connect_timeout": self.config.socket_connect_timeout,
                "retry_on_timeout": self.config.retry_on_timeout,
                "health_check_interval": self.config.health_check_interval,
                "ssl": self.config.tls_enabled,
                "ssl_cert_reqs": ssl.CERT_REQUIRED if self.config.tls_enabled else None,
                "ssl_check_hostname": self.config.ssl_check_hostname if self.config.tls_enabled else None,
            }
            if self.config.tls_enabled and self.config.tls_servername:
                pool_kwargs["sni_servername"] = self.config.tls_servername

            self._pool = ConnectionPool(**{k: v for k, v in pool_kwargs.items() if v is not None})
            
            # Redis 클라이언트 생성
            self._client = redis.Redis(
                connection_pool=self._pool,
                decode_responses=self.config.decode_responses,
            )
            
            # 연결 테스트
            self._client.ping()
            
        except Exception as e:
            raise ConnectionError(f"Redis 연결 실패: {e}") from e
    
    async def close(self) -> None:
        """연결 종료"""
        if self._client:
            try:
                if self._pool:
                    self._pool.disconnect()
            except Exception:
                pass
            finally:
                self._client = None
                self._pool = None
                self._health_status = False
    
    async def _ensure_client(self) -> redis.Redis:
        """클라이언트 확인 (지연 초기화)"""
        if self._client is None:
            await self.initialize()
        return self._client
    
    async def health_check(self) -> bool:
        """연결 상태 확인 (5초 캐싱)"""
        current_time = time.time()
        
        # 5초 캐싱 (PostgreSQL과 동일)
        if current_time - self._last_health_check < 5:
            return self._health_status
            
        try:
            client = await self._ensure_client()
            response = client.ping()
            self._health_status = response is True
        except (ConnectionError, TimeoutError):
            self._health_status = False
        except Exception:
            self._health_status = False
        finally:
            self._last_health_check = current_time
            
        return self._health_status
    
    # ========== 필수 Redis 작업 ==========
    
    async def get(self, key: str) -> Optional[str]:
        """키 조회"""
        try:
            client = await self._ensure_client()
            return client.get(key)
        except Exception:
            return None
    
    async def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        """키 설정"""
        try:
            client = await self._ensure_client()
            result = client.set(key, value, ex=ex)
            return result is True
        except Exception:
            return False
    
    async def delete(self, *keys: str) -> int:
        """키 삭제"""
        try:
            client = await self._ensure_client()
            return client.delete(*keys)
        except Exception:
            return 0
    
    async def exists(self, key: str) -> bool:
        """키 존재 확인"""
        try:
            client = await self._ensure_client()
            return client.exists(key) > 0
        except Exception:
            return False
    
    async def expire(self, key: str, seconds: int) -> bool:
        """TTL 설정"""
        try:
            client = await self._ensure_client()
            return client.expire(key, seconds)
        except Exception:
            return False

    async def execute(self, *args: Any) -> Any:
        """원시 명령 실행 (벡터 인덱스 등 모듈 명령용)"""
        try:
            client = await self._ensure_client()
            return client.execute_command(*args)
        except Exception as e:
            raise e
    
    # ========== 컨텍스트 매니저 지원 ==========
    
    async def __aenter__(self):
        """비동기 컨텍스트 매니저 진입"""
        await self.initialize()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """비동기 컨텍스트 매니저 종료"""
        await self.close()
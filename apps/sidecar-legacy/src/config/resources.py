"""
리소스 설정 관리 모듈
PostgreSQL, Redis 등 외부 리소스 연결 설정을 관리합니다.
"""

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class LoggingConfig:
    """간소화된 Logging(OpenTelemetry) 설정"""
    service_name: str
    service_version: str = "1.0.0"
    environment: str = "development"
    otlp_endpoint: Optional[str] = None
    enable_console_export: bool = False
    auto_instrumentation: bool = True
    metric_export_interval: int = 30000
    exporter_otlp_timeout: int = 30000
    
    def __post_init__(self):
        """설정 검증"""
        if not self.service_name:
            raise ValueError("Service name이 필요합니다")
        
        # environment 검증
        valid_environments = ["development", "production", "staging", "test"]
        if self.environment not in valid_environments:
            raise ValueError(f"지원하지 않는 environment: {self.environment}. 지원되는 환경: {valid_environments}")

    @classmethod
    def from_env(cls) -> 'LoggingConfig':
        """환경변수로부터 설정 생성"""
        return cls(
            service_name=os.getenv("OTEL_SERVICE_NAME", "arcsolve-sidecar"),
            service_version=os.getenv("OTEL_SERVICE_VERSION", "1.0.0"),
            environment=os.getenv("ENVIRONMENT", "development"),
            otlp_endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
            enable_console_export=os.getenv("OTEL_CONSOLE_EXPORT", "false").lower() == "true",
            auto_instrumentation=os.getenv("OTEL_AUTO_INSTRUMENTATION", "true").lower() == "true",
            metric_export_interval=int(os.getenv("OTEL_METRIC_EXPORT_INTERVAL", "30000")),
            exporter_otlp_timeout=int(os.getenv("OTEL_EXPORTER_OTLP_TIMEOUT", "30000"))
        )

@dataclass
class PostgreSQLConfig:
    """PostgreSQL 연결 설정 (PG_* 전용)"""
    host: str
    port: int
    user: str
    password: Optional[str]
    database: str
    max_connections: int = 100
    min_connections: int = 10
    command_timeout: float = 60.0
    statement_cache_size: int = 1024
    ssl_reject_unauthorized: bool = True
    ssl_servername: Optional[str] = None
    
    def __post_init__(self):
        """설정 검증"""
        if not self.host or not self.port:
            raise ValueError("PostgreSQL host/port가 필요합니다")
        if not self.user:
            raise ValueError("PostgreSQL user가 필요합니다")
        if not self.database:
            raise ValueError("PostgreSQL database가 필요합니다")
        # 설정 완료 로그 제거 - 핵심 로직 아님

@dataclass  
class RedisConfig:
    """Redis 연결 설정 (REDIS_* 전용)"""
    host: str
    port: int
    password: Optional[str] = None
    tls_enabled: bool = False
    tls_servername: Optional[str] = None
    max_connections: int = 50
    decode_responses: bool = False
    socket_timeout: int = 5
    socket_connect_timeout: int = 5
    retry_on_timeout: bool = True
    health_check_interval: int = 30
    ssl_check_hostname: bool = True
    
    def __post_init__(self):
        """설정 검증"""
        if not self.host or not self.port:
            raise ValueError("Redis host/port가 필요합니다")
        # 설정 완료 로그 제거 - 핵심 로직 아님

@dataclass
class R2Config:
    """Cloudflare R2 Object Storage 연결 설정"""
    account_id: str
    access_key_id: str
    secret_access_key: str
    region: str = "auto"
    default_bucket: Optional[str] = None
    max_retry_attempts: int = 3
    
    def __post_init__(self):
        """설정 검증"""
        if not self.account_id or not self.access_key_id or not self.secret_access_key:
            raise ValueError("R2 account_id, access_key_id, secret_access_key가 필요합니다")
        # 설정 완료 로그 제거 - 핵심 로직 아님

@dataclass
class ResourceConfig:
    """전체 리소스 설정 통합 클래스"""
    logging: LoggingConfig
    postgresql: PostgreSQLConfig
    redis: RedisConfig
    r2: Optional[R2Config] = None
    
    @classmethod
    def from_env(cls) -> 'ResourceConfig':
        """환경변수로부터 설정 생성"""
        try:
            # Logging 설정
            logging_config = LoggingConfig.from_env()
            
            # PG_*만 사용 (레거시 POSTGRES_* 제거)
            postgresql_config = PostgreSQLConfig(
                host=os.getenv("PG_HOST", "127.0.0.1"),
                port=int(os.getenv("PG_PORT", "15432")),
                user=os.getenv("PG_USER", "postgres"),
                password=os.getenv("PG_PASSWORD", "postgres"),
                database=os.getenv("PG_DATABASE", "arcsolve"),
                max_connections=int(os.getenv("PG_MAX_CONNECTIONS", "100")),
                min_connections=int(os.getenv("PG_MIN_CONNECTIONS", "10")),
                command_timeout=float(os.getenv("PG_COMMAND_TIMEOUT", "60.0")),
                statement_cache_size=int(os.getenv("PG_STATEMENT_CACHE_SIZE", "1024")),
                ssl_reject_unauthorized=os.getenv("PG_SSL_REJECT_UNAUTHORIZED", "true").lower() in ("true", "1", "yes"),
                ssl_servername=os.getenv("PG_SSL_SERVERNAME", "pg.arcsolve.ai")
            )
            
            redis_config = RedisConfig(
                host=os.getenv("REDIS_HOST", "127.0.0.1"),
                port=int(os.getenv("REDIS_PORT", "16380")),
                password=os.getenv("REDIS_PASSWORD", "arcsolve"),
                tls_enabled=os.getenv("REDIS_TLS_ENABLED", "true").lower() in ("true", "1", "yes"),
                tls_servername=os.getenv("REDIS_TLS_SERVERNAME", "redis.arcsolve.ai"),
                max_connections=int(os.getenv("REDIS_MAX_CONNECTIONS", "50")),
                decode_responses=os.getenv("REDIS_DECODE_RESPONSES", "false").lower() == "true",
                socket_timeout=int(os.getenv("REDIS_SOCKET_TIMEOUT", "5")),
                socket_connect_timeout=int(os.getenv("REDIS_SOCKET_CONNECT_TIMEOUT", "5")),
                retry_on_timeout=os.getenv("REDIS_RETRY_ON_TIMEOUT", "true").lower() == "true",
                health_check_interval=int(os.getenv("REDIS_HEALTH_CHECK_INTERVAL", "30")),
                ssl_check_hostname=os.getenv("REDIS_SSL_CHECK_HOSTNAME", "true").lower() == "true"
            )
            
            # R2 설정 (선택사항)
            r2_config = None
            if os.getenv("R2_ACCOUNT_ID") and os.getenv("R2_ACCESS_KEY_ID") and os.getenv("R2_SECRET_ACCESS_KEY"):
                r2_config = R2Config(
                    account_id=os.getenv("R2_ACCOUNT_ID"),
                    access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
                    secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
                    region=os.getenv("R2_REGION", "auto"),
                    default_bucket=os.getenv("R2_DEFAULT_BUCKET") or os.getenv("R2_BUCKET_NAME"),
                    max_retry_attempts=int(os.getenv("R2_MAX_RETRY_ATTEMPTS", "3"))
                )
            
            # 설정 생성 로그 제거 - 핵심 로직 아님
            return cls(logging=logging_config, postgresql=postgresql_config, redis=redis_config, r2=r2_config)
            
        except Exception as e:
            raise RuntimeError(f"리소스 설정 초기화 실패: {e}") from e
    
    def validate(self) -> bool:
        """설정값 유효성 검증"""
        try:
            # Logging 설정 검증
            if not self.logging.service_name:
                raise ValueError("Service name이 필요합니다")
            
            # PostgreSQL 기본 값 검증
            if not self.postgresql.host or not self.postgresql.port:
                raise ValueError("올바르지 않은 PostgreSQL host/port")
            
            # Redis 기본 값 검증  
            if not self.redis.host or not self.redis.port:
                raise ValueError("올바르지 않은 Redis host/port")
            
            # R2 설정 검증 (선택사항이므로 존재할 때만)
            if self.r2:
                if not self.r2.region in ["auto", "wnam", "enam", "weur", "eeur", "apac"]:
                    raise ValueError("올바르지 않은 R2 region")
                
            # 검증 완료 로그 제거 - 핵심 로직 아님
            return True
            
        except Exception:
            return False

# 전역 설정 인스턴스
try:
    resource_config = ResourceConfig.from_env()
    if not resource_config.validate():
        raise RuntimeError("리소스 설정 검증 실패")
except Exception as e:
    raise
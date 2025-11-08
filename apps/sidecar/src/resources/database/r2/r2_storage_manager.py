"""
R2 Storage Manager (통일된 네이밍)
필수 기능만 포함: 연결, 업로드/다운로드, 헬스체크
"""

import time
from typing import Optional, Any, Dict
import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError, BotoCoreError

from src.config.resources import R2Config
from src.resources.logging import trace_class


@trace_class
class R2StorageManager:
    """R2 스토리지 매니저 - 필수 기능만 포함"""
    
    def __init__(self, config: R2Config):
        self.config = config
        self._client: Optional[boto3.client] = None
        self._last_health_check = 0
        self._health_status = False
        
        # R2 endpoint URL 구성
        self.endpoint_url = f"https://{config.account_id}.r2.cloudflarestorage.com"
    
    async def initialize(self) -> None:
        """S3 클라이언트 초기화 (PostgreSQL과 동일 패턴)"""
        if self._client is not None:
            return
            
        try:
            # Boto3 설정
            boto_config = BotoConfig(
                signature_version='s3v4',
                region_name=self.config.region,
                retries={
                    'max_attempts': self.config.max_retry_attempts,
                    'mode': 'standard'
                }
            )
            
            # S3 클라이언트 생성 (R2용)
            self._client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.config.access_key_id,
                aws_secret_access_key=self.config.secret_access_key,
                config=boto_config
            )
            
            # 연결 테스트
            if hasattr(self.config, 'default_bucket') and self.config.default_bucket:
                self._client.head_bucket(Bucket=self.config.default_bucket)
                
        except Exception as e:
            raise ConnectionError(f"R2 연결 실패: {e}") from e
    
    async def close(self) -> None:
        """연결 종료"""
        # boto3는 자동으로 연결 해제를 처리
        self._client = None
        self._health_status = False
    
    async def _ensure_client(self) -> boto3.client:
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
            
            # 기본 버킷 헬스체크
            if hasattr(self.config, 'default_bucket') and self.config.default_bucket:
                client.head_bucket(Bucket=self.config.default_bucket)
            
            self._health_status = True
        except (ClientError, BotoCoreError):
            self._health_status = False
        except Exception:
            self._health_status = False
        finally:
            self._last_health_check = current_time
            
        return self._health_status
    
    # ========== 필수 R2 작업 ==========
    
    async def upload(
        self, 
        key: str, 
        data: Any,
        bucket: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None
    ) -> bool:
        """객체 업로드"""
        try:
            client = await self._ensure_client()
            
            # 버킷 결정
            bucket_name = bucket or self.config.default_bucket
            if not bucket_name:
                raise ValueError("버킷 이름 필요")
            
            # 메타데이터 설정
            extra_args = {}
            if metadata:
                extra_args['Metadata'] = metadata
            
            # 데이터 타입별 업로드
            if isinstance(data, (str, bytes)):
                client.put_object(
                    Bucket=bucket_name,
                    Key=key,
                    Body=data,
                    **extra_args
                )
            else:
                # 파일 경로인 경우
                client.upload_file(str(data), bucket_name, key, ExtraArgs=extra_args)
            
            return True
        except Exception:
            return False
    
    async def download(self, key: str, bucket: Optional[str] = None) -> Optional[bytes]:
        """객체 다운로드"""
        try:
            client = await self._ensure_client()
            
            # 버킷 결정
            bucket_name = bucket or self.config.default_bucket
            if not bucket_name:
                raise ValueError("버킷 이름 필요")
            
            response = client.get_object(Bucket=bucket_name, Key=key)
            return response['Body'].read()
        except ClientError:
            return None
        except Exception:
            return None
    
    async def delete(self, key: str, bucket: Optional[str] = None) -> bool:
        """객체 삭제"""
        try:
            client = await self._ensure_client()
            
            # 버킷 결정
            bucket_name = bucket or self.config.default_bucket
            if not bucket_name:
                raise ValueError("버킷 이름 필요")
            
            client.delete_object(Bucket=bucket_name, Key=key)
            return True
        except Exception:
            return False
    
    async def exists(self, key: str, bucket: Optional[str] = None) -> bool:
        """객체 존재 확인"""
        try:
            client = await self._ensure_client()
            
            # 버킷 결정
            bucket_name = bucket or self.config.default_bucket
            if not bucket_name:
                raise ValueError("버킷 이름 필요")
            
            client.head_object(Bucket=bucket_name, Key=key)
            return True
        except ClientError:
            return False
        except Exception:
            return False
    
    # ========== 컨텍스트 매니저 지원 ==========
    
    async def __aenter__(self):
        """비동기 컨텍스트 매니저 진입"""
        await self.initialize()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """비동기 컨텍스트 매니저 종료"""
        await self.close()
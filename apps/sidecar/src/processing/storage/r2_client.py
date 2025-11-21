"""
Cloudflare R2(S3 호환) 스토리지 유틸.

- R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME 환경변수를 사용합니다.
- 지정된 storage_key를 임시 디렉터리로 다운로드하는 헬퍼를 제공합니다.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import boto3


def _get_r2_config() -> tuple[str, str, str, str]:
    account_id = os.getenv("R2_ACCOUNT_ID")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket_name = os.getenv("R2_BUCKET_NAME")

    if not account_id or not access_key or not secret_key or not bucket_name:
        raise RuntimeError(
            "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME "
            "환경변수가 모두 설정되어 있어야 합니다.",
        )

    return account_id, access_key, secret_key, bucket_name


def _get_r2_client():
    account_id, access_key, secret_key, bucket_name = _get_r2_config()

    endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"

    client = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )

    return client, bucket_name


def download_to_temp(storage_key: str) -> Path:
    """
    지정된 storage_key를 임시 디렉터리로 다운로드하고, 로컬 파일 경로를 반환합니다.
    """
    client, bucket_name = _get_r2_client()

    tmp_dir = Path(tempfile.mkdtemp(prefix="arcsolve_r2_"))
    filename = Path(storage_key).name or "document"
    local_path = tmp_dir / filename

    with local_path.open("wb") as fp:
        client.download_fileobj(bucket_name, storage_key, fp)

    return local_path




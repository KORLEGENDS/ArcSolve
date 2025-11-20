import asyncio
import json
import os
import uuid
from typing import Any, Dict, Optional

import httpx

from src.resources.logging import get_tracer

tracer = get_tracer(__name__)


def _get_env(name: str, default: Optional[str] = None) -> Optional[str]:
    # ARCSOLVE_NEXT_CALLBACK_BASE의 기본값 설정
    if name == "ARCSOLVE_NEXT_CALLBACK_BASE" and default is None:
        default = "https://arcsolve.ai"
    
    value = os.environ.get(name, default)
    return value


def _build_callback_url(base: str, file_id: str) -> str:
    if base.endswith("/"):
        base = base[:-1]
    return f"{base}/api/file/{file_id}/parse/callback"


def _build_headers(file_id: str, token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "X-File-ID": str(file_id),
        "Content-Type": "application/json",
    }


def _build_succeeded_body(
    *,
    job_id: Optional[str],
    content: Optional[str],
    metrics: Optional[Dict[str, Any]],
    message: Optional[str],
) -> Dict[str, Any]:
    body: Dict[str, Any] = {
        "status": "succeeded",
    }
    body["jobId"] = job_id or str(uuid.uuid4())
    if metrics:
        body["metrics"] = metrics
    if message:
        body["message"] = message
    if content is not None:
        body["content"] = content
    return body


def _build_failed_body(
    *,
    job_id: Optional[str],
    reason: Optional[str],
    http_status: Optional[int],
    message: Optional[str],
    metrics: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    body: Dict[str, Any] = {
        "status": "failed",
    }
    body["jobId"] = job_id or str(uuid.uuid4())
    if reason:
        body["reason"] = reason
    if http_status is not None:
        body["httpStatus"] = int(http_status)
    if message:
        body["message"] = message
    if metrics:
        body["metrics"] = metrics
    return body


async def _post_with_retries(
    url: str,
    headers: Dict[str, str],
    body: Dict[str, Any],
    *,
    timeout_seconds: float = 10.0,
    max_attempts: int = 5,
    initial_backoff: float = 0.5,
) -> Optional[httpx.Response]:
    backoff = initial_backoff
    attempt = 0
    last_exc: Optional[Exception] = None
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        while attempt < max_attempts:
            try:
                resp = await client.post(url, headers=headers, content=json.dumps(body))
                # 2xx: success
                if 200 <= resp.status_code < 300:
                    return resp
                # 4xx: do not retry
                if 400 <= resp.status_code < 500:
                    return resp
                # 5xx: retry
                attempt += 1
                if attempt >= max_attempts:
                    return resp
                await asyncio.sleep(backoff)
                backoff *= 2
                continue
            except Exception as exc:  # network, TLS, timeout
                last_exc = exc
                attempt += 1
                if attempt >= max_attempts:
                    with tracer.start_as_current_span("callback_helper:post_error_final") as span:
                        span.record_exception(exc)
                        span.set_attribute("url", url)
                        span.set_attribute("attempt", attempt)
                    return None
                with tracer.start_as_current_span("callback_helper:post_error_retry") as span:
                    span.record_exception(exc)
                    span.set_attribute("url", url)
                    span.set_attribute("attempt", attempt)
                await asyncio.sleep(backoff)
                backoff *= 2
                continue


async def send_parse_callback_succeeded(
    *,
    file_id: str,
    job_id: Optional[str] = None,
    metrics: Optional[Dict[str, Any]] = None,
    content: Optional[str] = None,
    message: Optional[str] = None,
    base_override: Optional[str] = None,
    token_override: Optional[str] = None,
) -> Optional[int]:
    base = base_override or _get_env("ARCSOLVE_NEXT_CALLBACK_BASE")
    token = token_override or _get_env("SIDECAR_TOKEN")
    if not base or not token:
        with tracer.start_as_current_span("callback_helper:missing_config") as span:
            span.set_attribute("has_base", bool(base))
            span.set_attribute("has_token", bool(token))
        return None

    url = _build_callback_url(base, file_id)
    headers = _build_headers(file_id, token)
    body = _build_succeeded_body(job_id=job_id, content=content, metrics=metrics, message=message)
    # 단순 print 로깅: 성공 콜백 바디
    try:
        print("[Callback Succeeded Body]", json.dumps(body, ensure_ascii=False))
    except Exception:
        pass

    with tracer.start_as_current_span("callback_helper:send_succeeded") as span:
        span.set_attribute("file_id", str(file_id))
        span.set_attribute("job_id", body.get("jobId"))
        span.set_attribute("url", url)
    resp = await _post_with_retries(url, headers, body)
    try:
        print("[Callback Succeeded Resp]", resp.status_code if resp is not None else None)
    except Exception:
        pass
    return resp.status_code if resp is not None else None


async def send_parse_callback_failed(
    *,
    file_id: str,
    job_id: Optional[str] = None,
    reason: Optional[str] = None,
    http_status: Optional[int] = None,
    message: Optional[str] = None,
    metrics: Optional[Dict[str, Any]] = None,
    base_override: Optional[str] = None,
    token_override: Optional[str] = None,
) -> Optional[int]:
    base = base_override or _get_env("ARCSOLVE_NEXT_CALLBACK_BASE")
    token = token_override or _get_env("SIDECAR_TOKEN")
    if not base or not token:
        with tracer.start_as_current_span("callback_helper:missing_config") as span:
            span.set_attribute("has_base", bool(base))
            span.set_attribute("has_token", bool(token))
        return None

    url = _build_callback_url(base, file_id)
    headers = _build_headers(file_id, token)
    body = _build_failed_body(job_id=job_id, reason=reason, http_status=http_status, message=message, metrics=metrics)
    # 단순 print 로깅: 실패 콜백 바디
    try:
        print("[Callback Failed Body]", json.dumps(body, ensure_ascii=False))
    except Exception:
        pass

    with tracer.start_as_current_span("callback_helper:send_failed") as span:
        span.set_attribute("file_id", str(file_id))
        span.set_attribute("job_id", body.get("jobId"))
        span.set_attribute("url", url)
        span.set_attribute("reason", reason or "")
        if http_status is not None:
            span.set_attribute("http_status", int(http_status))
    resp = await _post_with_retries(url, headers, body)
    try:
        print("[Callback Failed Resp]", resp.status_code if resp is not None else None)
    except Exception:
        pass
    return resp.status_code if resp is not None else None



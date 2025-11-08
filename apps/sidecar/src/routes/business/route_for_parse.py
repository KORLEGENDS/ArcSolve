import asyncio
import io
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool

from src.config.resources import resource_config
from src.config.runtime import RuntimeState
from src.resources.logging import get_tracer
from src.resources.resource_provider import resource_provider
from src.resources.service.business.transcribe_manager import \
    OptimizedTranscribeManager
from src.routes.helpers.callback_helper import (send_parse_callback_failed,
                                                send_parse_callback_succeeded)
from src.routes.helpers.response_helper import (ERROR_TYPES, error_response,
                                                ok_response)

router = APIRouter(prefix="/api/v1", tags=["parse"]) 
tracer = get_tracer(__name__)

# 전역 전사 매니저(모델 재사용) - 자동감지 런타임 주입
_transcribe_manager = OptimizedTranscribeManager(runtime=RuntimeState.detect())

# 허용 MIME 타입 (문서 + 이미지 + 오디오/일부 비디오 + YouTube)
ALLOWED_MIME_TYPES = {
    # Document types
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    # Audio types
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/flac",
    "audio/x-flac",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/x-m4a",
    # Video (audio-only extraction allowed)
    "video/mp4",
    "video/webm",
    # YouTube indicator
    "video/youtube",
}
ALLOWED_MIME_PREFIXES = [
    "image/",  # PNG, JPEG, WEBP, GIF, TIFF 등
    "audio/",  # 모든 오디오 프리픽스 허용
]

@router.post("/parse")
async def parse_file_from_r2(request: Request):
    """
    R2에서 파일을 내려받아 파싱 후, files.content(JSONB)에 결과를 병합 저장.

    - R2 키 규칙: users/{userId}/files/{fileId}
    - 병합 키: content.markdown
    """
    # 0) 헤더 기반 식별자 확인 (미들웨어 주입)
    user_id = getattr(request.state, "user_id", None)
    file_id = getattr(request.state, "file_id", None)
    
    with tracer.start_as_current_span("parse_file_from_r2:init") as span:
        span.set_attribute("route", "/api/v1/parse")
        span.set_attribute("input.user_id", str(user_id) if user_id else "")
        span.set_attribute("input.file_id", str(file_id) if file_id else "")
        if not user_id or not file_id:
            span.add_event(
                "missing_headers",
                {
                    "error.kind": "validation",
                    "missing": json.dumps(
                        {
                            "user_id": bool(user_id),
                            "file_id": bool(file_id),
                        }
                    ),
                },
            )
            return error_response(
                request,
                status_code=400,
                title="Missing headers",
                detail="X-User-ID, X-File-ID 필요",
                type_=ERROR_TYPES.MISSING_HEADERS,
            )

    # 0-1) 본문(JSON) 파싱 및 storageKey/mimeType/옵션 확보
    body: Dict[str, Any] = {}
    storage_key: Optional[str] = None
    mime_type: Optional[str] = None
    options: Dict[str, Any] = {}
    usage: Dict[str, Any] = {}

    try:
        body = await request.json()
    except Exception:
        body = {}

    if isinstance(body, dict):
        file_obj = body.get("file") if isinstance(body.get("file"), dict) else {}
        storage_key_raw = (
            file_obj.get("storageKey") if isinstance(file_obj, dict) else None
        )
        mime_type = file_obj.get("mimeType") if isinstance(file_obj, dict) else None
        if isinstance(storage_key_raw, str) and storage_key_raw:
            # 버킷 없이 순수 Key 문자열을 그대로 사용
            storage_key = storage_key_raw
        options = body.get("options") if isinstance(body.get("options"), dict) else {}
        usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}

    # 사용량/배수 기본 검증 (없으면 사후 판정으로 폴백 가능하나, 여기서는 400 권장)
    if not isinstance(usage, dict) or not isinstance(usage.get("costMultipliers"), dict):
        return error_response(
            request,
            status_code=400,
            title="Invalid usage",
            detail="usage.remainingTokens 및 usage.costMultipliers 필요",
            type_=ERROR_TYPES.INVALID_BODY,
        )

    # mimeType 검증
    if mime_type is None:
        return error_response(
            request,
            status_code=400,
            title="Invalid mimeType",
            detail=f"지원하지 않는 mimeType: {mime_type}",
            type_=ERROR_TYPES.INVALID_MIME,
        )

    mime_lower = str(mime_type).lower()
    is_youtube = mime_lower == "video/youtube"
    allowed = (mime_lower in ALLOWED_MIME_TYPES) or any(mime_lower.startswith(p) for p in ALLOWED_MIME_PREFIXES)
    if not allowed:
        return error_response(
            request,
            status_code=400,
            title="Invalid mimeType",
            detail=f"지원하지 않는 mimeType: {mime_type}",
            type_=ERROR_TYPES.INVALID_MIME,
        )

    # 1) DB에서 파일 존재 확인 및 상태: processing 설정
    pg = await resource_provider.database.get_postgresql(resource_config.postgresql)
    # 즉시 PG 헬스 확인(연결 오류 조기 노출)
    try:
        await pg.health_check()
    except Exception as e:
        with tracer.start_as_current_span("parse_file_from_r2:pg_health_check") as span:
            span.record_exception(e)
        return error_response(
            request,
            status_code=503,
            title="Database Unavailable",
            detail=f"데이터베이스 연결 실패: {str(e)}",
            type_=ERROR_TYPES.DB_SELECT_FAILED,
        )
    
    try:
        row = await pg.fetchrow(
            "SELECT id FROM files WHERE id = %s AND user_id = %s",
            file_id,
            user_id,
        )
        
    except Exception as e:
        with tracer.start_as_current_span("parse_pdf_from_r2:db_select") as span:
            span.record_exception(e)
        return error_response(
            request,
            status_code=500,
            title="DB Error",
            detail=f"파일 조회 실패: {type(e).__name__}: {str(e)}",
            type_=ERROR_TYPES.DB_SELECT_FAILED,
        )
    if row is None:
        with tracer.start_as_current_span("parse_pdf_from_r2:db_not_found") as span:
            span.add_event("file_not_found", {"file_id": str(file_id), "user_id": str(user_id)})
        return error_response(
            request,
            status_code=404,
            title="File Not Found",
            detail="해당 파일 메타데이터를 찾을 수 없습니다",
            type_=ERROR_TYPES.FILE_NOT_FOUND,
        )
    # 메인 서버가 상태를 관리하므로 사이드카에서의 상태 갱신은 수행하지 않음

    # 1-1) 옵션 매핑 (YT/오디오 공통)
    def _get_first(d: Dict[str, Any], keys: list[str]):
        for k in keys:
            if k in d and d[k] is not None:
                return d[k]
        return None

    language = _get_first(options, ["language"])  # type: ignore[assignment]
    prefer_subtitles_opt = _get_first(options, ["prefer_subtitles", "preferSubtitles"])  # type: ignore[assignment]

    # 1-2) 유튜브 분기: R2 다운로드 생략, URL 직접 전사 (선검증 포함)
    if is_youtube:
        if not storage_key:
            return error_response(
                request,
                status_code=400,
                title="Missing storageKey",
                detail="YouTube URL(storageKey) 필요",
                type_=ERROR_TYPES.MISSING_STORAGE_KEY,
            )
        # Preflight (YouTube): 자막 존재 시 0, 없으면 길이 기반 추정
        try:
            pf = await _transcribe_manager.preflight_transcribe_youtube(
                storage_key,
                prefer_subtitles=True if prefer_subtitles_opt is None else bool(prefer_subtitles_opt),
                usage=usage,
            )
        except Exception:
            pf = {"estimatedTokenCount": 0, "canProceed": True}
        if not bool(pf.get("canProceed", True)):
            # 부족 콜백 + 409/402 반환
            try:
                await send_parse_callback_failed(
                    file_id=str(file_id),
                    reason="insufficient_tokens",
                    http_status=402,
                    message="사용 가능한 토큰이 부족합니다",
                    metrics={"tokenCount": int(pf.get("estimatedTokenCount") or 0)},
                )
            except Exception:
                pass
            return error_response(
                request,
                status_code=402,
                title="Insufficient Tokens",
                detail="사용 가능한 토큰이 부족합니다",
                type_=ERROR_TYPES.PARSE_FAILED,
            )
        try:
            result: Dict[str, Any] = await _transcribe_manager.transcribe_youtube(
                storage_key,
                prefer_subtitles=True if prefer_subtitles_opt is None else bool(prefer_subtitles_opt),
                language=language,
            )
        except Exception as e:
            with tracer.start_as_current_span("parse_file_from_r2:youtube_error") as span:
                span.record_exception(e)
            # 실패 콜백: 유튜브 전사 실패
            try:
                await send_parse_callback_failed(
                    file_id=str(file_id),
                    reason=str(ERROR_TYPES.PARSE_FAILED),
                    http_status=500,
                    message=f"유튜브 전사 실패: {str(e)}",
                )
            except Exception:
                pass
            return error_response(
                request,
                status_code=500,
                title="YouTube Transcription Error",
                detail=f"유튜브 전사 실패: {str(e)}",
                type_=ERROR_TYPES.PARSE_FAILED,
            )

        # 공통 DB 업데이트: content(text) + segments(jsonb)
        try:
            segs: list[Dict[str, Any]] = result.get("segments", []) if isinstance(result, dict) else []
            content_text = "\n".join([str(s.get("text", "")) for s in segs])
            await pg.execute(
                """
                UPDATE files
                SET 
                    content = %s::text,
                    segments = %s::jsonb,
                    layout = NULL
                WHERE id = %s
                """,
                content_text,
                json.dumps(segs),
                file_id,
            )
        except Exception as e:
            with tracer.start_as_current_span("parse_file_from_r2:db_update_error") as span:
                span.record_exception(e)
            # 실패 콜백: DB 업데이트 실패
            try:
                await send_parse_callback_failed(
                    file_id=str(file_id),
                    reason=ERROR_TYPES.DB_UPDATE_FAILED,
                    http_status=500,
                    message=f"업데이트 실패: {type(e).__name__}: {str(e)}",
                )
            except Exception:
                pass
            return error_response(
                request,
                status_code=500,
                title="DB Update Error",
                detail=f"업데이트 실패: {type(e).__name__}: {str(e)}",
                type_=ERROR_TYPES.DB_UPDATE_FAILED,
            )

        # 성공 콜백: 전사 완료 (tokenCount 계산 포함)
        try:
            duration_sec = float(result.get("duration") or 0.0) if isinstance(result, dict) else 0.0
            used_subtitles = bool(result.get("used_subtitles")) if isinstance(result, dict) else False
            if used_subtitles:
                tokens_used = 0
            else:
                # Fireworks 응답의 duration 기반으로만 산출
                import math
                per_min = int((usage.get("costMultipliers") or {}).get("perAudioMinute", 9))
                tokens_used = max(0, int(math.ceil(max(0.0, duration_sec) / 60.0)) * per_min)
            cb_status = await send_parse_callback_succeeded(
                file_id=str(file_id),
                metrics={
                    # 콜백 스키마에 맞춰 최소 필드만 전송
                    "contentLength": len(content_text or ""),
                    "tokenCount": tokens_used,
                },
                message="parsed successfully",
            )
            try:
                with tracer.start_as_current_span("parse_file_from_r2:callback_succeeded_status") as span:
                    span.set_attribute("callback.status", int(cb_status) if cb_status is not None else -1)
            except Exception:
                pass
        except Exception:
            pass

        return ok_response(
            request,
            data={
                "fileId": file_id,
                "updated": True,
                "segmentCount": len(result.get("segments", [])) if isinstance(result, dict) else 0,
                "language": result.get("language") if isinstance(result, dict) else None,
            },
            message="오디오 전사 및 저장(content + segments) 완료",
        )

    # 2) R2에서 파일 다운로드 (오디오/문서 공통)
    r2 = await resource_provider.database.get_r2(resource_config.r2)
    # storageKey가 유효하면 우선 사용, 아니면 기존 규칙으로 폴백
    if storage_key:
        r2_key = storage_key
    else:
        r2_key = f"users/{user_id}/files/{file_id}"
    
    try:
        file_bytes = await r2.download(r2_key)
    except Exception as e:
        with tracer.start_as_current_span("parse_file_from_r2:r2_download_error") as span:
            span.record_exception(e)
            span.set_attribute("r2.key", r2_key)
        # 실패 콜백
        await send_parse_callback_failed(
            file_id=str(file_id),
            reason=ERROR_TYPES.STORAGE_DOWNLOAD_FAILED,
            http_status=500,
            message=f"R2 download error: {str(e)}",
        )
        return error_response(
            request,
            status_code=500,
            title="R2 Download Error",
            detail=f"R2에서 파일을 다운로드하는 중 오류가 발생했습니다: {str(e)}",
            type_=ERROR_TYPES.STORAGE_DOWNLOAD_FAILED,
        )
    if not file_bytes:
        with tracer.start_as_current_span("parse_file_from_r2:r2_not_found") as span:
            span.add_event("r2_object_missing", {"r2.key": r2_key})
        # 실패 콜백
        await send_parse_callback_failed(
            file_id=str(file_id),
            reason=ERROR_TYPES.STORAGE_NOT_FOUND,
            http_status=404,
            message="R2에 해당 파일이 존재하지 않습니다",
        )
        return error_response(
            request,
            status_code=404,
            title="Not Found",
            detail="R2에 해당 파일이 존재하지 않습니다",
            type_=ERROR_TYPES.STORAGE_NOT_FOUND,
        )

    # 3) 분기: 오디오 전사 vs 문서 파싱
    is_asr_media = (
        mime_lower in {
            "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/flac", "audio/x-flac",
            "audio/webm", "audio/ogg", "audio/mp4", "audio/x-m4a", "video/mp4", "video/webm"
        }
        or mime_lower.startswith("audio/")
    )

    if is_asr_media:
        # 3-A) 선검증 (오디오 길이 기반)
        try:
            pf = await _transcribe_manager.preflight_transcribe_bytes(
                file_bytes,
                usage=usage,
            )
        except Exception:
            pf = {"estimatedTokenCount": 0, "canProceed": True}
        if not bool(pf.get("canProceed", True)):
            try:
                await send_parse_callback_failed(
                    file_id=str(file_id),
                    reason="insufficient_tokens",
                    http_status=402,
                    message="사용 가능한 토큰이 부족합니다",
                    metrics={"tokenCount": int(pf.get("estimatedTokenCount") or 0)},
                )
            except Exception:
                pass
            return error_response(
                request,
                status_code=402,
                title="Insufficient Tokens",
                detail="사용 가능한 토큰이 부족합니다",
                type_=ERROR_TYPES.PARSE_FAILED,
            )
        # 3-A) 전사 실행
        try:
            result: Dict[str, Any] = await _transcribe_manager.transcribe_bytes(
                file_bytes,
                language=language,
            )
        except Exception as e:
            with tracer.start_as_current_span("parse_file_from_r2:asr_error") as span:
                span.record_exception(e)
            # 실패 콜백: 일반 오디오 전사 실패
            try:
                await send_parse_callback_failed(
                    file_id=str(file_id),
                    reason=ERROR_TYPES.PARSE_FAILED,
                    http_status=500,
                    message=f"오디오 전사 실패: {str(e)}",
                )
            except Exception:
                pass
            return error_response(
                request,
                status_code=500,
                title="Transcription Error",
                detail=f"오디오 전사 실패: {str(e)}",
                type_=ERROR_TYPES.PARSE_FAILED,
            )

        # 3-B) DB 업데이트: content(text) + segments(jsonb)
        try:
            segs: list[Dict[str, Any]] = result.get("segments", []) if isinstance(result, dict) else []
            content_text = "\n".join([str(s.get("text", "")) for s in segs])
            await pg.execute(
                """
                UPDATE files
                SET 
                    content = %s::text,
                    segments = %s::jsonb,
                    layout = NULL
                WHERE id = %s
                """,
                content_text,
                json.dumps(segs),
                file_id,
            )
        except Exception as e:
            with tracer.start_as_current_span("parse_file_from_r2:db_update_error") as span:
                span.record_exception(e)
            # 실패 콜백: DB 업데이트 실패
            try:
                await send_parse_callback_failed(
                    file_id=str(file_id),
                    reason=ERROR_TYPES.DB_UPDATE_FAILED,
                    http_status=500,
                    message=f"업데이트 실패: {type(e).__name__}: {str(e)}",
                )
            except Exception:
                pass
            return error_response(
                request,
                status_code=500,
                title="DB Update Error",
                detail=f"업데이트 실패: {type(e).__name__}: {str(e)}",
                type_=ERROR_TYPES.DB_UPDATE_FAILED,
            )

        # 성공 콜백: 전사 완료 (tokenCount 계산 포함)
        try:
            duration_sec = float(result.get("duration") or 0.0) if isinstance(result, dict) else 0.0
            # Fireworks 응답의 duration 기반으로만 산출
            import math
            per_min = int((usage.get("costMultipliers") or {}).get("perAudioMinute", 9))
            tokens_used = max(0, int(math.ceil(max(0.0, duration_sec) / 60.0)) * per_min)
            cb_status = await send_parse_callback_succeeded(
                file_id=str(file_id),
                metrics={
                    # 콜백 스키마에 맞춰 최소 필드만 전송
                    "contentLength": len(content_text or ""),
                    "tokenCount": tokens_used,
                },
                message="transcribed successfully",
            )
            try:
                with tracer.start_as_current_span("parse_file_from_r2:callback_succeeded_status") as span:
                    span.set_attribute("callback.status", int(cb_status) if cb_status is not None else -1)
            except Exception:
                pass
        except Exception:
            pass

        return ok_response(
            request,
            data={
                "fileId": file_id,
                "updated": True,
                "segmentCount": len(result.get("segments", [])) if isinstance(result, dict) else 0,
                "language": result.get("language") if isinstance(result, dict) else None,
            },
            message="오디오 전사 및 저장(content + segments) 완료",
        )

    # 3-C) 문서 파싱 경로 (ENV 토글 기반 API/로컬 선택)
    try:
        parser = await resource_provider.service.get_parser()
        # 선검증: 페이지 기반 예상 토큰
        try:
            pf = await run_in_threadpool(lambda: parser.preflight_parse(file_bytes, usage=usage))
        except Exception:
            pf = {"estimatedTokenCount": 0, "canProceed": True}
        if not bool(pf.get("canProceed", True)):
            try:
                await send_parse_callback_failed(
                    file_id=str(file_id),
                    reason="insufficient_tokens",
                    http_status=402,
                    message="사용 가능한 토큰이 부족합니다",
                    metrics={"tokenCount": int(pf.get("estimatedTokenCount") or 0)},
                )
            except Exception:
                pass
            return error_response(
                request,
                status_code=402,
                title="Insufficient Tokens",
                detail="사용 가능한 토큰이 부족합니다",
                type_=ERROR_TYPES.PARSE_FAILED,
            )
        with tracer.start_as_current_span("parse_file_from_r2:parse_document") as span:
            json_doc, full_markdown = await run_in_threadpool(lambda: parser.parse_bytes_auto(file_bytes))
            span.set_attribute("output.markdown_length", len(full_markdown) if isinstance(full_markdown, str) else 0)
    except Exception as e:
        with tracer.start_as_current_span("parse_file_from_r2:parse_error") as span:
            span.record_exception(e)
        # 실패 콜백
        await send_parse_callback_failed(
            file_id=str(file_id),
            reason=ERROR_TYPES.PARSE_FAILED,
            http_status=500,
            message=f"파일 파싱 실패: {str(e)}",
        )
        return error_response(
            request,
            status_code=500,
            title="Parse Error",
            detail=f"파일 파싱 실패: {str(e)}",
            type_=ERROR_TYPES.PARSE_FAILED,
        )

    try:
        # 파싱 결과 준비 (전문 Markdown 및 최소 오버레이 레이아웃)
        raw_markdown = full_markdown if isinstance(full_markdown, str) else ""
        # 저장 전 마크다운 정제와 레이아웃 생성 병렬 실행
        with tracer.start_as_current_span("parse_file_from_r2:build_layout") as span:
            clean_task = run_in_threadpool(lambda: parser.clean_markdown_remove_raw_html(raw_markdown))
            layout_task = run_in_threadpool(lambda: parser.build_layout_from_json(json_doc))
            clean_result, layout_result = await asyncio.gather(clean_task, layout_task, return_exceptions=True)
            if isinstance(clean_result, Exception):
                cleaned_markdown = raw_markdown
            else:
                cleaned_markdown = clean_result
            if isinstance(layout_result, Exception):
                raise layout_result
            minimal_layout = layout_result
        try:
            stats = minimal_layout.get("stats", {}) if isinstance(minimal_layout, dict) else {}
        except Exception:
            pass
        # 메타데이터용: 매니저 메서드로 일원화 계산
        metrics = await run_in_threadpool(
            lambda: parser.calculate_metrics(
                cleaned_markdown if isinstance(cleaned_markdown, str) else "",
                minimal_layout,
            )
        )
        # 문서 경로 과금 토큰은 페이지×배수(perPage)로 일관화
        try:
            per_page = int((usage.get("costMultipliers") or {}).get("perPage", 40))
        except Exception:
            per_page = 40
        try:
            page_count_for_billing = int(metrics.get("pageCount", 0)) if isinstance(metrics, dict) else 0
        except Exception:
            page_count_for_billing = 0
        tokens_used_billing = max(0, int(per_page) * int(page_count_for_billing))
        # 단순 print 로깅
        try:
            print("[DOC Billing] fileId=", file_id,
                  " page_count=", page_count_for_billing,
                  " per_page=", per_page,
                  " tokenCount=", tokens_used_billing)
        except Exception:
            pass
    except Exception as e:
        with tracer.start_as_current_span("parse_file_from_r2:build_layout_error") as span:
            span.record_exception(e)
        # 실패 콜백: 레이아웃/메트릭 생성 실패
        try:
            await send_parse_callback_failed(
                file_id=str(file_id),
                reason=ERROR_TYPES.PARSE_FAILED,
                http_status=500,
                message=f"레이아웃/메트릭 생성 실패: {type(e).__name__}: {str(e)}",
            )
        except Exception:
            pass
        return error_response(
            request,
            status_code=500,
            title="Build Layout Error",
            detail=f"레이아웃/메트릭 생성 실패: {type(e).__name__}: {str(e)}",
            type_=ERROR_TYPES.PARSE_FAILED,
        )

    # content/metadata/layout 단일 UPDATE 저장
    try:
        await pg.execute(
            """
            UPDATE files
            SET 
                content = %s::text,
                metadata = (
                    COALESCE(
                        CASE WHEN jsonb_typeof(metadata) = 'object' THEN metadata ELSE '{}'::jsonb END,
                        '{}'::jsonb
                    ) || jsonb_build_object(
                        'contentLength', %s::int,
                        'pageCount', %s::int,
                        'tokenCount', %s::int
                    )
                ),
                layout = %s::jsonb,
                segments = NULL
            WHERE id = %s
            """,
            cleaned_markdown,
            metrics.get("contentLength", 0),
            metrics.get("pageCount", 0),
            tokens_used_billing,
            json.dumps(minimal_layout),
            file_id,
        )
        # 성공 콜백 전송 (메트릭)
        await send_parse_callback_succeeded(
            file_id=str(file_id),
            metrics={
                "contentLength": int(metrics.get("contentLength", 0)),
                "pageCount": int(metrics.get("pageCount", 0)),
                "tokenCount": int(tokens_used_billing),
            },
            message="parsed successfully",
        )
    except Exception as e:
        # DB 업데이트 실패 시
        with tracer.start_as_current_span("parse_file_from_r2:db_update_error") as span:
            span.record_exception(e)
        # 실패 콜백
        await send_parse_callback_failed(
            file_id=str(file_id),
            reason=ERROR_TYPES.DB_UPDATE_FAILED,
            http_status=500,
            message=f"업데이트 실패: {type(e).__name__}: {str(e)}",
            metrics=metrics,
        )
        return error_response(
            request,
            status_code=500,
            title="DB Update Error",
            detail=f"업데이트 실패: {type(e).__name__}: {str(e)}",
            type_=ERROR_TYPES.DB_UPDATE_FAILED,
        )

    with tracer.start_as_current_span("parse_file_from_r2:done") as span:
        span.set_attribute("output.file_id", str(file_id))
        span.set_attribute(
            "output.layout_pages",
            int(minimal_layout.get("stats", {}).get("pages", 0)),
        )
    response_data = {
        "fileId": file_id,
        "updated": True,
        "layoutPages": minimal_layout.get("stats", {}).get("pages", 0),
    }
    
    return ok_response(
        request,
        data=response_data,
        message="파일 파싱 및 저장(markdown + minimal layout) 완료",
    )
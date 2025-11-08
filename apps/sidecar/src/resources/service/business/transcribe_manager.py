"""
Transcribe Manager (Fireworks API 전용)

로컬 전사(faster-whisper) 경로를 제거하고, Fireworks Audio Transcriptions API만 사용합니다.
YouTube는 자막이 있으면 자막을 사용하고, 없으면 오디오를 내려 Fireworks API로 전사합니다.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from src.config.runtime import RuntimeState
from src.config.services import service_config
from src.resources.service.business.utils.normalizer import NormalizerConfig
from src.resources.service.business.utils.normalizer import \
    normalize as normalize_cues_to_segments


class OptimizedTranscribeManager:
    """Fireworks API 전용 음성 전사 매니저"""

    # 중복 사용되는 우선순위 상수(단일화)
    DEFAULT_LANGUAGES_PRIORITY: List[str] = ["ko", "en", "en-US", "en-GB", "en-UK"]
    # (자막 포맷 선호 목록 제거됨: youtube-transcript-api만 시도)

    def __init__(self, runtime: RuntimeState | None = None) -> None:
        self.config = service_config.transcribe
        self.runtime = runtime or RuntimeState.detect()

    # (로컬 모델/배치 파이프라인은 제거되었습니다)

    # ===== internal: io helpers =====
    def _guess_audio_suffix(self, data: bytes) -> str:
        head = (data or b"")[:16]
        try:
            if head.startswith(b"ID3") or head[0:2] == b"\xff\xfb":
                return ".mp3"
        except Exception:
            pass
        if head.startswith(b"RIFF") and b"WAVE" in head:
            return ".wav"
        if head.startswith(b"OggS"):
            return ".ogg"
        if len(head) >= 8 and head[4:8] == b"ftyp":
            return ".m4a"
        if head.startswith(b"fLaC"):
            return ".flac"
        return ".wav"

    @contextlib.contextmanager
    def _bytes_to_tempfile(self, data: bytes):
        suffix = self._guess_audio_suffix(data)
        f = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        try:
            f.write(data or b"")
            f.flush()
            f.close()
            yield f.name
        finally:
            try:
                os.unlink(f.name)
            except Exception:
                pass

    # ===== duration probe helpers (single pipeline: ffprobe) =====
    def _probe_duration_seconds_from_file(self, file_path: str) -> float:
        """ffprobe로 컨테이너 메타에서 길이를 산출합니다. 실패 시 0.0"""
        try:
            # 우선 stream.duration, 없으면 format.duration을 본다
            cmd = [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "stream=duration,codec_type",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                file_path,
            ]
            proc = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
                text=True,
            )
            if proc.returncode != 0:
                return 0.0
            data: Dict[str, Any] = json.loads(proc.stdout or "{}")
            # stream에서 audio 트랙의 duration 우선
            try:
                streams = data.get("streams") or []
                audio_durs: List[float] = []
                for s in streams:
                    if str(s.get("codec_type")) == "audio":
                        d = s.get("duration")
                        if isinstance(d, (int, float)) and float(d) > 0:
                            audio_durs.append(float(d))
                        elif isinstance(d, str):
                            try:
                                fv = float(d)
                                if fv > 0:
                                    audio_durs.append(fv)
                            except Exception:
                                pass
                if audio_durs:
                    return max(audio_durs)
            except Exception:
                pass

            # format.duration 폴백
            try:
                fmt = data.get("format") or {}
                d = fmt.get("duration")
                if isinstance(d, (int, float)) and float(d) > 0:
                    return float(d)
                if isinstance(d, str):
                    fv = float(d)
                    if fv > 0:
                        return fv
            except Exception:
                pass
            return 0.0
        except Exception:
            return 0.0

    def _probe_duration_seconds_from_bytes(self, data: bytes) -> float:
        try:
            with self._bytes_to_tempfile(data) as tmp_path:
                return self._probe_duration_seconds_from_file(tmp_path)
        except Exception:
            return 0.0

    # ===== Fireworks API helpers =====
    def _is_api_enabled(self) -> bool:
        try:
            return bool(getattr(self.config, "api_enabled", False))
        except Exception:
            return False

    def _get_api_key(self) -> str:
        key = str(getattr(self.config, "api_key", "") or "").strip()
        if not key:
            raise RuntimeError("Fireworks API 키가 설정되지 않았습니다 (service_config.transcribe.api_key)")
        return key

    def _get_fireworks_model(self) -> str:
        try:
            m = getattr(self.config, "fireworks_model", None)
            return str(m or "whisper-v3-large-turbo")
        except Exception:
            return "whisper-v3-large-turbo"

    def _get_fireworks_audio_base_url(self) -> Optional[str]:
        try:
            v = getattr(self.config, "fireworks_audio_base_url", None)
            return str(v) if v else None
        except Exception:
            return None

    def _transcribe_bytes_via_api_sync(
        self,
        data: bytes,
        *,
        language: Optional[str],
    ) -> Dict[str, Any]:
        # bytes 입력은 임시 파일로 저장하여 파일 기반 API 호출을 재사용
        with self._bytes_to_tempfile(data) as tmp_path:
            return self._transcribe_file_via_api_sync(tmp_path, language=language)

    def _transcribe_file_via_api_sync(
        self,
        file_path: str,
        *,
        language: Optional[str],
    ) -> Dict[str, Any]:
        # Fireworks 전용 AudioInference 사용 (문서: audio-prod/audio-turbo)
        from fireworks.client.audio import AudioInference  # type: ignore

        api_key = self._get_api_key()
        model = self._get_fireworks_model()
        base_url = self._get_fireworks_audio_base_url()
        if not base_url:
            # 모델명에 따라 기본 엔드포인트 추정
            base_url = (
                "https://audio-turbo.us-virginia-1.direct.fireworks.ai"
                if "turbo" in model else
                "https://audio-prod.us-virginia-1.direct.fireworks.ai"
            )
        # Fireworks API의 모델 식별자: turbo 계열은 "whisper-v3-turbo" 사용
        if model == "whisper-v3-large-turbo":
            model = "whisper-v3-turbo"
        client = AudioInference(model=model, base_url=base_url, api_key=api_key)
        with open(file_path, "rb") as f:
            data = f.read()
        # Fireworks: 타임스탬프를 받으려면 verbose_json + timestamp_granularities 지정 필요
        transcribe_kwargs: Dict[str, Any] = {
            "response_format": "verbose_json",
            "timestamp_granularities": ["word", "segment"],
        }
        try:
            if isinstance(language, str) and language:
                resp = client.transcribe(audio=data, language=language, **transcribe_kwargs)
            else:
                resp = client.transcribe(audio=data, **transcribe_kwargs)
        except Exception:
            # 라이브러리 오류 발생 시 기본값 반환
            return {
                "language": None,
                "language_probability": 0.0,
                "duration": 0.0,
                "segments": [],
            }

        # 표준 결과로 정규화
        segments: List[Dict[str, Any]] = []
        # Fireworks verbose_json: segments/words만 신뢰 (불필요한 폴백 제거)
        for s in (getattr(resp, "segments", []) or []):
            item: Dict[str, Any] = {
                "start": float(getattr(s, "start", 0.0) or 0.0),
                "end": float(getattr(s, "end", 0.0) or 0.0),
                "text": str(getattr(s, "text", "") or ""),
            }
            words_val = getattr(s, "words", None)
            if isinstance(words_val, list) and words_val:
                item["words"] = [
                    {
                        "start": float(getattr(w, "start", 0.0) or 0.0),
                        "end": float(getattr(w, "end", 0.0) or 0.0),
                        "word": str(getattr(w, "word", "") or ""),
                    }
                    for w in words_val
                ]
            segments.append(item)

        # duration은 세그먼트 종료 시각의 최댓값으로 산출
        try:
            duration_val = max((seg.get("end") or 0.0) for seg in segments) if segments else 0.0
        except Exception:
            duration_val = 0.0

        result: Dict[str, Any] = {
            "language": None,
            "language_probability": 0.0,
            "duration": float(duration_val),
            "segments": segments,
        }
        return result

    # (로컬 모델 전사 경로는 제거되었습니다)

    # (병렬/분할 전사 유틸리티는 제거되었습니다)

    # ===== public API =====
    async def transcribe_bytes(
        self,
        data: bytes,
        *,
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """바이트 데이터 전사: Fireworks API 전용"""
        if not self._is_api_enabled():
            # 비활성화 시에도 기본값 반환 (서버 500 방지)
            return {
                "language": None,
                "language_probability": 0.0,
                "duration": 0.0,
                "segments": [],
            }
        try:
            return await asyncio.to_thread(self._transcribe_bytes_via_api_sync, data, language=language)
        except Exception:
            # 라이브러리 오류 시 기본값 반환
            return {
                "language": None,
                "language_probability": 0.0,
                "duration": 0.0,
                "segments": [],
            }

    async def transcribe_file(
        self,
        file_path: str,
        *,
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """파일 경로 전사: Fireworks API 전용"""
        # 파일 존재 확인
        if not Path(file_path).exists():
            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
        if not self._is_api_enabled():
            # 비활성화 시에도 기본값 반환 (서버 500 방지)
            return {
                "language": None,
                "language_probability": 0.0,
                "duration": 0.0,
                "segments": [],
            }
        try:
            return await asyncio.to_thread(self._transcribe_file_via_api_sync, file_path, language=language)
        except Exception:
            # 라이브러리 오류 시 기본값 반환
            return {
                "language": None,
                "language_probability": 0.0,
                "duration": 0.0,
                "segments": [],
            }


    # ===== public: youtube helper (minimal) =====
    async def transcribe_youtube(
        self,
        url: str,
        *,
        prefer_subtitles: bool = True,
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """유튜브 링크 입력 시 자막 우선 → 실패 시 오디오 다운로드 후 전사.

        - 옵션은 최소화. 제공된 인자 없으면 내부 기본값 사용.
        - 자막 성공 시 각 cue/event를 Whisper 스타일의 segments(start, end, text)로 반환.
        """
        # 간단한 유튜브 URL 유효성 검사
        yt_regex = re.compile(r"^(https?://)?(www\.)?(youtube\.com|youtu\.be)/.+$")
        if not yt_regex.match(url or ""):
            raise ValueError("유효한 유튜브 URL이 아닙니다.")

        # 플레이리스트 파라미터 제거 등 단일 영상 URL로 정규화
        url = self._ensure_single_video_url(url)

        # 1) 자막을 먼저 시도하고, 있으면 반드시 자막 사용
        try:
            transcript_result = self._try_fetch_youtube_transcriptapi_segments(url)
            if transcript_result and isinstance(transcript_result.get("segments"), list) and transcript_result["segments"]:
                transcript_result["used_subtitles"] = True
                return transcript_result
        except Exception:
            pass

        # 2) 자막이 없을 때만 오디오 전사로 폴백
        out = await asyncio.to_thread(
            self._transcribe_youtube_by_audio,
            url,
            language=language,
        )
        try:
            if isinstance(out, dict):
                out["used_subtitles"] = False
        except Exception:
            pass
        return out

    # ===== preflight: 경량 선검증 =====
    async def preflight_transcribe_bytes(self, data: bytes, *, usage: Dict[str, Any]) -> Dict[str, Any]:
        """오디오/비디오 바이트의 예상 길이 기반 토큰 산정.

        반환: { durationSeconds, estimatedTokenCount, canProceed, reason }
        """
        def _safe_int(x: Any, default: int = 0) -> int:
            try:
                return int(x)
            except Exception:
                return int(default)

        per_min = _safe_int((usage.get("costMultipliers") or {}).get("perAudioMinute"), 9)
        remaining = _safe_int(usage.get("remainingTokens"), 0)

        # 경량 프로브(wave/tinytag)로 길이 산출 (디코딩 없음)
        duration_seconds = float(self._probe_duration_seconds_from_bytes(data))

        import math
        est_minutes = int(math.ceil(max(0.0, duration_seconds) / 60.0))
        estimated = max(0, est_minutes * int(per_min))
        can_proceed = bool(estimated <= remaining)
        reason = None if can_proceed else "insufficient_tokens"
        return {
            "durationSeconds": float(duration_seconds),
            "estimatedTokenCount": int(estimated),
            "canProceed": can_proceed,
            "reason": reason,
        }

    async def preflight_transcribe_youtube(self, url: str, *, prefer_subtitles: bool, usage: Dict[str, Any]) -> Dict[str, Any]:
        """YouTube URL의 메타(자막 존재/길이) 기반 토큰 산정.

        주의: 자막이 존재하면 항상 자막을 사용한다고 가정하여 estimatedTokenCount=0.
        반환: { durationSeconds, hasSubtitles, estimatedTokenCount, canProceed, reason }
        """
        def _safe_int(x: Any, default: int = 0) -> int:
            try:
                return int(x)
            except Exception:
                return int(default)

        per_min = _safe_int((usage.get("costMultipliers") or {}).get("perAudioMinute"), 9)
        remaining = _safe_int(usage.get("remainingTokens"), 0)

        # 자막 존재 여부 시도
        has_subtitles = False
        try:
            tx = self._try_fetch_youtube_transcriptapi_segments(url)
            if tx and isinstance(tx.get("segments"), list) and tx["segments"]:
                has_subtitles = True
        except Exception:
            has_subtitles = False

        duration_seconds = 0.0
        try:
            # yt_dlp 메타 조회(다운로드 없이): duration 추출
            import yt_dlp as youtube_dl  # type: ignore
            ydl_opts: Dict[str, Any] = {
                "quiet": True,
                "skip_download": True,
                "noplaylist": True,
            }
            with youtube_dl.YoutubeDL(ydl_opts) as ydl:  # type: ignore
                info = ydl.extract_info(url, download=False)
                d = info.get("duration")
                if isinstance(d, (int, float)):
                    duration_seconds = float(d)
        except Exception:
            duration_seconds = 0.0

        import math

        # 자막 존재 시 항상 자막 사용 → 과금 0
        if has_subtitles:
            estimated = 0
        else:
            est_minutes = int(math.ceil(max(0.0, duration_seconds) / 60.0))
            estimated = max(0, est_minutes * int(per_min))

        can_proceed = bool(estimated <= remaining)
        reason = None if can_proceed else "insufficient_tokens"
        return {
            "durationSeconds": float(duration_seconds),
            "hasSubtitles": bool(has_subtitles),
            "estimatedTokenCount": int(estimated),
            "canProceed": can_proceed,
            "reason": reason,
        }


    # ===== subtitles -> segments (YouTube): Providers 기반 구현 =====
    def _try_fetch_youtube_transcriptapi_segments(self, url: str) -> Optional[Dict[str, Any]]:
        """youtube-transcript-api를 활용해 자막 세그먼트를 표준 구조로 반환.

        반환 형식: { language, language_probability, duration, segments }
        실패 시 None
        """
        try:
            from youtube_transcript_api import \
                YouTubeTranscriptApi  # type: ignore
        except Exception:
            return None

        video_id = self._extract_youtube_video_id(url)
        if not video_id:
            return None

        languages_priority: List[str] = list(self.DEFAULT_LANGUAGES_PRIORITY)
        # 올바른 youtube-transcript-api 사용법
        try:
            api = YouTubeTranscriptApi()  # type: ignore[call-arg]
            # 직접 fetch 시도 (우선순위 언어로)
            try:
                fetched_transcript = api.fetch(video_id, languages=languages_priority)  # type: ignore[attr-defined]
                items = list(fetched_transcript)  # FetchedTranscript를 리스트로 변환
                sel_lang = getattr(fetched_transcript, "language_code", None)
            except Exception:
                # fetch 실패 시 list → find_transcript → fetch 경로
                transcript_list = api.list(video_id)  # type: ignore[attr-defined]
                candidates: List[Any] = []  # type: ignore[assignment]
                for t in transcript_list:  # type: ignore[assignment]
                    try:
                        lc = getattr(t, "language_code", None)
                        if lc in languages_priority:
                            candidates.append(t)
                    except Exception:
                        continue
                if candidates:
                    manual = [t for t in candidates if not getattr(t, "is_generated", True)]
                    selected = (manual or candidates)[0]
                else:
                    try:
                        selected = transcript_list.find_transcript(languages_priority)  # type: ignore[attr-defined]
                    except Exception:
                        selected = None
                if selected is not None:
                    try:
                        fetched_transcript = selected.fetch()
                        items = list(fetched_transcript)  # FetchedTranscript를 리스트로 변환
                        sel_lang = getattr(selected, "language_code", None)
                    except Exception:
                        items = None
                else:
                    items = None
        except Exception:
            items = None
            
        if items is None:
            return None

        # items: FetchedTranscriptSnippet → cues(ms)
        cues: List[Dict[str, Any]] = []
        for it in items or []:
            try:
                s = float(getattr(it, "start", 0.0) or 0.0)
                d = float(getattr(it, "duration", 0.0) or 0.0)
            except Exception:
                s = 0.0
                d = 0.0
            e = max(s, s + d)
            t = str(getattr(it, "text", "") or "")
            if not t.strip():
                continue
            cues.append({"start_ms": int(round(s * 1000.0)), "end_ms": int(round(e * 1000.0)), "text": t})

        cfg = NormalizerConfig(
            min_caption_duration_ms=self._get_int_config("min_caption_duration_ms", 300),
            merge_gap_ms=self._get_int_config("merge_gap_ms", 250),
        )
        segments = normalize_cues_to_segments(cues, cfg)
        if not segments:
            return None

        try:
            duration = float(max((s.get("end") or 0.0) for s in segments))
        except Exception:
            duration = 0.0

        lang = sel_lang

        return {
            "language": lang,
            "language_probability": 0.0,
            "duration": duration,
            "segments": segments,
        }

    # (_try_fetch_youtube_subtitles_segments 제거됨: 단일 경로 유지)

    # 정규화 로직은 utils.normalizer로 이전되었습니다.

    # 텍스트 비교용 정규화는 utils.normalizer로 이전되었습니다.

    # 접미사/접두사 겹침 계산은 utils.normalizer로 이전되었습니다.

    # 라인 결합 규칙은 utils.normalizer로 이전되었습니다.

    def _get_int_config(self, name: str, default_value: int) -> int:
        try:
            val = getattr(self.config, name, default_value)
            return int(val)
        except Exception:
            return int(default_value)

    def _extract_youtube_video_id(self, url: str) -> Optional[str]:
        """유튜브 비디오 ID 추출(youtu.be / watch?v= / embed 등 지원, 실패 시 None)."""
        try:
            parsed = urlparse(url)
            host = (parsed.netloc or "").lower()
            if "youtu.be" in host:
                vid = (parsed.path or "/").lstrip("/").split("/")[0]
                return vid or None
            if "youtube.com" in host:
                if parsed.path == "/watch":
                    qs = parse_qs(parsed.query or "")
                    v = (qs.get("v") or [""])[0]
                    return v or None
                # /embed/VIDEO_ID 형태 지원
                if parsed.path.startswith("/embed/"):
                    return (parsed.path.split("/embed/")[-1] or "").split("/")[0] or None
            return None
        except Exception:
            return None



    def _transcribe_youtube_by_audio(
        self,
        url: str,
        *,
        language: Optional[str],
    ) -> Dict[str, Any]:
        """yt-dlp로 bestaudio를 다운로드 후 Fireworks API로 전사."""
        try:
            import yt_dlp as youtube_dl  # type: ignore
        except Exception as e:
            raise RuntimeError("yt-dlp가 필요합니다. 설치 후 다시 시도하세요.") from e

        with tempfile.TemporaryDirectory() as tmpdir:
            base = Path(tmpdir) / "yt_audio"
            outtmpl = f"{str(base)}.%(ext)s"
            ydl_opts: Dict[str, Any] = {
                "format": "bestaudio/best",
                "outtmpl": outtmpl,
                "quiet": True,
                # 단일 영상만 다운로드하도록 강제
                "noplaylist": True,
                # 오디오는 m4a로 추출 (ffmpeg 필요)
                "prefer_ffmpeg": True,
                "postprocessors": [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "m4a",
                        "preferredquality": "192",
                    }
                ],
            }
            with youtube_dl.YoutubeDL(ydl_opts) as ydl:  # type: ignore
                info = ydl.extract_info(url, download=True)

            audio_file: Optional[str] = None
            # m4a 우선 탐색
            prefer_exts = ["m4a", "mp4", "mp3", "wav", "webm", "ogg"]
            for ext in prefer_exts:
                cand = Path(tmpdir) / f"yt_audio.{ext}"
                if cand.exists():
                    audio_file = str(cand.absolute())
                    break
            if not audio_file:
                # 요청된 다운로드 목록에서 파일 경로 우선 취득
                for d in info.get("requested_downloads", []) or []:
                    p = d.get("filepath")
                    if p:
                        audio_file = p
                        break
            if not audio_file:
                audio_file = info.get("filepath")
            # 최후의 수단: 출력 템플릿으로 생성된 파일 탐색
            if not audio_file:
                candidates = list(Path(tmpdir).glob("yt_audio.*"))
                if candidates:
                    audio_file = str(candidates[0].absolute())
            if not audio_file:
                raise FileNotFoundError("유튜브 오디오 추출에 실패했습니다.")

            # Fireworks API 전용
        if not self._is_api_enabled():
            # 비활성화 시에도 기본값 반환 (서버 500 방지)
            return {
                "language": None,
                "language_probability": 0.0,
                "duration": 0.0,
                "segments": [],
            }
        try:
            return self._transcribe_file_via_api_sync(audio_file, language=language)
        except Exception:
            # 라이브러리 오류 시 기본값 반환
            return {
                "language": None,
                "language_probability": 0.0,
                "duration": 0.0,
                "segments": [],
            }

    def _ensure_single_video_url(self, url: str) -> str:
        """유튜브 URL을 단일 영상 기준으로 정규화.

        - watch URL: v 파라미터만 유지하고 list/index/기타는 제거
        - youtu.be 단축 URL: 쿼리 제거 (list/index 등 차단)
        실패 시 원본 반환
        """
        try:
            parsed = urlparse(url)
            host = (parsed.netloc or "").lower()

            # youtu.be/VIDEO_ID?…  → 쿼리 제거
            if "youtu.be" in host:
                return urlunparse((parsed.scheme or "https", parsed.netloc, parsed.path, "", "", ""))

            # www.youtube.com/watch?v=VIDEO_ID&list=… → v만 유지
            if "youtube.com" in host and parsed.path == "/watch":
                qs = parse_qs(parsed.query or "")
                video_id = (qs.get("v") or [""])[0]
                if video_id:
                    new_query = urlencode({"v": video_id})
                    return urlunparse((parsed.scheme or "https", parsed.netloc, "/watch", "", new_query, ""))
            return url
        except Exception:
            return url

    # (최적화/사전로딩/정리 유틸리티는 로컬 모델 제거로 인해 불필요합니다)


    

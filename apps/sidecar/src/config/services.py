"""
외부 API 서비스 설정
Marker(문서 파서)와 임베딩/외부 서비스 설정을 관리합니다.
"""

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class ParseConfig:
    """PDF 파싱(Marker) 설정 - 공식 사용 패턴에 맞춰 간결화

    - 컨버터는 항상 PDF 고정
    - LLM 및 강제 OCR 옵션 제거
    """
    # 출력 포맷 (Marker 공식 지원): markdown | json | html | chunk
    output_format: str = "markdown"

    # 메타 표기를 위한 렌더러 명칭(표시용). 실제 렌더러 선택은 ConfigParser가 output_format을 기반으로 결정
    renderer: str = "MarkdownRenderer"  # MarkdownRenderer | HTMLRenderer | JSONRenderer | ChunkRenderer

    # 선택 옵션(공식 문서에 명시된 CLI/설정 플래그)
    strip_existing_ocr: bool = False
    format_lines: bool = False

    # 내부 PDF 텍스트/레이아웃 추출 워커 수
    # - None 이면 런타임에서 CPU 코어 수 기반의 안전 기본값으로 자동 산출
    pdftext_workers: Optional[int] = None

    # 디바이스 힌트(표시용). 실제 디바이스 선택은 Marker 내부 settings(TORCH_DEVICE)가 담당
    torch_device: Optional[str] = None  # cpu | cuda | mps | None(자동)

    # 외부 Marker API 사용 설정
    api_enabled: bool = False
    api_key: Optional[str] = None
    api_url: str = "https://www.datalab.to/api/v1/marker"
    api_timeout_seconds: int = 180

    def __post_init__(self):
        """설정 검증 및 정합성 보정"""
        valid_formats = ["markdown", "json", "html", "chunk"]
        if self.output_format not in valid_formats:
            raise ValueError(
                f"지원하지 않는 출력 포맷: {self.output_format}. 지원되는 포맷: {valid_formats}"
            )

        valid_renderers = [
            "MarkdownRenderer",
            "HTMLRenderer",
            "JSONRenderer",
            "ChunkRenderer",
        ]
        if self.renderer not in valid_renderers:
            raise ValueError(
                f"지원하지 않는 렌더러: {self.renderer}. 지원되는 렌더러: {valid_renderers}"
            )

        # renderer ↔ output_format 정합성(표시용 매핑)
        fmt_for_renderer = {
            "MarkdownRenderer": "markdown",
            "HTMLRenderer": "html",
            "JSONRenderer": "json",
            "ChunkRenderer": "chunk",
        }.get(self.renderer)
        if fmt_for_renderer and fmt_for_renderer != self.output_format:
            # 출력 포맷이 우선. 표시 렌더러를 동기화
            self.renderer = {
                "markdown": "MarkdownRenderer",
                "html": "HTMLRenderer",
                "json": "JSONRenderer",
                "chunk": "ChunkRenderer",
            }[self.output_format]

        # pdftext_workers 정합성: 양의 정수 또는 None
        if self.pdftext_workers is not None:
            try:
                ivalue = int(self.pdftext_workers)
                if ivalue <= 0:
                    self.pdftext_workers = None
                else:
                    self.pdftext_workers = ivalue
            except Exception:
                self.pdftext_workers = None

        # api_timeout_seconds 정합성
        try:
            self.api_timeout_seconds = int(self.api_timeout_seconds)
            if self.api_timeout_seconds <= 0:
                self.api_timeout_seconds = 180
        except Exception:
            self.api_timeout_seconds = 180


@dataclass
class EmbeddingConfig:
    """임베딩 설정 (sentence-transformers + Arctic-Embed v2.0)

    - GPU 환경: 기본값 cuda, 가용하지 않으면 런타임에서 자동 대체
    - 차원: 256(MRL 고정)
    - 입력 제한: 텍스트 개수/길이 제한으로 과부하 방지
    - Redis 벡터 인덱스: RediSearch(HNSW, COSINE)
    """
    model_id: str = "Snowflake/snowflake-arctic-embed-m-v2.0"
    device: str = "cuda"  # cuda | cpu | mps
    mrl_dim: int = 256
    normalize: bool = True

    max_texts_per_request: int = 64
    max_chars_per_text: int = 4000

    # Redis Vector Index
    redis_index_name: str = "idx:embed:arcticv2:256"
    redis_key_prefix: str = "vec:"
    distance_metric: str = "COSINE"  # COSINE | L2 | IP
    use_redisearch: bool = True
    redis_ttl_seconds: int = 0  # 0이면 만료 없음
    # Chunking & Cache (MVP)
    chunk_size: int = 500
    chunk_overlap: int = 50
    embed_cache_ttl_seconds: int = 60 * 60 * 24 * 30  # 30일
    # Reranker (MVP)
    reranker_model_id: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    # Preview top_k (라우트 응답용 상수)
    preview_top_k: int = 5


@dataclass
class TranscribeConfig:
    """음성 전사 설정 (Fireworks API 전용)

    - 로컬 전사(faster-whisper) 경로 제거
    - Fireworks 모델/엔드포인트/자격만 관리
    """
    # Fireworks 전사 사용 토글 및 자격
    api_enabled: bool = False
    api_key: Optional[str] = None
    # Fireworks 모델명 (기본: whisper-v3-large-turbo)
    fireworks_model: str = "whisper-v3-large-turbo"
    # Fireworks 오디오 전용 엔드포인트(명시 없으면 모델명으로 자동 결정)
    fireworks_audio_base_url: Optional[str] = None


@dataclass
class ServiceConfig:
    """전체 서비스 설정 통합 클래스"""
    parse: ParseConfig
    embedding: EmbeddingConfig
    # 음성 전사
    transcribe: 'TranscribeConfig'
    
    @classmethod
    def from_env(cls) -> 'ServiceConfig':
        """환경변수로부터 설정 생성 (Marker 공식 경로 중심)"""
        # Parse 설정: 시스템 요구사항에 따라 출력은 항상 markdown으로 고정
        env_output_format = "markdown"
        env_renderer = os.getenv("PARSE_RENDERER", "MarkdownRenderer")  # 표시용, 없으면 포맷으로부터 매핑
        env_torch_device = os.getenv("TORCH_DEVICE", "cuda")  # Marker 공식 환경변수

        parse_config = ParseConfig(
            output_format=env_output_format,
            renderer=(
                env_renderer
                if env_renderer
                else {
                    "markdown": "MarkdownRenderer",
                    "html": "HTMLRenderer",
                    "json": "JSONRenderer",
                    "chunk": "ChunkRenderer",
                }[env_output_format]
            ),
            strip_existing_ocr=os.getenv("PARSE_STRIP_EXISTING_OCR", "false").lower() == "true",
            format_lines=os.getenv("PARSE_FORMAT_LINES", "false").lower() == "true",
            torch_device=env_torch_device,
            pdftext_workers=(
                (lambda v: (int(v) if v.isdigit() and int(v) > 0 else None))(
                    os.getenv("PARSE_PDFTEXT_WORKERS", "").strip()
                )
            ),
            api_enabled=os.getenv("MARKER_API_ENABLED", "false").lower() == "true",
            api_key=os.getenv("MARKER_API_KEY"),
            api_url=os.getenv("MARKER_API_URL", "https://www.datalab.to/api/v1/marker"),
            api_timeout_seconds=int(os.getenv("MARKER_API_TIMEOUT_SECONDS", "180")),
        )
        
        # Embedding 설정
        embedding_config = EmbeddingConfig(
            model_id=os.getenv("EMBED_MODEL_ID", "Snowflake/snowflake-arctic-embed-m-v2.0"),
            device=os.getenv("EMBED_DEVICE", "cuda"),
            mrl_dim=int(os.getenv("EMBED_MRL_DIM", "256")),
            normalize=os.getenv("EMBED_NORMALIZE", "true").lower() == "true",
            max_texts_per_request=int(os.getenv("EMBED_MAX_TEXTS", "64")),
            max_chars_per_text=int(os.getenv("EMBED_MAX_CHARS", "4000")),
            redis_index_name=os.getenv("EMBED_REDIS_INDEX_NAME", "idx:embed:arcticv2:256"),
            redis_key_prefix=os.getenv("EMBED_REDIS_KEY_PREFIX", "vec:"),
            distance_metric=os.getenv("EMBED_DISTANCE_METRIC", "COSINE").upper(),
            use_redisearch=os.getenv("EMBED_USE_REDISEARCH", "true").lower() == "true",
            redis_ttl_seconds=int(os.getenv("EMBED_REDIS_TTL_SECONDS", "0")),
            chunk_size=int(os.getenv("EMBED_CHUNK_SIZE", "1000")),
            chunk_overlap=int(os.getenv("EMBED_CHUNK_OVERLAP", "150")),
            embed_cache_ttl_seconds=int(os.getenv("EMBED_CACHE_TTL_SECONDS", str(60 * 60 * 24 * 30))),
            reranker_model_id=os.getenv("EMBED_RERANKER_MODEL_ID", "cross-encoder/ms-marco-MiniLM-L-6-v2"),
            preview_top_k=int(os.getenv("EMBED_PREVIEW_TOP_K", "5")),
        )

        # Transcribe 설정 (Fireworks 전용)
        transcribe_config = TranscribeConfig(
            api_enabled=os.getenv("FIREWORKS_API_ENABLED", "false").lower() == "true",
            api_key=os.getenv("FIREWORKS_API_KEY"),
            fireworks_model=os.getenv("FIREWORKS_MODEL", "whisper-v3-large-turbo"),
            fireworks_audio_base_url=os.getenv("FIREWORKS_AUDIO_BASE_URL"),
        )

        return cls(parse=parse_config, embedding=embedding_config, transcribe=transcribe_config)

# 전역 설정 인스턴스
service_config = ServiceConfig.from_env()
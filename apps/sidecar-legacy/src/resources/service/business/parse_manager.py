"""
PDF 파싱(Marker) 관리자 모듈

본 모듈은 Marker의 공식 API만 사용하여 PDF → (Marker JSON) → 최소 오버레이 레이아웃을 생성합니다.

최종 저장 정책(데이터베이스 기준)
- files.content(JSONB): 문서 전체 HTML은 content.html에 저장
- files.layout(JSONB): 오버레이/상호작용에 필요한 최소 정보만 저장 (HTML 비포함)
  - version: 스키마 버전(정수)
  - units: 좌표 단위("pt")
  - origin: 좌표 원점("top-left")
  - pages[]: 페이지별 블록 목록
    - pageId: 1-based 페이지 인덱스
    - size: { width, height }
    - blocks[]: { id, type, bbox([x1,y1,x2,y2]), text }
  - stats: { pages, blocks, byType }

중복 최소화 원칙
- 텍스트 복사용 최소 필드만 유지(text, bbox). polygon 등 과다한 좌표 정보는 제거합니다.
- 전체 HTML/마크다운은 저장하지 않습니다.

기타 설계 포인트
- Marker는 동기 API(파일 경로 입력)를 기대하므로, BytesIO 입력을 임시 파일로 변환하는 래퍼를 사용합니다.
- JSON 출력에서 부모-자식 치환(`<content-ref>`)을 반영해 블록 HTML을 합성한 뒤, 이를 텍스트로 정규화합니다.
"""

import io
import os
import re
import tempfile
import time
from typing import Any, Dict, List, Optional, Tuple

# 정규식 패턴 사전 컴파일(모듈 레벨 캐시)
_RE_FENCED_CODEBLOCK = re.compile(r"```[\s\S]*?```")
_RE_INLINE_CODE = re.compile(r"`[^`]*`")
_RE_AUTOLINK = re.compile(r"<https?://[^>]+>")
_RE_RAW_HTML = re.compile(r"<[A-Za-z!/][^>]*>")
_RE_EXCESSIVE_NEWLINES = re.compile(r"\n{3,}")
_RE_PAGES_COUNT = re.compile(r"/Type\s*/Pages[\s\S]*?/Count\s+(\d+)", re.IGNORECASE)
_RE_PAGE_ENTRIES = re.compile(r"/Type\s*/Page(?!s)\b")

import requests
from marker.config.parser import ConfigParser
from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict
from marker.renderers.json import JSONRenderer  # type: ignore
from marker.renderers.markdown import MarkdownRenderer  # type: ignore

from src.config.services import service_config


class ParseManager:
    """PDF 파싱 관리자 클래스(간결/공식 패턴)"""

    def __init__(self):
        self.config = service_config.parse
        self._model_dict = None
        # TORCH_DEVICE 환경 변수 동기화(설정이 명시되면 우선 반영)
        try:
            if isinstance(self.config.torch_device, str) and self.config.torch_device:
                os.environ.setdefault("TORCH_DEVICE", self.config.torch_device)
        except Exception:
            pass

    def _init_model_dict(self) -> Dict[str, Any]:
        # 장치 선택은 Marker 내부 settings(TORCH_DEVICE) 자동 감지에 위임
        return create_model_dict()

    def _build_marker_config(self, override_output_format: Optional[str] = None) -> Dict[str, Any]:
        # 공식 ConfigParser에 전달할 설정 사전
        config_dict = {
            "output_format": override_output_format or self.config.output_format,
        }
        if self.config.strip_existing_ocr:
            config_dict["strip_existing_ocr"] = True
        if self.config.format_lines:
            config_dict["format_lines"] = True
        # 내부 텍스트 추출 워커 수 제어(공식 옵션 매핑): 설정값 → 자동 기본값 순
        try:
            configured_workers = getattr(self.config, "pdftext_workers", None)
            pdftext_workers: Optional[int] = None
            if isinstance(configured_workers, int) and configured_workers > 0:
                pdftext_workers = configured_workers
            else:
                # 자동 기본값: CPU 코어 수 기반 (상한 4)
                try:
                    import os as _os
                    cpu_count = max(1, (_os.cpu_count() or 1))
                except Exception:
                    cpu_count = 1
                # 일부 시스템에서 과도한 병렬은 불안정 보고 → 보수적으로 제한
                pdftext_workers = min(cpu_count, 4)
            if pdftext_workers and pdftext_workers > 0:
                config_dict["pdftext_workers"] = int(pdftext_workers)
        except Exception:
            pass
        return config_dict

    def _build_ephemeral_converter(self, output_format: str) -> Any:
        """요청한 출력 포맷으로 일회성 컨버터를 생성합니다.

        사용 맥락
        - 저장 정책상, 우선 Marker JSON을 생성한 뒤 내부에서 HTML/레이아웃으로 변환합니다.
        - 기존 캐시된 컨버터(`self._converter`)를 오염시키지 않기 위해 별도 인스턴스를 생성합니다.
        - BytesIO 입력 호환을 위해 동일 래퍼를 적용합니다.
        """
        parser = ConfigParser(self._build_marker_config(override_output_format=output_format))
        inner = PdfConverter(
            artifact_dict=self.model_dict,
            config=parser.generate_config_dict(),
            processor_list=parser.get_processors(),
            renderer=parser.get_renderer(),
            llm_service=parser.get_llm_service(),
        )
        return self._wrap_bytesio(inner)

    def _build_document_converter(self) -> Any:
        """포맷 비종속 문서 구축 전용 컨버터를 생성합니다.

        - build_document(...)만 호출하여 무거운 파이프라인을 1회 수행합니다.
        - 렌더는 별도의 Renderer로 분리하여 수행합니다.
        """
        parser = ConfigParser(self._build_marker_config())
        inner = PdfConverter(
            artifact_dict=self.model_dict,
            config=parser.generate_config_dict(),
            processor_list=parser.get_processors(),
            renderer=parser.get_renderer(),
            llm_service=parser.get_llm_service(),
        )
        return self._wrap_bytesio(inner)

    def _wrap_bytesio(self, inner_converter: Any) -> Any:
        """BytesIO를 경로로 변환해주는 래퍼를 적용하여 컨버터 호출 인터페이스를 통일."""
        class _CompatConverter:
            def __init__(self, inner):
                self._inner = inner

            def __call__(self, file_input):
                if isinstance(file_input, io.BytesIO):
                    with tempfile.NamedTemporaryFile(delete=False, suffix="") as tmp:
                        try:
                            file_input.seek(0)
                            tmp.write(file_input.getvalue())
                            tmp.flush()
                        finally:
                            tmp_path = tmp.name
                    try:
                        return self._inner(tmp_path)
                    finally:
                        try:
                            os.unlink(tmp_path)
                        except Exception:
                            pass
                return self._inner(file_input)

        return _CompatConverter(inner_converter)

    @property
    def model_dict(self) -> Dict[str, Any]:
        if self._model_dict is None:
            self._model_dict = self._init_model_dict()
        return self._model_dict

    # -------- Markdown 정제: 원시 HTML 제거 --------
    def clean_markdown_remove_raw_html(self, markdown_text: Optional[str]) -> str:
        """마크다운 문자열에서 원시 HTML 태그를 제거합니다.

        - 코드블록(펜스)과 인라인코드 안의 내용은 보존합니다.
        - <http://...> 형태의 자동 링크는 보존합니다.
        - 그 외 <tag ...> 형태의 태그는 제거합니다.
        """
        if not isinstance(markdown_text, str) or not markdown_text:
            return ""

        text = markdown_text

        # 1) 코드블록/인라인코드를 플레이스홀더로 치환하여 보호
        code_blocks: List[str] = []
        inline_codes: List[str] = []

        def _store_code_block(m):
            code_blocks.append(m.group(0))
            return f"@@CODEBLOCK_{len(code_blocks)-1}@@"

        def _store_inline_code(m):
            inline_codes.append(m.group(0))
            return f"@@INLINECODE_{len(inline_codes)-1}@@"

        # fenced code blocks
        text = _RE_FENCED_CODEBLOCK.sub(_store_code_block, text)
        # inline code
        text = _RE_INLINE_CODE.sub(_store_inline_code, text)

        # 2) 자동 링크(<http://...>) 보호
        autolinks: List[str] = []

        def _store_autolink(m):
            autolinks.append(m.group(0))
            return f"@@AUTOLINK_{len(autolinks)-1}@@"

        text = _RE_AUTOLINK.sub(_store_autolink, text)

        # 3) 원시 HTML 태그 제거
        text = _RE_RAW_HTML.sub("", text)

        # 4) 플레이스홀더 복원
        for i, v in enumerate(autolinks):
            text = text.replace(f"@@AUTOLINK_{i}@@", v)
        for i, v in enumerate(inline_codes):
            text = text.replace(f"@@INLINECODE_{i}@@", v)
        for i, v in enumerate(code_blocks):
            text = text.replace(f"@@CODEBLOCK_{i}@@", v)

        # 5) 공백 정리(과도한 연속 개행 축소)
        text = _RE_EXCESSIVE_NEWLINES.sub("\n\n", text)
        return text.strip()

    # -------- 문서 1회 구축 + 렌더 API (권장 경로) --------
    def build_document_once(self, file_input: io.BytesIO | str) -> Any:
        """PDF로부터 내부 문서 객체를 1회만 구축합니다."""
        builder = self._build_document_converter()
        inner = getattr(builder, "_inner", None)
        if inner is None:
            inner = builder
        # BytesIO 입력을 파일 경로로 변환하여 build_document에 전달
        if isinstance(file_input, io.BytesIO):
            with tempfile.NamedTemporaryFile(delete=False, suffix="") as tmp:
                try:
                    file_input.seek(0)
                    tmp.write(file_input.getvalue())
                    tmp.flush()
                finally:
                    tmp_path = tmp.name
            try:
                return inner.build_document(tmp_path)  # type: ignore[attr-defined]
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
        # 문자열 경로 입력은 그대로 전달
        return inner.build_document(file_input)  # type: ignore[attr-defined]

    # -------- 외부 Marker API (Datalab) 어댑터 --------
    def _is_api_enabled(self) -> bool:
        try:
            return bool(getattr(self.config, "api_enabled", False))
        except Exception:
            return False

    def _get_api_key(self) -> str:
        key = str(getattr(self.config, "api_key", "") or "").strip()
        if not key:
            raise RuntimeError("MARKER_API_KEY가 설정되지 않았습니다")
        return key

    def _get_api_url(self) -> str:
        url = str(getattr(self.config, "api_url", "") or "").strip()
        return url or "https://www.datalab.to/api/v1/marker"

    def parse_bytes_via_api(self, data: bytes, *, timeout_seconds: Optional[int] = None) -> Tuple[Dict[str, Any], str]:
        """Datalab Marker API로 PDF 바이트를 업로드하여 (json, markdown)을 동시 수신.

        - output_format=markdown,json 으로 요청
        - 완료 응답의 json/markdown 필드를 정규화하여 반환
        """
        api_key = self._get_api_key()
        url = self._get_api_url()

        files = {
            "file": ("document.pdf", data or b"", "application/pdf"),
        }
        form = {
            "output_format": "markdown,json",
            "use_llm": str(False).lower(),
            "strip_existing_ocr": str(bool(self.config.strip_existing_ocr)).lower(),
            "format_lines": str(bool(self.config.format_lines)).lower(),
            "mode": "fast",
        }
        headers = {"X-API-Key": api_key}

        try:
            init_resp = requests.post(url, headers=headers, files=files, data=form, timeout=30)
            init_resp.raise_for_status()
            init_json = init_resp.json()
        except Exception as e:
            raise RuntimeError(f"Marker API 초기 요청 실패: {e}")

        check_url = str(init_json.get("request_check_url") or "").strip()
        if not check_url:
            raise RuntimeError("Marker API 폴링 URL을 획득하지 못했습니다")

        # 타임아웃: 인자 우선, 없으면 설정값 사용
        try:
            cfg_timeout = int(getattr(self.config, "api_timeout_seconds", 180) or 180)
        except Exception:
            cfg_timeout = 180
        _timeout = int(timeout_seconds) if timeout_seconds is not None else cfg_timeout
        deadline = time.time() + max(30, _timeout)
        last_payload: Dict[str, Any] = {}
        while time.time() < deadline:
            try:
                poll = requests.get(check_url, headers=headers, timeout=15)
                poll.raise_for_status()
                payload = poll.json()
                last_payload = payload if isinstance(payload, dict) else {}
                if str(last_payload.get("status")) == "complete":
                    break
            except Exception:
                pass
            time.sleep(2)

        if str(last_payload.get("status")) != "complete":
            raise RuntimeError("Marker API 처리 지연 또는 실패(status != complete)")

        markdown_val = last_payload.get("markdown")
        json_val = last_payload.get("json")

        markdown_out = markdown_val if isinstance(markdown_val, str) else ""

        json_doc: Dict[str, Any] = {}
        if isinstance(json_val, dict):
            json_doc = json_val
        elif isinstance(json_val, list):
            json_doc = {"children": json_val}
        elif isinstance(json_val, str) and json_val.strip():
            try:
                import json as _json
                parsed = _json.loads(json_val)
                if isinstance(parsed, dict):
                    json_doc = parsed
                elif isinstance(parsed, list):
                    json_doc = {"children": parsed}
            except Exception:
                json_doc = {}

        return json_doc, markdown_out

    def parse_bytes_auto(self, data: bytes) -> Tuple[Dict[str, Any], str]:
        """ENV 토글(MARKER_API_ENABLED)에 따라 API/로컬 경로로 파싱 후 (json, markdown) 반환."""
        if self._is_api_enabled():
            return self.parse_bytes_via_api(data)
        document = self.build_document_once(io.BytesIO(data))
        json_doc = self.render_json(document)
        markdown = self.render_markdown(document)
        return (json_doc if isinstance(json_doc, dict) else {}), (markdown if isinstance(markdown, str) else "")

    def render_json(self, document: Any) -> Dict[str, Any]:
        """이미 구축된 문서에 대해 JSON 렌더만 수행합니다."""
        try:
            rendered = JSONRenderer()(document)
        except Exception as e:
            raise e
        if isinstance(rendered, dict):
            return rendered
        try:
            if hasattr(rendered, "model_dump"):
                dumped = rendered.model_dump()
                if isinstance(dumped, dict):
                    return dumped
        except Exception:
            pass
        try:
            if hasattr(rendered, "dict"):
                dumped = rendered.dict()
                if isinstance(dumped, dict):
                    return dumped
        except Exception:
            pass
        try:
            import json as _json
            if hasattr(rendered, "json"):
                dumped = _json.loads(rendered.json())
                if isinstance(dumped, dict):
                    return dumped
        except Exception:
            pass
        return rendered  # type: ignore[return-value]

    def render_markdown(self, document: Any) -> str:
        """이미 구축된 문서에 대해 Markdown 렌더만 수행합니다."""
        rendered_md = MarkdownRenderer()(document)
        if hasattr(rendered_md, "markdown"):
            try:
                value = getattr(rendered_md, "markdown")
                return value if isinstance(value, str) else str(value)
            except Exception:
                pass
        if isinstance(rendered_md, dict) and isinstance(rendered_md.get("markdown"), str):
            return rendered_md.get("markdown")
        return rendered_md if isinstance(rendered_md, str) else ""

    # 텍스트 토큰 계산 로직은 과금 표준화(페이지×배수)로 불필요해 제거되었습니다.

    def calculate_metrics(self, markdown_text: str | None, layout: Dict[str, Any]) -> Dict[str, int]:
        """마크다운과 레이아웃으로부터 주요 메트릭을 계산합니다.

        반환:
        { contentLength, pageCount, tokenCount }
        """
        content_length = len(markdown_text) if isinstance(markdown_text, str) else 0
        try:
            page_count = int(layout.get("stats", {}).get("pages", 0)) if isinstance(layout, dict) else 0
        except Exception:
            page_count = 0
        return {
            "contentLength": content_length,
            "pageCount": page_count,
        }

    # (비-PDF 로더 및 외부 URL 텍스트 추출 유틸 제거됨)
    # -------- HTML → Text 정규화 --------
    # _html_to_text 정규식 사전 컴파일(모듈 레벨)
    _RE_HTML_TAG = re.compile(r"<[^>]+>")
    _RE_SPACES = re.compile(r"\s+")

    def _html_to_text(self, html: Optional[str]) -> str:
        if not isinstance(html, str) or not html:
            return ""
        # 매우 가벼운 태그 제거 및 공백 정리 (외부 의존성 없이)
        try:
            text = self._RE_HTML_TAG.sub(" ", html)
            text = self._RE_SPACES.sub(" ", text)
            return text.strip()
        except Exception:
            return html

    # 공개 래퍼: 외부에서 사용 가능
    def html_to_text(self, html: Optional[str]) -> str:
        return self._html_to_text(html)

    # -------- JSON → 최소 오버레이 레이아웃 직렬화 --------
    def build_layout_from_json(self, json_doc: Dict[str, Any]) -> Dict[str, Any]:
        """DB 저장용 최소 오버레이 레이아웃 스키마를 생성합니다.

        반환 구조
        {
          version: 2,
          units: "pt",
          origin: "top-left",
          pages: [
            { pageId, size: { width, height }, blocks: [ { id, type, bbox, text } ] }
          ],
          stats: { pages, blocks, byType }
        }
        """
        
        def extract_blocks_recursive(nodes: List[Dict[str, Any]], page: int = None) -> List[Dict[str, Any]]:
            """재귀적으로 블록 추출 및 텍스트 변환"""
            blocks = []
            for node in nodes:
                if not isinstance(node, dict):
                    continue

                # 메타데이터 직접 추출
                meta = {
                    "id": node.get("id"),
                    "block_type": node.get("block_type"),
                    "bbox": node.get("bbox"),
                    "page": node.get("page") or page
                }

                # HTML에서 텍스트 직접 추출
                html = node.get("html", "")
                meta["text"] = self._html_to_text(html)

                blocks.append(meta)

                # 자식 처리 (재귀)
                if node.get("children"):
                    blocks.extend(extract_blocks_recursive(node["children"], meta["page"]))

            return blocks

        # 모든 블록 추출
        # 최상위 Page 노드별로 페이지 인덱스를 부여하여 자식에게 전파
        all_blocks: List[Dict[str, Any]] = []
        try:
            top_children = json_doc.get("children") or []
        except Exception:
            top_children = []
        page_index = -1
        for node in top_children:
            if not isinstance(node, dict):
                continue
            node_type = str(node.get("block_type")) if node.get("block_type") is not None else ""
            if node_type == "Page":
                page_index += 1  # 0-based
                child_nodes = node.get("children") or []
                # 이 페이지의 자식들에 page 인덱스를 전파
                all_blocks.extend(extract_blocks_recursive(child_nodes, page=page_index))
            else:
                # 비-Page 루트 노드가 있을 수 있으므로 보수적으로 포함
                all_blocks.extend(extract_blocks_recursive([node], page=None))
        

        # 페이지 크기 추출 (상위 Page 노드 bbox 기반)
        page_sizes: Dict[int, Dict[str, float]] = {}
        try:
            top_children = json_doc.get("children") or []
            page_index = -1
            page_types = []
            for node in top_children:
                if not isinstance(node, dict):
                    continue
                page_types.append(str(node.get("block_type")))
                if str(node.get("block_type")) != "Page":
                    continue
                page_index += 1  # 0-based
                bbox = node.get("bbox") or []
                if (
                    isinstance(bbox, list) and len(bbox) == 4
                    and all(isinstance(v, (int, float)) for v in bbox)
                ):
                    width = float(bbox[2]) - float(bbox[0])
                    height = float(bbox[3]) - float(bbox[1])
                    if width <= 0 or height <= 0:
                        # 일부 구현은 x2,y2에 절대 크기를 두기도 하므로 보정
                        width = float(bbox[2])
                        height = float(bbox[3])
                else:
                    width = 0.0
                    height = 0.0
                page_sizes[page_index] = {"width": width, "height": height}
            
        except Exception:
            pass

        # 그룹핑: page 기준
        page_to_blocks: Dict[int, List[Dict[str, Any]]] = {}
        for block in all_blocks:
            page_val = block.get("page")
            if not isinstance(page_val, int):
                continue
            page_to_blocks.setdefault(page_val, []).append(block)

        pages: List[Dict[str, Any]] = []
        total_blocks = 0
        type_counts: Dict[str, int] = {}

        for page_zero_based in sorted(page_to_blocks.keys()):
            blocks_for_page = page_to_blocks[page_zero_based]
            block_entries: List[Dict[str, Any]] = []
            # 페이지 전체 박스(Page 타입 또는 페이지 전체를 덮는 bbox)는 필터링
            page_size = page_sizes.get(page_zero_based, {"width": 0.0, "height": 0.0})
            tol = 0.5  # pt 단위 허용 오차
            for block in blocks_for_page:
                block_type_str = str(block.get("block_type")) if block.get("block_type") is not None else ""
                if block_type_str == "Page":
                    # 전체 페이지 박스는 제외
                    continue
                bbox_val = block.get("bbox")
                if (
                    isinstance(bbox_val, list) and len(bbox_val) == 4
                    and all(isinstance(v, (int, float)) for v in bbox_val)
                ):
                    bw = float(bbox_val[2]) - float(bbox_val[0])
                    bh = float(bbox_val[3]) - float(bbox_val[1])
                    if bw <= 0 or bh <= 0:
                        # 일부 구현은 x2,y2에 절대 크기를 두기도 하므로 보정
                        bw = float(bbox_val[2])
                        bh = float(bbox_val[3])
                    pw = float(page_size.get("width", 0.0))
                    ph = float(page_size.get("height", 0.0))
                    if abs(bw - pw) <= tol and abs(bh - ph) <= tol:
                        # 페이지 전체를 덮는 박스는 제외
                        continue
                blk = {
                    "id": block.get("id"),
                    "type": block.get("block_type"),
                    "bbox": block.get("bbox"),
                    "text": block.get("text", ""),
                }
                block_entries.append(blk)
                total_blocks += 1
                t = block.get("block_type")
                if isinstance(t, str):
                    type_counts[t] = type_counts.get(t, 0) + 1

            page_meta = {
                "pageId": page_zero_based + 1,
                "size": page_sizes.get(page_zero_based, {"width": 0.0, "height": 0.0}),
                "blocks": block_entries,
            }
            pages.append(page_meta)

        # stats 강제 정규화: 숫자형 보장
        def _as_int(value: Any) -> int:
            try:
                return int(value)
            except Exception:
                return 0

        by_type_normalized = {str(k): _as_int(v) for k, v in type_counts.items()}
        layout = {
            "version": 2,
            "units": "pt",
            "origin": "top-left",
            "pages": pages,
            "stats": {
                "pages": _as_int(len(pages)),
                "blocks": _as_int(total_blocks),
                "byType": by_type_normalized,
            },
        }
        
        return layout

    # -------- Preflight: 페이지 추정 및 토큰 산정 --------
    def preflight_parse(self, data: bytes, *, usage: Dict[str, Any]) -> Dict[str, Any]:
        """경량 프리플라이트: 페이지 수를 추정(가능 시)하여 예상 토큰을 산정합니다.

        반환: {
          estimatedPageCount: int,
          estimatedTokenCount: int,
          canProceed: bool,
          reason: Optional[str]
        }
        """
        def _safe_int(x: Any, default: int = 0) -> int:
            try:
                return int(x)
            except Exception:
                return int(default)

        per_page = _safe_int((usage.get("costMultipliers") or {}).get("perPage"), 40)
        remaining = _safe_int(usage.get("remainingTokens"), 0)

        estimated_pages = 0
        try:
            # PDF 메타에서 페이지 수 경량 추정: /Type /Pages ... /Count N 우선 사용
            text = None
            try:
                text = (data or b"").decode("latin-1", errors="ignore")
            except Exception:
                text = ""
            if text:
                m = _RE_PAGES_COUNT.search(text)
                if m:
                    estimated_pages = int(m.group(1))
                if estimated_pages <= 0:
                    # 폴백: 개별 페이지 엔트리 수를 카운트(/Type /Page, 단 /Pages 제외)
                    estimated_pages = int(len(_RE_PAGE_ENTRIES.findall(text)))
        except Exception:
            estimated_pages = 0

        estimated_tokens = max(0, int(estimated_pages) * int(per_page))
        can_proceed = bool(estimated_tokens <= remaining)
        reason = None if can_proceed else "insufficient_tokens"

        return {
            "estimatedPageCount": int(estimated_pages),
            "estimatedTokenCount": int(estimated_tokens),
            "canProceed": can_proceed,
            "reason": reason,
        }

# 전역 인스턴스
parse_manager = ParseManager()
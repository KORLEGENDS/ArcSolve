"""
1단계: PDF 파싱 단계 모듈.

역할:
- Marker 라이브러리를 직접 호출하여 PDF를 파싱한다.
- 다운스트림 파이프라인에서 필요한 최소 정보만 반환한다.

반환 형식(dict):
{
  "pdf_path": str,
  "file_name": str,
  "file_size": int,
  "markdown": str,
  "layout": dict,
  "metrics": dict,
}
"""

from __future__ import annotations

import json
import mimetypes
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict
from marker.renderers.json import JSONRenderer  # type: ignore
from marker.renderers.markdown import MarkdownRenderer  # type: ignore


# -------- HTML/마크다운 보조 정규식 --------
_RE_FENCED_CODEBLOCK = re.compile(r"```[\s\S]*?```")
_RE_INLINE_CODE = re.compile(r"`[^`]*`")
_RE_AUTOLINK = re.compile(r"<https?://[^>]+>")
_RE_RAW_HTML = re.compile(r"<[A-Za-z!/][^>]*>")
_RE_EXCESSIVE_NEWLINES = re.compile(r"\n{3,}")

_RE_HTML_TAG = re.compile(r"<[^>]+>")
_RE_SPACES = re.compile(r"\s+")


def parse_document_step(file_path: str) -> Dict[str, Any]:
    """
    단일 파일 경로를 입력받아 파싱 결과를 반환한다.

    Marker 파서가 지원하는 다양한 파일 타입을 처리한다.
    (PDF / 이미지 / DOCX / PPTX / XLSX / EPUB / HTML 등)

    반환 형식(dict)은 기존 parse_pdf_step 과 동일하며, mime_type 필드가 추가된다.
    {
      "pdf_path": str,      # 실제 파일 경로 (기존 키 이름 유지)
      "file_name": str,
      "file_size": int,
      "mime_type": str | None,
      "markdown": str,
      "layout": dict,
      "metrics": dict,
    }
    """
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")

    # --- 내부 유틸 함수들 (이 함수 안에서만 사용) ---

    def _clean_markdown_remove_raw_html(markdown_text: Optional[str]) -> str:
        """마크다운 문자열에서 원시 HTML 태그를 제거한다."""
        if not isinstance(markdown_text, str) or not markdown_text:
            return ""

        text = markdown_text

        # 1) 코드블록/인라인코드를 플레이스홀더로 치환하여 보호
        code_blocks: List[str] = []
        inline_codes: List[str] = []

        def _store_code_block(m: re.Match[str]) -> str:
            code_blocks.append(m.group(0))
            return f"@@CODEBLOCK_{len(code_blocks) - 1}@@"

        def _store_inline_code(m: re.Match[str]) -> str:
            inline_codes.append(m.group(0))
            return f"@@INLINECODE_{len(inline_codes) - 1}@@"

        text_local = _RE_FENCED_CODEBLOCK.sub(_store_code_block, text)
        text_local = _RE_INLINE_CODE.sub(_store_inline_code, text_local)

        # 2) 자동 링크 보호
        autolinks: List[str] = []

        def _store_autolink(m: re.Match[str]) -> str:
            autolinks.append(m.group(0))
            return f"@@AUTOLINK_{len(autolinks) - 1}@@"

        text_local = _RE_AUTOLINK.sub(_store_autolink, text_local)

        # 3) 원시 HTML 태그 제거
        text_local = _RE_RAW_HTML.sub("", text_local)

        # 4) 플레이스홀더 복원
        for i, v in enumerate(autolinks):
            text_local = text_local.replace(f"@@AUTOLINK_{i}@@", v)
        for i, v in enumerate(inline_codes):
            text_local = text_local.replace(f"@@INLINECODE_{i}@@", v)
        for i, v in enumerate(code_blocks):
            text_local = text_local.replace(f"@@CODEBLOCK_{i}@@", v)

        # 5) 공백 정리
        text_local = _RE_EXCESSIVE_NEWLINES.sub("\n\n", text_local)
        return text_local.strip()

    def _html_to_text(html: Optional[str]) -> str:
        """Marker JSON의 html 필드를 단순 텍스트로 정규화한다."""
        if not isinstance(html, str) or not html:
            return ""
        try:
            text_local = _RE_HTML_TAG.sub(" ", html)
            text_local = _RE_SPACES.sub(" ", text_local)
            return text_local.strip()
        except Exception:
            return html

    def _build_document_once(pdf_path_str: str) -> Any:
        """
        PdfConverter.build_document를 한 번만 호출해 내부 문서 객체를 생성한다.

        실제 파일 포맷(PDF / 이미지 / DOCX / PPTX / XLSX / EPUB / HTML 등)은
        marker.providers.registry.provider_from_filepath 가 자동으로
        적절한 Provider를 선택해 처리한다.
        """
        converter = PdfConverter(
            artifact_dict=create_model_dict(),
        )
        document_local = converter.build_document(pdf_path_str)  # type: ignore[attr-defined]
        return document_local

    def _render_json(document: Any) -> Dict[str, Any]:
        """이미 구축된 문서에 대해 JSON 렌더만 수행."""
        rendered = JSONRenderer()(document)

        if isinstance(rendered, Dict):
            return rendered

        # pydantic v2 스타일
        if hasattr(rendered, "model_dump"):
            try:
                dumped = rendered.model_dump()
                if isinstance(dumped, Dict):
                    return dumped
            except Exception:
                pass

        # pydantic v1 스타일
        if hasattr(rendered, "dict"):
            try:
                dumped = rendered.dict()
                if isinstance(dumped, Dict):
                    return dumped
            except Exception:
                pass

        # 마지막 폴백: json() → dict
        if hasattr(rendered, "json"):
            try:
                dumped = json.loads(rendered.json())
                if isinstance(dumped, Dict):
                    return dumped
            except Exception:
                pass

        return dict(rendered)  # type: ignore[arg-type, return-value]

    def _render_markdown(document: Any) -> str:
        """이미 구축된 문서에 대해 Markdown 렌더만 수행."""
        rendered_md = MarkdownRenderer()(document)

        if hasattr(rendered_md, "markdown"):
            try:
                value = getattr(rendered_md, "markdown")
                return value if isinstance(value, str) else str(value)
            except Exception:
                pass

        if isinstance(rendered_md, dict) and isinstance(rendered_md.get("markdown"), str):
            return rendered_md["markdown"]

        return rendered_md if isinstance(rendered_md, str) else str(rendered_md)

    def _build_layout_from_json(json_doc: Dict[str, Any]) -> Dict[str, Any]:
        """DB 저장용 최소 오버레이 레이아웃 스키마를 생성한다."""

        def extract_blocks_recursive(nodes: List[Dict[str, Any]], page: Optional[int] = None) -> List[Dict[str, Any]]:
            blocks: List[Dict[str, Any]] = []
            for node in nodes:
                if not isinstance(node, dict):
                    continue

                meta: Dict[str, Any] = {
                    "id": node.get("id"),
                    "block_type": node.get("block_type"),
                    "bbox": node.get("bbox"),
                    "page": node.get("page") or page,
                }

                html_val = node.get("html", "")
                meta["text"] = _html_to_text(html_val)
                blocks.append(meta)

                if node.get("children"):
                    child_nodes = node["children"]
                    if isinstance(child_nodes, list):
                        blocks.extend(extract_blocks_recursive(child_nodes, meta["page"]))

            return blocks

        top_children = json_doc.get("children") or []
        if not isinstance(top_children, list):
            top_children = []

        all_blocks: List[Dict[str, Any]] = []
        page_index_local = -1
        for node in top_children:
            if not isinstance(node, dict):
                continue

            node_type = str(node.get("block_type")) if node.get("block_type") is not None else ""
            if node_type == "Page":
                page_index_local += 1
                child_nodes = node.get("children") or []
                if not isinstance(child_nodes, list):
                    child_nodes = []
                all_blocks.extend(extract_blocks_recursive(child_nodes, page=page_index_local))
            else:
                all_blocks.extend(extract_blocks_recursive([node], page=None))

        page_sizes: Dict[int, Dict[str, float]] = {}
        page_index_local = -1
        top_children = json_doc.get("children") or []
        if not isinstance(top_children, list):
            top_children = []

        for node in top_children:
            if not isinstance(node, dict):
                continue
            if str(node.get("block_type")) != "Page":
                continue

            page_index_local += 1
            bbox = node.get("bbox") or []
            if (
                isinstance(bbox, list)
                and len(bbox) == 4
                and all(isinstance(v, (int, float)) for v in bbox)
            ):
                width = float(bbox[2]) - float(bbox[0])
                height = float(bbox[3]) - float(bbox[1])
                if width <= 0 or height <= 0:
                    width = float(bbox[2])
                    height = float(bbox[3])
            else:
                width = 0.0
                height = 0.0

            page_sizes[page_index_local] = {"width": width, "height": height}

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

            page_size = page_sizes.get(page_zero_based, {"width": 0.0, "height": 0.0})
            tol = 0.5

            for block in blocks_for_page:
                block_type_str = str(block.get("block_type")) if block.get("block_type") is not None else ""
                if block_type_str == "Page":
                    continue

                bbox_val = block.get("bbox")
                if (
                    isinstance(bbox_val, list)
                    and len(bbox_val) == 4
                    and all(isinstance(v, (int, float)) for v in bbox_val)
                ):
                    bw = float(bbox_val[2]) - float(bbox_val[0])
                    bh = float(bbox_val[3]) - float(bbox_val[1])
                    if bw <= 0 or bh <= 0:
                        bw = float(bbox_val[2])
                        bh = float(bbox_val[3])

                    pw = float(page_size.get("width", 0.0))
                    ph = float(page_size.get("height", 0.0))
                    if abs(bw - pw) <= tol and abs(bh - ph) <= tol:
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

        def _as_int(value: Any) -> int:
            try:
                return int(value)
            except Exception:
                return 0

        by_type_normalized = {str(k): _as_int(v) for k, v in type_counts.items()}

        layout_local: Dict[str, Any] = {
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
        return layout_local

    def _calculate_metrics(markdown_text: Optional[str], layout: Dict[str, Any]) -> Dict[str, int]:
        """마크다운/레이아웃으로부터 간단한 메트릭을 계산한다."""
        content_length = len(markdown_text) if isinstance(markdown_text, str) else 0
        try:
            page_count = int(layout.get("stats", {}).get("pages", 0)) if isinstance(layout, dict) else 0
        except Exception:
            page_count = 0

        return {
            "contentLength": content_length,
            "pageCount": page_count,
        }

    # --- Marker 파이프라인 실행 ---
    document = _build_document_once(str(path))
    json_doc = _render_json(document)
    full_markdown = _render_markdown(document)
    cleaned_markdown = _clean_markdown_remove_raw_html(full_markdown)
    minimal_layout = _build_layout_from_json(json_doc)
    metrics = _calculate_metrics(cleaned_markdown, minimal_layout)

    mime_type, _ = mimetypes.guess_type(path.name)

    return {
        "pdf_path": str(path),
        "file_name": path.name,
        "file_size": path.stat().st_size,
        "mime_type": mime_type,
        "markdown": cleaned_markdown or "",
        "layout": minimal_layout or {},
        "metrics": metrics or {},
    }


def parse_pdf_step(pdf_path: str) -> Dict[str, Any]:
    """
    (호환용) 기존 PDF 전용 함수 시그니처를 유지한다.
    내부적으로는 일반화된 parse_document_step을 호출한다.
    """
    return parse_document_step(pdf_path)

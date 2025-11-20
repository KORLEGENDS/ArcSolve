from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List
import re
import unicodedata


@dataclass
class NormalizerConfig:
    min_caption_duration_ms: int = 300
    merge_gap_ms: int = 250


def normalize_text_for_compare(text: str) -> str:
    try:
        s = unicodedata.normalize("NFKC", str(text or ""))
    except Exception:
        s = str(text or "")
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    return s


def suffix_prefix_overlap_len(a: str, b: str) -> int:
    try:
        max_len = min(len(a), len(b))
        for L in range(max_len, 0, -1):
            if a.endswith(b[:L]):
                return L
        return 0
    except Exception:
        return 0


def join_lines_preserving_boundaries(lines: List[str]) -> str:
    out: List[str] = []
    for raw in lines or []:
        t = (raw or "").strip()
        if not t:
            continue
        if t.startswith("- ") or t.startswith(">>"):
            out.append(t)
            continue
        if out and re.search(r"[\.\!?…]$", out[-1]):
            out.append(t)
        else:
            if out:
                out[-1] = (out[-1] + " " + t).strip()
            else:
                out.append(t)
    return " ".join(out).strip()


def normalize(cues_ms: List[Dict[str, Any]], config: NormalizerConfig | None = None) -> List[Dict[str, Any]]:
    cfg = config or NormalizerConfig()
    if not cues_ms:
        return []

    try:
        cues_sorted = sorted(
            cues_ms,
            key=lambda c: (int(c.get("start_ms", 0)), int(c.get("end_ms", 0))),
        )
    except Exception:
        cues_sorted = list(cues_ms)

    merged: List[Dict[str, Any]] = []
    for c in cues_sorted:
        try:
            s = int(c.get("start_ms", 0))
        except Exception:
            s = 0
        try:
            e = int(c.get("end_ms", 0))
        except Exception:
            e = 0
        if e < s:
            e = s

        raw_text = str(c.get("text", ""))
        # 라인 결합은 정규화 파이프라인에서 수행
        text_joined = join_lines_preserving_boundaries(raw_text.splitlines())
        if not text_joined:
            continue

        tn = normalize_text_for_compare(text_joined)

        if merged:
            last = merged[-1]
            last_t = str(last.get("text", ""))
            last_tn = normalize_text_for_compare(last_t)
            last_end = int(last.get("end_ms", 0))
            overlap_or_adjacent = s <= last_end or (s - last_end) <= int(cfg.merge_gap_ms)
            sp_overlap = suffix_prefix_overlap_len(last_tn, tn) > 0
            super_or_sub = tn == last_tn or tn.startswith(last_tn) or last_tn.startswith(tn)
            if overlap_or_adjacent and (super_or_sub or sp_overlap):
                if len(tn) >= len(last_tn):
                    last["text"] = text_joined
                last["start_ms"] = min(int(last.get("start_ms", s)), s)
                last["end_ms"] = max(int(last.get("end_ms", e)), e)
                continue

        merged.append({"start_ms": s, "end_ms": e, "text": text_joined})

    # 최소 지속 보정 및 초 단위 segments 변환
    segments: List[Dict[str, Any]] = []
    for c in merged:
        s = max(0, int(c.get("start_ms", 0)))
        e = int(c.get("end_ms", 0))
        if e < s + int(cfg.min_caption_duration_ms):
            e = s + int(cfg.min_caption_duration_ms)
        t = str(c.get("text", "")).strip()
        if not t:
            continue
        segments.append({
            "start": float(s) / 1000.0,
            "end": float(e) / 1000.0,
            "text": t,
        })

    return segments



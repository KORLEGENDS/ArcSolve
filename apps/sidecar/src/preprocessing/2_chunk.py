"""
2단계: 마크다운 청킹 단계 모듈.

역할:
- LangChain RecursiveCharacterTextSplitter를 사용해 마크다운 텍스트를
  약 300 토큰 단위로 재귀적 청킹한다.

반환 형식(list[str]):
- 각 원소는 하나의 청크 텍스트이다.
"""

from __future__ import annotations

from typing import List

from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_markdown_step(markdown: str, chunk_size: int = 300, chunk_overlap: int = 0) -> List[str]:
    """
    마크다운 문자열을 토큰 기준으로 청킹한다.

    - chunk_size: 목표 토큰 수(대략적인 기준, tiktoken 기반)
    - chunk_overlap: 청크 간 중첩 토큰 수
    """
    if not isinstance(markdown, str) or not markdown:
        return []

    splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        model_name="gpt-4o",  # 또는 cl100k_base
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    return splitter.split_text(markdown)



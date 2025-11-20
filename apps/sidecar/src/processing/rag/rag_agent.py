"""
LangGraph 기반 RAG 에이전트.

- 입력:
  - user_id: 검색 대상 사용자의 UUID
  - path_prefix: Document.path ltree prefix (예: "root.demo") 로 검색 범위 제한 (선택)
- 동작:
  - LangGraph `create_react_agent` 를 사용해
    1) DB 검색이 필요한지 여부를 판단하고
    2) 필요 시 임베딩/텍스트 검색 도구를 호출해 문맥을 조회한 뒤
    3) 최종 답변을 생성한다.

기존 DB 검색 도구:
- `src/processing/tools/query_embed_search.py`
- `src/processing/tools/query_text_search.py`

을 그대로 래핑해서 LangGraph Tool 로 노출한다.
"""

from __future__ import annotations

import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

# ---------------------------------------------------------------------------
# tools 모듈 import 경로 보정
# ---------------------------------------------------------------------------

_THIS_DIR = Path(__file__).resolve().parent
_TOOLS_DIR = _THIS_DIR.parent / "tools"

if str(_TOOLS_DIR) not in sys.path:
    sys.path.append(str(_TOOLS_DIR))

from query_embed_search import query_embed_search  # type: ignore[import]
from query_text_search import query_text_search  # type: ignore[import]


DEFAULT_MODEL = "gpt-4o-mini"


def _normalize_user_id(user_id: uuid.UUID | str) -> uuid.UUID:
    if isinstance(user_id, uuid.UUID):
        return user_id
    if not isinstance(user_id, str):
        raise TypeError("user_id는 uuid.UUID 또는 str이어야 합니다.")
    return uuid.UUID(user_id)


SYSTEM_PROMPT = """You are a helpful assistant for a personal knowledge base service.

You can access the user's stored documents via tools:
- `embed_search`: semantic / embedding-based search over the user's document chunks.
- `text_search`: keyword / full-text search over the user's document chunks.

Rules:
- If the question clearly depends on the user's stored documents (notes, files, PDFs, etc.),
  you SHOULD call one of the tools to search first, then answer using the retrieved context.
- If the question is general knowledge, programming, or otherwise does NOT depend on the
  user's stored documents, you SHOULD answer directly without calling tools.
- Prefer `embed_search` for open-ended, semantic, or summarization style queries.
- Prefer `text_search` for exact keyword, title, or phrase lookups.
- If tools return no relevant results, say that the documents do not contain the answer,
  and (optionally) fall back to your general knowledge, clearly marking speculation.
"""


def _extract_answer_from_messages(messages: Sequence[Any]) -> str:
    """LangGraph state의 messages에서 최종 답변 텍스트만 뽑아낸다."""
    if not messages:
        return ""

    last_msg = messages[-1]
    content = getattr(last_msg, "content", None)

    if isinstance(content, str):
        return content

    # content 가 segment 리스트인 경우 (예: [{"type": "text", "text": "..."}])
    if isinstance(content, list):
        parts: List[str] = []
        for part in content:
            if isinstance(part, dict) and "text" in part:
                text = part.get("text")
                if isinstance(text, str):
                    parts.append(text)
        if parts:
            return "\n".join(parts)
        return str(content)

    return "" if content is None else str(content)


class RAGAgent:
    """
    단일 사용자/경로에 대해 LangGraph 기반 RAG 에이전트를 캡슐화한 클래스.

    - 생성 시점에 user_id / path_prefix / 모델명을 고정
    - 내부적으로 create_react_agent + DB 검색 도구(embed/text)를 구성
    - 라우트 레벨에서는 이 클래스를 생성한 뒤, `invoke` 또는 `stream`만 호출하면 됨
    """

    def __init__(
        self,
        user_id: uuid.UUID | str,
        path_prefix: Optional[str] = None,
        model_name: str = DEFAULT_MODEL,
    ) -> None:
        self.user_id = _normalize_user_id(user_id)
        self.path_prefix = path_prefix
        self.model_name = model_name

        tools = self._build_db_tools()
        llm = ChatOpenAI(model=self.model_name, temperature=0)

        self._agent = create_react_agent(
            model=llm,
            tools=tools,
            prompt=SYSTEM_PROMPT,
        )

    # ------------------------------------------------------------------ #
    # 내부 구성 요소
    # ------------------------------------------------------------------ #
    def _build_db_tools(self) -> List[Any]:
        """
        현재 user_id / path_prefix 에 고정된 DB 검색 Tool 들을 생성한다.

        - embed_search: 의미론적(임베딩) 검색
        - text_search: 텍스트(full-text) 검색
        """
        user_id = self.user_id
        path_prefix = self.path_prefix

        @tool
        def embed_search(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
            """사용자의 DocumentChunk에서 의미론적(임베딩) 검색을 수행한다."""
            return query_embed_search(
                user_id=user_id,
                query=query,
                top_k=top_k,
                path_prefix=path_prefix,
            )

        @tool
        def text_search(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
            """사용자의 DocumentChunk에서 텍스트(full-text) 기반 검색을 수행한다."""
            return query_text_search(
                user_id=user_id,
                query=query,
                top_k=top_k,
                path_prefix=path_prefix,
            )

        return [embed_search, text_search]

    # ------------------------------------------------------------------ #
    # 공개 인터페이스: 동기 호출 + 스트리밍
    # ------------------------------------------------------------------ #
    def invoke(self, query: str) -> Dict[str, Any]:
        """
        단일 질의를 동기적으로 처리하고, 최종 답변/메시지 전체를 반환한다.

        반환 예시:
        {
          "answer": "...",
          "messages": [...],  # LangGraph state의 messages
        }
        """
        state = self._agent.invoke(
            {"messages": [{"role": "user", "content": query}]},
        )
        messages: Sequence[Any] = state.get("messages", [])  # type: ignore[assignment]
        answer = _extract_answer_from_messages(messages)
        return {"answer": answer, "messages": messages}

    def stream(self, query: str):
        """
        LangGraph 에이전트의 메시지를 그대로 스트리밍하는 제너레이터.

        FastAPI 등의 라우트에서 SSE/WebSocket 으로 바로 전달하기 좋은 형태.

        for message, metadata in rag_agent.stream(query):
            ...
        """
        for message, metadata in self._agent.stream(
            input={"messages": [{"role": "user", "content": query}]},
            stream_mode="messages",
        ):
            yield message, metadata




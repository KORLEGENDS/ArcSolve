## 개요

이 문서는 ArcYou 사이드카 서버의 **LangGraph 기반 RAG 에이전트** 구현(`rag_agent.py`)을 설명합니다.  
RAG 에이전트는 사용자의 질의에 대해, 필요 시 DB에 저장된 문서 청크를 검색 도구를 통해 조회하고 그 결과를 바탕으로 답변을 생성합니다.

- **코드 위치**: `src/processing/rag/`
  - `rag_agent.py`
- **연동 도구**: `src/processing/tools/`
  - `query_embed_search.py` – 임베딩 기반 의미 검색
  - `query_text_search.py` – 텍스트(full-text) 기반 검색

---

## 전체 동작 개요

### **입력 및 역할**

- 입력:
  - `user_id`: 검색 대상 사용자의 UUID
  - `path_prefix`: `Document.path` 의 `ltree` prefix (예: `"root.demo"`) – 검색 범위 제한 (선택)
  - `query`: 사용자의 자연어 질의
- 역할:
  1. 질의가 **사용자 문서에 의존하는지** 여부를 LangGraph 에이전트가 판단
  2. 필요 시 DB 검색 도구(`embed_search` / `text_search`)를 호출해 문맥 청크를 조회
  3. 조회된 문맥을 기반으로 최종 자연어 답변을 생성

이 과정은 LangGraph의 `create_react_agent` 에 `ChatOpenAI` 모델과 도구들을 연결하여 구현됩니다.

---

## RAGAgent 클래스

### **생성자**

```python
class RAGAgent:
    def __init__(
        self,
        user_id: uuid.UUID | str,
        path_prefix: Optional[str] = None,
        model_name: str = "gpt-4o-mini",
    ) -> None:
        ...
```

- **특징**
  - **단일 사용자 / 경로 컨텍스트**에 묶인 RAG 에이전트를 캡슐화
  - 생성 시점에:
    - `user_id` → `_normalize_user_id` 로 `uuid.UUID` 로 정규화
    - `path_prefix` → 모든 검색 도구에 공통으로 전달되는 경로 필터
    - `model_name` → `ChatOpenAI` 에 사용될 OpenAI 채팅 모델 (기본 `"gpt-4o-mini"`)
  - 내부에서:
    - `_build_db_tools()` 로 LangChain Tool 형태의 `embed_search`, `text_search` 생성
    - `ChatOpenAI(model=self.model_name, temperature=0)` 인스턴스 생성
    - `create_react_agent(model=llm, tools=tools, prompt=SYSTEM_PROMPT)` 로 LangGraph 에이전트 구성

### **시스템 프롬프트**

`SYSTEM_PROMPT` 문자열은 에이전트의 역할과 도구 사용 규칙을 정의합니다.

- 주요 규칙:
  - 질문이 **저장된 문서(노트, 파일, PDF 등)에 의존**하는 경우:
    - 먼저 `embed_search` 또는 `text_search` 도구를 호출해 문맥을 조회한 뒤 답변
  - 일반 상식/프로그래밍 등 **일반 지식**만으로 답변 가능한 경우:
    - 굳이 도구를 호출하지 않고 모델이 직접 답변
  - 도구 선택 기준:
    - **`embed_search`**: 개방형/요약/의미 기반 질의 (semantic search)
    - **`text_search`**: 정확한 키워드/제목/문구 검색 (full-text search)
  - 도구에서 유의미한 결과가 없으면:
    - “문서에 관련 정보가 없다”는 점을 명시하고,
    - 일반 지식으로 추론할 경우, **추측임을 명확히 표기**

---

## DB 검색 도구 래핑

### **내부 도구 구성 (`_build_db_tools`)**

```python
def _build_db_tools(self) -> List[Any]:
    @tool
    def embed_search(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        ...

    @tool
    def text_search(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        ...

    return [embed_search, text_search]
```

- 공통으로 고정되는 컨텍스트:
  - `user_id`: RAGAgent 생성 시 전달된 사용자 UUID
  - `path_prefix`: 특정 폴더/경로 하위만 검색하고 싶을 때 사용
- 각 Tool 의 내부 동작:
  - `embed_search`:
    - `query_embed_search(user_id=user_id, query=query, top_k=top_k, path_prefix=path_prefix)`
    - Snowflake Arctic Embed v2.0 + pgvector 기반 의미 검색
  - `text_search`:
    - `query_text_search(user_id=user_id, query=query, top_k=top_k, path_prefix=path_prefix)`
    - PostgreSQL full-text search 기반 키워드 검색
- 두 도구의 상세 스키마/쿼리 구조는 `docs/tools.md` 를 참고합니다.

---

## 메시지 처리 및 답변 추출

### **LangGraph 상태에서 답변 추출 (`_extract_answer_from_messages`)**

- LangGraph `state` 의 `messages` 배열에서 **마지막 메시지의 content** 만 깔끔하게 추출하는 유틸 함수입니다.
- 처리 규칙:
  - `content` 가 문자열이면 그대로 반환
  - `content` 가 segment 리스트 (예: `[{ "type": "text", "text": "..." }, ...]`) 인 경우:
    - 각 segment 에서 `"text"` 필드를 모아 줄바꿈으로 합친 문자열 반환
  - 그 외 타입은 `str(content)` 로 포맷팅하거나, `None` 이면 빈 문자열 반환

이 함수는 `invoke` 메서드의 최종 `answer` 값을 만들 때 사용됩니다.

---

## 사용 방법

### **1. 동기 호출 (`invoke`)**

```python
from src.processing.rag.rag_agent import RAGAgent
import uuid

user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
rag_agent = RAGAgent(
    user_id=user_id,
    path_prefix="root.demo",    # 선택: 특정 폴더 하위만 검색
    model_name="gpt-4o-mini",   # 기본값
)

result = rag_agent.invoke("업로드한 PDF에서 임베딩 모델 관련 내용을 요약해줘")
print(result["answer"])
```

- `invoke(query: str) -> dict` 반환 구조:

```python
{
  "answer": str,        # 최종 자연어 답변
  "messages": [...],    # LangGraph state 의 전체 메시지 흐름
}
```

서비스 레이어에서는 보통 `answer` 만 사용하거나, 디버깅/로그용으로 `messages` 를 함께 저장할 수 있습니다.

### **2. 스트리밍 호출 (`stream`)**

```python
for message, metadata in rag_agent.stream("문서에서 RAG 파이프라인 개요만 뽑아서 설명해줘"):
    # message: LangGraph 메시지 객체
    # metadata: {"langgraph_step": ..., ...} 형태의 메타데이터
    ...
```

- `stream(query: str)` 는 **제너레이터**를 반환하며, LangGraph가 생성하는 메시지를 실시간으로 방출합니다.
- FastAPI 와 연동 시:
  - SSE(Server-Sent Events) / WebSocket 으로 `message` 내용을 그대로 스트리밍하는 패턴에 적합합니다.

---

## 환경 변수 및 의존성

- **OpenAI / LLM**
  - `ChatOpenAI` 사용을 위해 다음 환경변수가 필요합니다.
    - `OPENAI_API_KEY`
  - 기본 모델: `"gpt-4o-mini"` (코드 상 `DEFAULT_MODEL`)
- **DB / 검색 도구**
  - 실제 문서 검색은 `query_embed_search` / `query_text_search` 가 담당하며,
  - 이들 도구는 `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST`, `POSTGRES_PORT`
    등의 환경변수로 PostgreSQL 연결을 구성합니다.
  - 자세한 내용은 `docs/tools.md` 를 참고합니다.

---

## 운영 상 주의사항

- **언제 도구를 쓸지에 대한 책임은 모델에 있음**
  - 시스템 프롬프트에 따라, 에이전트가 스스로 문서 검색 필요 여부와 도구 선택을 판단합니다.
- **성능**
  - RAGAgent 자체는 가벼우나, 임베딩 검색 도구는 대형 임베딩 모델 로딩 비용이 있으므로
    - 워커 프로세스 재사용
    - 모델/DB 연결 캐시 유지
    - GPU(MPS/CUDA) 활용 등을 고려해야 합니다.
- **에러 처리**
  - DB 연결 실패, OpenAI API 에러 등은 RAGAgent 외부(라우트/서비스 레이어)에서
    - 재시도, fallback, 사용자 친화적인 에러 메시지로 감싸는 것을 권장합니다.



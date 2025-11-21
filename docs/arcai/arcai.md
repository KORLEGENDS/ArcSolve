## 1. ArcAI 개요

ArcAI는 ArcSolve 내에서 **문서(document) 기반 AI 채팅 세션을 제공하는 ArcWork 탭 타입**입니다.  
ArcData가 `documentId`를 기반으로 파일/노트를 렌더링하는 것처럼, ArcAI는 **`documentId`를 기반으로 AI 대화 상태를 로드·저장·스트리밍**합니다.

- **핵심 포인트**
  - ArcAI는 ArcWork의 하나의 탭 타입으로 동작합니다. (예: `type = 'arcai-session'`)
  - 각 ArcAI 탭은 **하나의 `document` 행(= AI 세션 문서)**와 1:1로 매핑됩니다.
  - 대화 히스토리는 `document_ai_message` / `document_ai_part` 테이블에 정규화된 형태로 저장됩니다.
  - API는 `GET /api/document/ai`(이전 대화 로드) / `POST /api/document/ai`(요청 + 스트리밍 응답) 두 개만 사용합니다.
  - 클라이언트는 `useAIConversation` + `useAIChat` 훅, 그리고 `ArcAI` 컴포넌트로 이 흐름을 캡슐화합니다.

---

## 2. 데이터 모델 (DB / Repository)

### 2.1 AI 문서(`document`) 레벨

ArcAI 세션은 `document` 테이블의 한 행으로 표현됩니다.

- **kind**
  - `kind = 'document'` (폴더/리프 구조만 구분 – ArcData/ArcWork 공통 규칙 재사용)
- **mimeType**
  - ArcAI 전용 MIME 타입:
    - `mimeType = 'application/vnd.arc.ai-chat+json'`
  - 이 MIME 타입을 통해 **“이 문서는 AI 채팅 세션이다”**를 식별합니다.
- **기타 메타데이터**
  - `path`: ArcWork/ArcManager 트리상 위치 (`ltree`)
  - `name`: 탭/리스트에 표시될 챗 이름 (초기에는 임시 값, 이후 제목 생성 모델로 갱신 예정)
  - `userId`, `createdAt`, `updatedAt` 등은 기존 문서 도메인 정책을 그대로 따릅니다.

### 2.2 대화 테이블: `document_ai_message` / `document_ai_part`

대화 자체는 `UIMessage[]`를 논리 포맷으로 사용하되, DB에는 **메시지·파트 단위로 정규화**해서 저장합니다.

- **`document_ai_message`**
  - `document_ai_message_id (uuid, PK)`
  - `document_id (uuid, FK → document.document_id, onDelete: 'cascade')`
  - `ui_message_id (text)` – AI SDK UIMessage.id
  - `role ('user' | 'assistant' | 'system' | 'tool')`
  - `index (int)` – 해당 문서 내 메시지 순서(0,1,2,…)
  - `metadata (jsonb | null)` – 토큰 수, 모델명 등 메시지 메타데이터
  - `created_at / updated_at / deleted_at`
  - **제약/인덱스**
    - `UNIQUE (document_id, index) WHERE deleted_at IS NULL`
    - `INDEX (ui_message_id)`

- **`document_ai_part`**
  - `document_ai_part_id (uuid, PK)`
  - `document_ai_message_id (uuid, FK → document_ai_message.document_ai_message_id, onDelete: 'cascade')`
  - `index (int)` – 메시지 내부 파트 순서(0,1,2,…)
  - `type (text)` – UI 파트 타입 (`'text'`, `'file'`, `'tool-call'`, `'tool-result'`, `'data-*'` 등)
  - `payload (jsonb)` – 해당 파트 전체(JSON) – `UIMessage['parts'][number]` 구조 그대로

### 2.3 `DocumentAiRepository`

`apps/main/src/share/schema/repositories/document-ai-repository.ts`

- **책임**
  - 특정 문서(documentId)에 대한 **전체 대화(UIMessage[])를 조회/저장**하는 리포지토리
  - 문서 소유자·타입(=AI 문서) 검증 포함

- **핵심 메서드**
  - `loadConversationForOwner({ documentId, userId }) => UIMessage[]`
    - `documents` 에서 `userId` + `documentId` + `deleted_at IS NULL` + `mimeType = 'application/vnd.arc.ai-chat+json'` 검증
    - `document_ai_message` / `document_ai_part` 를 `index ASC`로 조합해 `UIMessage[]` 복원
  - `replaceConversationForOwner({ documentId, userId, messages }) => void`
    - 트랜잭션 내에서:
      - 기존 `document_ai_message`(→ `document_ai_part` cascade 삭제)를 모두 제거
      - 새 `UIMessage[]`를 `index` 기준으로 다시 insert

> **정합성 규칙**  
> - 소유자·타입 검증은 항상 `DocumentAiRepository` 에서 수행합니다.  
> - Redis 캐시는 어디까지나 **성능 최적화용**이며, 정답 소스는 항상 Postgres 입니다.

---

## 3. API 레이어 (`/api/document/ai`)

### 3.1 공통 개요

- 파일: `apps/main/src/app/(backend)/api/document/ai/route.ts`
- 인증: `auth()` 세션 기반 – 로그인 사용자만 접근 가능
- 엔드포인트:
  - **GET** `/api/document/ai?documentId=...`
  - **POST** `/api/document/ai`
- 내부에서:
  - `DocumentAiRepository` + `loadConversationWithCache` 로 **Redis → Postgres** 순으로 대화 로드
  - AI SDK `streamText` + `toUIMessageStreamResponse` 로 스트리밍 응답 생성
  - RAG 도구: `embedSearch` / `textSearch` / `treeList` (`sidecar-tools.ts`)

### 3.2 GET /api/document/ai – 대화 히스토리 조회

**요청**

- 쿼리 파라미터:
  - `documentId: string (uuid)` – AI 세션 문서 ID

**동작**

1. `auth()`로 사용자 인증 → `userId`
2. `DocumentAiRepository` 인스턴스 생성
3. `loadConversationWithCache({ documentId, userId, repository })` 호출
   - Redis `ai:conversation:<userId>:<documentId>` → 파싱 성공 시 바로 반환
   - 없거나 손상된 경우:
     - `DocumentAiRepository.loadConversationForOwner` 로 Postgres 조회
     - 결과를 Redis 에 스냅샷으로 저장 후 반환

**응답 (성공 시 200)**

```ts
{
  documentId: string;
  mimeType: 'application/vnd.arc.ai-chat+json';
  messages: UIMessage[];
}
```

**문서가 아직 없는 경우(의도된 UX)**

- 현재 구현에서는 `DocumentAiRepository`에서 `NOT_FOUND` 가 발생하여 404 에러를 반환합니다.
- 클라이언트 `useAIConversation` 훅은 이 에러를 **표면에 노출하지 않고**, 단순히 `messages = []` 상태로 시작합니다.
- ArcAI UI는 “기록이 없는 새 세션”으로 인식하고 빈 화면에서 바로 입력을 받을 수 있습니다.

> **향후 개선 방향(설계)**  
> - 장기적으로는 `GET /api/document/ai`가 **존재하지 않는 documentId에 대해서도 200 + 빈 메시지**를 반환하도록 완화하여,  
>   새 UUID 기반 세션일 때 서버/클라이언트 모두에서 에러를 전혀 발생시키지 않는 방향을 고려합니다.

### 3.3 POST /api/document/ai – 요청 처리 + 스트리밍 응답

**요청 Body**

```ts
{
  documentId: string;   // ArcWork 탭 id 로 사용되는 세션 ID
  messages: UIMessage[] // 이번 턴에서 추가된 메시지들 (보통 마지막 user 메시지 1개)
}
```

**서버 동작(요약)**

1. `auth()` → `userId`
2. `requestBodySchema`로 `documentId` / `messages` 검증
3. `DocumentAiRepository` 인스턴스 생성
4. `loadConversationWithCache({ documentId, userId, repository })` 로 이전 히스토리 복원
5. `allMessages = [...previousMessages, ...newMessages]`
6. AI SDK:
   - `validateUIMessages({ messages: allMessages })`
   - `streamText({ model: openai('gpt-4o'), system: SYSTEM_PROMPT, messages: convertToModelMessages(validatedMessages), tools: { ... } })`
   - `toUIMessageStreamResponse(...)` 로 UIMessage 스트림으로 래핑
7. `onFinish` 훅에서:
   - `DocumentAiRepository.replaceConversationForOwner` 로 전체 대화 히스토리를 Postgres에 저장
   - `saveConversationSnapshot` 으로 Redis `ai:conversation:*` 갱신
   - 마지막 user 메시지를 `saveLastAiUserMessage` 로 별도 캐시

**첫 요청에서 문서가 없는 경우 (의도된 설계)**

사용자 플로우 상, ArcAI 탭은 **미리 생성한 UUID(documentId)** 를 들고 있지만, 실제 DB에는 아직 문서가 없을 수 있습니다.

의도된 흐름:

1. ArcAI 탭 생성 시:
   - 클라이언트에서 `documentId = crypto.randomUUID()` 로 세션 ID 생성
   - ArcWork 탭 메타: `{ id: documentId, name: '새 채팅', type: 'arcai-session' }`
   - 즉시 `GET /api/document/ai?documentId=...` 를 호출
     - 문서가 없으므로 404 → 클라이언트는 이를 “빈 히스토리”로 취급
2. 사용자가 첫 질문을 전송 (`POST /api/document/ai`):
   - **목표 동작(설계)**:
     - `DocumentRepository`를 통해 `documentId` 를 PK로 갖는 **AI 문서(document)** 를 lazy 생성
       - `kind = 'document'`
       - `mimeType = 'application/vnd.arc.ai-chat+json'`
       - `name = '(임시) 새 채팅'` 등
     - 그 뒤 `DocumentAiRepository.replaceConversationForOwner` 를 호출해 대화 저장
   - 현재 구현은 아직 “문서가 없으면 생성” 로직이 들어가 있지 않으며,  
     이 부분은 후속 단계에서 **`DocumentAiRepository` + `DocumentRepository`를 조합한 lazy-create 트랜잭션**으로 확장할 예정입니다.

**첫 요청 시 제목 생성 모델 + 응답 모델 병렬 구동(설계)**

첫 질문에 대해서는 다음과 같은 **이중 모델 패턴**을 사용하는 것을 목표로 합니다.

- **응답 모델(streaming)**:
  - 현재 구현되어 있는 `streamText` 기반 RAG 응답
  - 클라이언트에는 스트리밍으로 바로 표시
- **제목 생성 모델(non-streaming)**:
  - 별도의 `generateText` 또는 `streamText`(비스트리밍 사용) 호출로 “채팅 제목” 후보 생성
  - 응답 예: `"파일 전처리 파이프라인 설계 논의"`
  - 완료 후:
    - `document.name` 을 해당 제목으로 업데이트
    - ArcWork 탭 이름도 동기화 예정 (ArcWork store + ArcManager 연동 필요)

> 이 제목 생성 로직은 RAG 응답과 **병렬로 수행**되며,  
> 사용자는 스트리밍 응답을 기다리는 동안 탭 제목이 나중에 자연스럽게 바뀌는 경험을 하게 됩니다.

---

## 4. 클라이언트 레이어 (훅 + 컴포넌트)

### 4.1 React Query 훅: `useAIConversation`

파일: `apps/main/src/client/states/queries/ai/useAI.ts`

- **역할**
  - `GET /api/document/ai?documentId=...` 를 호출하여 **이전 대화 전체(UIMessage[])** 를 가져옵니다.
  - 서버 측에서는 Redis → Postgres 순으로 복원.

- **타입/반환값(요약)**

```ts
export type DocumentAIConversationResponse = {
  documentId: string;
  mimeType: string;
  messages: UIMessage[];
};

export function useAIConversation(documentId: string) {
  // data: DocumentAIConversationResponse | undefined
  // messages: UIMessage[]
  // isLoading / isError / error / refetch ...
}
```

- **404 처리**
  - 서버가 `NOT_FOUND` 를 반환해도, 훅은 단순히 `messages = []` 로 동작할 수 있도록 설계되어 있습니다.
  - ArcAI UI에서는 이를 “새 세션”으로 간주하고 빈 화면에서 입력만 받습니다.

### 4.2 AI SDK 훅: `useAIChat` (`useChat` 래핑)

파일: `apps/main/src/client/states/queries/ai/useAI.ts`

- **역할**
  - AI SDK `useChat` + `DefaultChatTransport` 를 프로젝트에 맞게 포장
  - `/api/document/ai` POST 스펙에 맞춰, **항상 마지막 메시지 1개만 서버로 전송**
  - `initialMessages`가 준비되면 `useEffect`로 `chat.setMessages`에 반영하여 히스토리 동기화

```ts
export interface UseAIChatOptions {
  documentId: string;
  initialMessages?: UIMessage[];
  resume?: boolean;  // 현재는 false (향후 resumable stream 도입 시 true로 전환 예정)
}

export function useAIChat(options: UseAIChatOptions) {
  const { documentId, initialMessages, resume } = options;

  const chat = useChat({
    id: documentId,
    messages: initialMessages ?? [],
    resume: resume ?? false,
    transport: new DefaultChatTransport({
      api: '/api/document/ai',
      prepareSendMessagesRequest: ({ id, messages }) => {
        const last = messages[messages.length - 1];
        return {
          body: {
            documentId: id,
            messages: last ? [last] : [],
          },
        };
      },
    }),
  });

  // 서버에서 불러온 초기 히스토리가 준비되면 useChat 상태에 주입
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      chat.setMessages(initialMessages);
    }
  }, [initialMessages, chat.setMessages]);

  return chat;
}
```

### 4.3 ArcAI 컴포넌트

파일: `apps/main/src/client/components/arc/ArcAI/ArcAI.tsx`

```ts
export interface ArcAIProps {
  /** ArcWork 탭 메타에서 넘어오는 document.documentId (UUID) */
  documentId: string;
}

export const ArcAI = ({ documentId }: ArcAIProps) => {
  // 서버에 저장된 이전 대화 히스토리 로드 (Redis → Postgres)
  const { messages: initialMessages, isLoading: isLoadingHistory } =
    useAIConversation(documentId);

  // AI SDK useChat 기반 스트리밍 훅
  const { messages, sendMessage, status } = useAIChat({
    documentId,
    initialMessages,
    // 현재는 스트림 재개(GET /api/document/ai/[id]/stream) 엔드포인트를
    // 구현하지 않았으므로 resume 기능은 비활성화합니다.
    // 필요 시 resumable-stream 패턴을 도입한 뒤 true로 전환합니다.
    resume: false,
  });

  const [draft, setDraft] = useState('');
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [didScrollAfterHistory, setDidScrollAfterHistory] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text) return;

      // 마지막 메시지 1개를 서버로 전송하면,
      // 나머지 히스토리는 서버에서 Redis/PG를 통해 복원합니다.
      void sendMessage({ text });
      setDraft('');
    },
    [draft, sendMessage],
  );

  // 간단한 로딩 처리: 히스토리 로딩 중에는 빈 상태만 표시
  return (
    <div className={styles.container}>
      <div className={styles.chatArea}>
        <ArcAIMessageList
          messages={messages}
          scrollTrigger={scrollTrigger}
          emptyTitle={
            isLoadingHistory ? '대화 히스토리를 불러오는 중입니다.' : undefined
          }
        />
      </div>

      <div className={styles.inputWrapper}>
        <ArcAIInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onSubmit={handleSubmit}
          submitDisabled={
            draft.trim().length === 0 ||
            status === 'streaming'
          }
        />
      </div>
    </div>
  );
};
```

- **상태 관리**
  - `draft`: 사용자가 입력 중인 텍스트 상태.
  - `scrollTrigger`: **이전 대화 히스토리 로딩이 끝난 직후 딱 한 번만** 하단으로 스크롤시키기 위한 트리거. 사용자 메시지 전송 시에는 더 이상 증가시키지 않아, 전송 직후 추가 스크롤 없이 곧바로 목적 상태로 렌더됩니다.
  - `didScrollAfterHistory`: 히스토리 로딩 후 스크롤이 한 번 실행되었는지 추적하는 플래그.

- **핵심 핸들러**
  - `handleSubmit`: `draft.trim()` 검사 → 비어 있으면 리턴. 그렇지 않으면 `sendMessage({ text })` 호출 후 `draft` 초기화.

- **UX 포인트**
  - **섹션 기반 렌더링**: ArcAIMessageList는 `UIMessage`를 섹션 단위(user + assistant)로 렌더링합니다.
  - **스트리밍 응답**: `useChat`의 `messages`가 스트리밍에 따라 업데이트되므로, ArcAIMessageList는 즉시 부분 응답을 표시합니다.
  - **스크롤 동작**: 히스토리 로딩 완료 시 한 번만 자동 스크롤, 그 외에는 StickToBottom의 기본 동작을 따름.

### 4.4 ArcAI UI 레이아웃 (ArcAIMessageList / ArcAIInput)

#### ArcAIMessageList

파일: `apps/main/src/client/components/arc/ArcAI/components/ArcAIMessageList/ArcAIMessageList.tsx`

- **역할**
  - `UIMessage[]`를 **섹션(`user` + 여러 `assistant`) 단위**로 묶어 렌더링.
  - 각 섹션의 `user` 메시지는 sticky 헤더(`.sectionHeader`)로 올라가고, 아래에 `assistant` 메시지들이 쌓임.

- **레이아웃 포인트**
  - `StickToBottom`(`Conversation`) + `ConversationContent` 조합으로 스크롤/오토스틱 관리.
  - CSS 규칙:
    - `.sectionHeader { position: sticky; top: 0; z-index: 5; }`
    - `.section.isLastSection .sectionContent { min-height: var(--last-section-min, 0px); }`
    - 마지막 섹션만 `--last-section-min = (컨테이너 높이 - 헤더 높이)`로 채워, 입력 직후에도 하단 공백 없이 헤더가 상단에 붙게 하는 구조.

- **스크롤 트리거**
  - `scrollTrigger` 값이 바뀌면 `useStickToBottomContext().scrollToBottom()`을 호출하는 `AutoScrollOnTrigger` 컴포넌트 사용.
  - **현재는 "히스토리 로딩 완료 시 1회만" 사용**하고, 사용자 전송 시에는 호출하지 않아 전송 직후 추가 스크롤 없이 곧바로 목적 상태로 렌더.

#### ArcAIInput

파일: `apps/main/src/client/components/arc/ArcAI/components/ArcAIInput/ArcAIInput.tsx`

- **역할**
  - 자동 높이 조절되는 textarea + 도구 버튼들 + 전송 버튼을 하나의 `<form>`으로 묶은 입력 컴포넌트.

- **UX 포인트**
  - `Enter` → 전송 (`Shift+Enter`는 줄바꿈), 한글 조합(`isComposing`) 중에는 전송 안 함.
  - `dataset.expanded` / `dataset.empty`를 통해 placeholder 오버레이와 폼 확장 상태를 CSS로만 제어.
  - 상위에서 `value`/`onChange`로 제어되므로, ArcAI의 `draft` 상태와 자연스럽게 동기화됨.

#### ArcAI 레이아웃 구조

파일: `apps/main/src/client/components/arc/ArcAI/ArcAI.module.css`

- **핵심 클래스 설명**
  - `.container`: ArcChat의 `arcChatContainer`에 해당, 전체 높이를 채우는 flex column + `overflow: hidden`.
  - `.chatArea`: 메시지 리스트 영역, `flex: 1` + `min-height: 0`.
  - `.inputWrapper`: 하단 오버레이 영역, absolute bottom + max-width + padding.

---

## 5. ArcWork / ArcManager 연동 플로우

### 5.1 ArcWork 탭 타입으로서 ArcAI

- ArcWork 탭 메타데이터:

```ts
const meta = {
  id: documentId,          // UUID – ArcAI 세션 ID
  name: '새 채팅',         // 초기 탭 제목 (이후 제목 생성 모델로 갱신 예정)
  type: 'arcai-session',   // ArcAI 전용 탭 타입 키
};
```

- ArcWork factory에서:

```tsx
if (component === 'arcai-session') {
  const documentId = node.getId();
  return <ArcAI documentId={documentId} />;
}
```

### 5.2 “새 채팅” 생성 UX (ArcWork 기본 탭)

사용자 플로우(의도된 동작)는 다음과 같습니다.

1. **새 채팅 버튼 없이, ArcWork 기본 탭에서 ArcAI 열기 버튼만 제공**
   - 예: “AI 세션 열기” 버튼
2. 버튼 클릭 시:
   - `const documentId = crypto.randomUUID();`
   - `ensureOpen({ id: documentId, name: '새 채팅', type: 'arcai-session' })`
   - ArcAI 탭이 열리고, 내부에서 `useAIConversation(documentId)` 가 호출됩니다.
3. **초기 GET /api/document/ai**
   - 아직 DB에 문서/대화가 없으므로, 서버는 `NOT_FOUND` 또는 빈 대화를 반환
   - 클라이언트는 이를 오류로 보지 않고 **히스토리 없는 새 세션**으로 취급
4. 사용자가 첫 질문을 입력하고 전송:
   - `useAIChat` 이 `POST /api/document/ai` 로 `{ documentId, messages: [lastUserMessage] }` 전송
   - 서버는 (설계상) 문서가 없으면 `documentId` 를 PK로 갖는 AI 문서를 생성한 뒤, 대화 저장
5. 첫 요청 시:
   - **응답 모델(streaming)**: 사용자가 바로 볼 수 있는 챗 응답
   - **제목 생성 모델(non-streaming, 배후 실행)**: 대화 내용을 바탕으로 문서/탭 이름을 생성하여 나중에 `document.name` + ArcWork 탭 이름을 갱신

### 5.3 ArcManager “채팅 탭”과의 연동(계획)

`docs/arcmanager/arcmanager-api.md` 에서 언급된 **ArcManager의 채팅 탭**에는,  
기존 ArcYou 채팅 대신 이번에 정의한 **document 기반 AI 세션(ArcAI)** 이 들어갈 예정입니다.

- 파일 트리/리스트에서:
  - AI 문서(`mimeType = 'application/vnd.arc.ai-chat+json'`)를 별도 섹션 또는 필터로 노출
  - `id = document.documentId`, `name = document.name`, `type = 'arcai-session'` 메타로 ArcWork 탭 오픈
- 채팅 탭에서:
  - “새 AI 세션” 버튼 동작은 ArcWork 기본 탭의 ArcAI 생성 로직과 동일하게 재사용
  - 이미 존재하는 AI 문서를 더블클릭/드래그하면 해당 세션이 ArcAI 탭으로 열림

---

## 6. 요약

- ArcAI는 ArcData와 동일한 철학을 가진 **문서 기반 AI 세션 탭 타입**입니다.
  - ArcData: `documentId` → 파일/노트 뷰어
  - ArcAI: `documentId` → AI 대화 세션
- 백엔드는 `document` + `document_ai_message` + `document_ai_part` 스키마와 `DocumentAiRepository` 를 통해  
  **타입 안전한 대화 저장/조회와 Redis 캐싱**을 제공합니다.
- API는 `GET /api/document/ai` / `POST /api/document/ai` 두 개만으로:
  - 이전 대화 로드
  - 새 요청 + 스트리밍 응답 + 히스토리 저장/캐시
  를 모두 처리합니다.
- 클라이언트는 `useAIConversation` + `useAIChat` + `ArcAI` 조합으로:
  - 문서 ID만 주입받으면
  - 기존 히스토리 + 스트리밍 응답까지 포함한 **완전한 AI 채팅 UI**를 ArcWork 탭 안에서 구현할 수 있습니다.
- 클라이언트 UI는 `ArcAIMessageList` + `ArcAIInput` 조합으로,
  **사용자 메시지를 섹션 헤더로 올리고 마지막 섹션에만 min-height를 주는 sticky 레이아웃**을 사용해
  입력 직후에도 헤더가 항상 상단에서 시작되도록 보장합니다.



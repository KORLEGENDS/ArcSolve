## 1. ArcAI 개요

ArcAI는 ArcSolve 내에서 **문서(document) 기반 AI 채팅 세션을 제공하는 ArcWork 탭 타입**입니다.  
ArcData가 `documentId`를 기반으로 파일/노트를 렌더링하는 것처럼, ArcAI는 **`documentId`를 기반으로 AI 대화 상태를 로드·저장·스트리밍**합니다.

- **핵심 포인트**
  - ArcAI는 ArcWork의 하나의 탭 타입으로 동작합니다. (예: `type = 'arcai-session'`)
  - 각 ArcAI 탭은 **하나의 `document` 행(= AI 세션 문서)**와 1:1로 매핑됩니다.
  - 대화 히스토리는 `document_ai_message` / `document_ai_part` 테이블에 정규화된 형태로 저장됩니다.
  - API는 세 개의 라우트를 사용합니다:
    - `POST /api/document/ai` – 새로운 ArcAI 세션 문서 생성
    - `GET /api/document/ai/[documentId]` – 해당 세션의 이전 대화(UIMessage[]) 로드
    - `POST /api/document/ai/[documentId]/stream` – 일반적인 AI 요청 + 스트리밍 응답
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

- 파일:
  - `apps/main/src/app/(backend)/api/document/ai/route.ts` – ArcAI 세션 문서 생성
  - `apps/main/src/app/(backend)/api/document/ai/[documentId]/route.ts` – 대화 히스토리 조회
  - `apps/main/src/app/(backend)/api/document/ai/[documentId]/stream/route.ts` – 채팅 스트리밍
- 인증: `auth()` 세션 기반 – 로그인 사용자만 접근 가능
- 엔드포인트:
  - **POST** `/api/document/ai` – 새로운 ArcAI 세션 문서 생성
  - **GET** `/api/document/ai/[documentId]` – 해당 세션의 전체 대화(UIMessage[]) 조회
  - **POST** `/api/document/ai/[documentId]/stream` – 새 메시지를 받아 스트리밍 응답 생성
- 내부에서:
  - 세션 생성: `DocumentRepository.createAiSessionForOwner` + `mapDocumentToDTO`
  - 히스토리 조회: `DocumentAiRepository` + `loadConversationWithCache` 로 **Redis → Postgres** 순으로 대화 로드
  - 스트리밍:
    - `document-ai-service.ts` 의 `createDocumentChatStream` 이 AI SDK `streamText` 를 호출
    - RAG 도구: `embedSearch` / `textSearch` / `treeList` (`sidecar-tools.ts`)
    - `toUIMessageStreamResponse` 로 UIMessage 스트림 응답 생성

### 3.2 POST /api/document/ai – ArcAI 세션 문서 생성

**요청 Body**

```ts
{
  name: string;       // 세션 이름 (예: '새 채팅')
  parentPath: string; // '' = 루트, 그 외 ltree 경로 (예: 'ai', 'ai.project1')
}
```

**동작**

1. `auth()` 로 사용자 인증 → `userId`
2. `documentAiSessionCreateRequestSchema` 로 `name` / `parentPath` 검증
3. `DocumentRepository.createAiSessionForOwner({ userId, parentPath, name })` 호출
   - `documents.kind = 'document'`
   - `mimeType = 'application/vnd.arc.ai-chat+json'`
   - `uploadStatus = 'uploaded'`, `processingStatus = 'processed'`
4. 생성된 `document` 를 `mapDocumentToDTO` 로 변환해 응답

**응답**

```ts
type DocumentDTO = {
  documentId: string;
  name: string;
  path: string;
  mimeType: string | null;
  // ...
};

type DocumentDetailResponse = {
  document: DocumentDTO;
};
```

### 3.3 GET /api/document/ai/[documentId] – 대화 히스토리 조회

**요청**

- 경로 파라미터:
  - `documentId: string (uuid)` – ArcAI 세션 문서 ID

**동작**

1. `auth()`로 사용자 인증 → `userId`
2. `uuidSchema` 로 `documentId` 형식 검증
3. `DocumentAiRepository` 인스턴스를 생성하고 `loadConversationWithCache({ documentId, userId, repository })` 호출
   - Redis `ai:conversation:<userId>:<documentId>` 에 스냅샷이 있으면 그대로 사용
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

### 3.4 POST /api/document/ai/[documentId]/stream – 요청 처리 + 스트리밍 응답

**요청 Body**

```ts
{
  /**
   * 클라이언트(useChat)가 현재 보유하고 있는 UIMessage[] 전체 대화
   * - 편집/재생성을 위해 항상 최신 스냅샷 전체를 전송합니다.
   */
  messages: UIMessage[];
}
```

> **중요**  
> 2024-11 이후 버전에서는 “마지막 user 메시지 1개만 전송” 로직이 제거되었습니다.  
> 클라이언트가 `messages` 전체를 책임지고 보내며, 서버는 추가 히스토리 조회 없이 이 배열만을 기준으로 스트리밍을 수행합니다. 편집/재시도/취소 후 재실행과 같은 기능을 위해 반드시 최신 상태 전체를 전송해야 합니다.

**서버 동작(요약)**

1. `auth()` → `userId`
2. 경로 파라미터의 `documentId` 를 `uuidSchema` 로 검증
3. `requestBodySchema` 로 `messages` 검증
4. `DocumentAiRepository` 인스턴스를 생성하고 `assertAiDocumentOwner` 로 소유/타입 확인
5. 전달받은 `messages` 그대로를 대상으로 `validateUIMessages` → `streamText` 실행
   - `createDocumentAiTools(userId)` 로 정의된 embed/text search 등을 그대로 사용
   - `stopWhen: stepCountIs(8)` 로 도구 호출 횟수 제한
6. `toUIMessageStreamResponse` 로 스트림을 감싸고, `messageMetadata` 에 모델/토큰 정보를 남김
7. `onFinish` 훅에서:
   - `DocumentAiRepository.replaceConversationForOwner` 로 Postgres에 전체 대화 저장
   - `saveConversationSnapshot` 으로 Redis `ai:conversation:*` 스냅샷 갱신

---

## 4. 클라이언트 레이어 (훅 + 컴포넌트)

### 4.1 React Query 훅: `useAIConversation`

파일: `apps/main/src/client/states/queries/ai/useAI.ts`

- **역할**
  - `GET /api/document/ai/[documentId]` 를 호출하여 **이전 대화 전체(UIMessage[])** 를 가져옵니다.
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

### 4.2 React Query 훅: `useAISessionCreate`

파일: `apps/main/src/share/libs/react-query/query-options/ai.ts`

- **역할**
  - `POST /api/document/ai` 를 호출하여 새로운 ArcAI 세션 문서를 생성합니다.
  - 생성된 `DocumentDTO` 에서 `documentId`를 추출하여 탭/세션 ID로 사용합니다.

```ts
export const aiQueryOptions = {
  createSession: createApiMutation<DocumentDTO, DocumentDetailResponse, DocumentAiSessionCreateRequest>(
    () => '/api/document/ai',
    (data) => data.document,
    {
      method: 'POST',
      bodyExtractor: (variables) => documentAiSessionCreateRequestSchema.parse(variables),
    }
  ),
  // ... conversation, stream 등 기존 옵션들
};
```
```

- **404 처리**
  - 서버가 `NOT_FOUND` 를 반환해도, 훅은 단순히 `messages = []` 로 동작할 수 있도록 설계되어 있습니다.
  - ArcAI UI에서는 이를 “새 세션”으로 간주하고 빈 화면에서 입력만 받습니다.

### 4.3 AI SDK 훅: `useAIChat` (`useChat` 래핑)

파일: `apps/main/src/client/states/queries/ai/useAI.ts`

- **역할**
  - AI SDK `useChat` + `DefaultChatTransport` 를 프로젝트에 맞게 포장
  - `POST /api/document/ai/[documentId]/stream` 으로 **현재 보유 중인 전체 `UIMessage[]`**를 전송
  - `initialMessages`가 준비되면 `useEffect`로 `chat.setMessages`에 반영하여 히스토리 동기화
  - `stop`, `regenerate`, `setMessages` 를 그대로 노출하여 중단/재시도/메시지 편집 시나리오에 활용

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
      api: `/api/document/ai/${encodeURIComponent(documentId)}/stream`,
      // 별도 prepareSendMessagesRequest 없이 기본 동작(전체 messages 전송)을 사용
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

> **편집/재시도 흐름**  
> ArcAI는 `chat.setMessages` + `regenerate({ messageId })` 조합을 사용합니다.  
> 1) 편집 버튼 클릭 → 해당 user 메시지를 수정하고 이후 assistant 메시지를 잘라내며 `setMessages` 호출  
> 2) 즉시 `regenerate({ messageId })` 로 같은 지점부터 재생성  
> 3) 중단 버튼은 `stop()`을 호출하며 전송 버튼 UI에 통합되어 있습니다.

### 4.3 ArcAI 컴포넌트

파일: `apps/main/src/client/components/arc/ArcAI/ArcAI.tsx`

- `useAIConversation(documentId)` 로 Redis → Postgres 순서로 이전 대화를 불러오고,  
  `useAIChat` 의 `messages`, `status`, `stop`, `regenerate`, `setMessages` 를 사용합니다.
- **입력 상태**
  - `draft`: 현재 작성 중인 텍스트.
  - `editingMessageId`, `editingText`: user 메시지 인라인 편집 모드.
  - `isStoppable = status === 'submitted' || status === 'streaming'` 으로 응답 진행 여부 판별.
- **핸들러 주요 흐름**
  - `handleSubmit`: `draft`가 비었거나 `isStoppable`이면 전송하지 않고, 그렇지 않으면 `sendMessage({ text })`.
  - `handleStart/Change/ConfirmEdit`: `setMessages` 로 대상 user 메시지를 수정하고 이후 assistant 메시지를 잘라낸 뒤 `regenerate({ messageId })`.
  - `handleRetryAssistant`: 특정 assistant `messageId` 기준으로 `regenerate` 실행.
  - `handleCancelEdit`: 편집 상태 초기화.
  - `handleStop`: `stop()` 호출. ArcAIInput 전송 버튼과 통합되어 있다.
- **스크롤 제어**
  - `scrollTrigger`는 히스토리 로딩 완료 직후 한 번만 증가시켜 StickToBottom 컨텍스트를 트리거합니다.
- **렌더 구성**
  - `<ArcAIMessageList>`에 `editingMessageId`, `editingText`, `onStartEdit`, `onChangeEditText`, `onConfirmEdit`, `onCancelEdit`, `onRetryAssistant`, `aiStatus` 등을 전달해 툴 호출, 추론 보기, 메시지 액션(복사/수정/재시도)을 렌더링.
  - `<ArcAIInput>`에는 `submitMode={isStoppable ? 'stop' : 'send'}`, `submitIcon`(StopCircle/ArrowUp), `onClickSubmitButton={handleStop}` 를 전달해 전송/중단 버튼을 하나로 통합합니다.

### 4.4 ArcAI UI 레이아웃 (ArcAIMessageList / ArcAIInput)

#### ArcAIMessageList

파일: `apps/main/src/client/components/arc/ArcAI/components/ArcAIMessageList/ArcAIMessageList.tsx`

- **역할**
  - `UIMessage[]`를 **섹션(`user` + 여러 `assistant`) 단위**로 묶어 렌더링.
  - 각 섹션의 `user` 메시지는 sticky 헤더(`.sectionHeader`)로 올라가고, 아래에 `assistant` 메시지들이 쌓임.
  - AI SDK `UIMessage.parts` 를 그대로 파싱하여 **툴 호출(`tool-call`, `tool-result`)을 ArcAIElements/tool** 컴포넌트로 인라인 렌더링.
  - `messageMetadata.reasoningText` 가 있으면 `ArcAIReasoning`(Reasoning/ReasoningTrigger/ReasoningContent 조합)으로 표시하고, 스트리밍 중에도 애니메이션되는 Markdown(`useArcAIMarkdown`)을 공유.
  - `ResponsePreparing` 컴포넌트로 “토큰이 아직 도착하지 않은 상태”를 표시 (`status === 'submitted'` & 마지막 메시지가 user).
  - 각 메시지 하단에는 lucide 아이콘 기반 **복사/수정/재시도 액션 바**가 있으며, user 메시지는 복사+수정, assistant 메시지는 복사+재시도를 제공. 호버 시에만 노출되고 투명 배경을 사용.

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
  - `submitMode`: `'send' | 'stop'` 를 받아 한 버튼으로 전송/중단 UI를 공유. 스트리밍 중에는 `StopCircle`, 그 외에는 `ArrowUp` 아이콘(lucide-react)을 사용.
  - `Enter` → 전송 (`Shift+Enter`는 줄바꿈), 한글 조합(`isComposing`) 중에는 전송 안 함. `submitMode === 'stop'` 인 동안에는 Enter 전송 자체를 막는다.
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

### 5.2 "새 채팅" 생성 UX (ArcWork 기본 탭)

사용자 플로우(의도된 동작)는 다음과 같습니다.

1. **새 채팅 버튼 없이, ArcWork 기본 탭에서 ArcAI 열기 버튼만 제공**
   - 예: "AI 채팅 시작하기" 버튼
2. 버튼 클릭 시:
   - `createAiSessionMutation.mutateAsync({ name: '새 채팅', parentPath: '' })` 로 세션 생성
   - 생성된 `document.documentId`를 탭 ID로 사용
   - `ensureOpen({ id: documentId, name: '새 채팅', type: 'arcai-session' })`으로 탭 열기
3. **초기 GET /api/document/ai/[documentId]**
   - 세션은 이미 생성되었으므로, 서버는 빈 메시지 배열을 반환 (대화 없음)
   - 클라이언트는 이를 **히스토리 없는 새 세션**으로 취급
4. 사용자가 첫 질문을 입력하고 전송:
   - `useAIChat` 이 `POST /api/document/ai/[documentId]/stream` 로 현재까지의 전체 `messages: UIMessage[]` 를 전송
   - 서버는 이미 존재하는 문서를 사용해 전체 대화를 기준으로 저장/스트리밍 수행
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
- API는 세 개의 라우트로 역할을 분리:
  - `POST /api/document/ai` – 세션 문서 생성
  - `GET /api/document/ai/[documentId]` – 이전 대화 로드
  - `POST /api/document/ai/[documentId]/stream` – 새 요청 + 스트리밍 응답 + 히스토리 저장/캐시
- 클라이언트는 `useAISessionCreate` + `useAIConversation` + `useAIChat` + `ArcAI` 조합으로:
  - 세션 생성 후 문서 ID를 주입받으면
  - 기존 히스토리 + 스트리밍 응답까지 포함한 **완전한 AI 채팅 UI**를 ArcWork 탭 안에서 구현할 수 있습니다.
- `useAIChat` 은 이제 `UIMessage[]` 전체를 서버에 전송하며, `setMessages` + `regenerate` + `stop` 을 그대로 노출해 **인라인 편집/재시도/중단 UX**를 제공합니다.
- `ArcAIMessageList` 는 tool-call/결과/Reasoning 파츠를 인라인 렌더링하고, `ResponsePreparing`·복사/수정/재시도 액션 등을 제공하여 최신 AI SDK UI 가이드와 동일한 경험을 구현합니다.
- `ArcAIInput` 은 전송 버튼 하나로 전송/중단을 통합하고, 스트리밍 중에는 `StopCircle`, 대기 중에는 `ArrowUp` lucide 아이콘을 사용합니다. Sticky 레이아웃/자동 확장/placeholder 동작은 기존과 동일합니다.



## ArcWork 통합 API 문서

이 문서는 ArcWork의 **전체 API와 내부 구조**를 한 번에 이해할 수 있도록 정리한 최종 문서입니다.  
기존 `arcwork-document-schema.md`, `arcwork-tab-naming.md`, `arcwork-tap-api.md`의 내용을 모두 통합·확장한 버전으로,  
이 문서만으로 ArcWork 연동과 확장을 진행할 수 있도록 작성되었습니다.

---

## 1. ArcWork 개요

ArcWork는 ArcSolve의 **작업 공간(Workspace) 레이아웃 시스템**입니다.

- 기반 라이브러리: `flexlayout-react`
- 주요 역할:
  - 여러 도메인 뷰(ArcYou 채팅, ArcData 문서 뷰어 등)를 **탭 형태로 배치/이동/저장**
  - 레이아웃을 LocalStorage에 저장하고 복원
  - Drag & Drop을 통해 탭을 열거나 재배치
- 핵심 구성 요소:
  - **문서 스키마**: `document`/`document_content`/`document_relation`/`document_chunk`
  - **레이아웃 스토어**: `arcwork-layout-store.ts` (zustand 기반)
  - **React 컴포넌트**: `ArcWork`, `ArcWorkContent`, 도메인 컴포넌트(factory로 매핑)

이하에서는 **문서 시스템 → 탭 메타데이터 → 레이아웃 스토어 API → React 통합 → 도메인 연동 레시피** 순서로 설명합니다.

---

## 2. ArcWork 문서 스키마 (DB 레벨)

ArcWork 문서 시스템은 다음 네 가지 테이블을 중심으로 동작합니다.

- **document**: 루트 엔티티 (정체성 + 계층 path + owner + 최신 버전 포인터)
- **document_content**: 버전 단위 실제 내용 및 메타데이터
- **document_relation**: 문서 간 그래프 관계(edge)
- **document_chunk**: 버전별 RAG 검색용 chunk + embedding

### 2.1. `document` (루트 + path + 최신 버전)

- **역할**
  - 문서/폴더의 정체성과 위치(path) + owner 관리
  - 최신 버전 콘텐츠를 가리키는 포인터(`latest_content_id`) 포함
- **핵심 컬럼**
  - `document_id (uuid, PK)`
  - `user_id (uuid)`: 문서 owner (tenant 기준)
  - `path (ltree)`: 유저 네임스페이스 내 계층 경로
  - `kind (document_kind)`: `note | file | folder`
  - `file_meta (jsonb | null)`: 파일 문서(`kind = 'file'`)에 대한 메타데이터
    - 예: `{ mimeType: 'application/pdf', fileSize: 12345, storageKey: 'users/{userId}/documents/{documentId}' }`
  - `upload_status (document_upload_status)`: 업로드 상태
    - `pending | uploading | uploaded | upload_failed`
    - `note/folder` 등 비파일 문서는 기본적으로 `uploaded`로 간주
  - `latest_content_id (uuid | null)`: FK → `document_content.document_content_id`
  - `created_at / updated_at / deleted_at`
- **제약/인덱스**
  - `UNIQUE (user_id, path) WHERE deleted_at IS NULL`
  - `GIST (path)` 인덱스로 subtree 쿼리 최적화

`path`는 `ltree` 타입으로, 예를 들어 `root.project.arcyou` 같은 형식으로 계층을 표현합니다.

### 2.2. `document_content` (버전 단위 내용)

- **역할**
  - 실제 본문/메타를 버전 단위로 저장
  - 버전별 author 정보 포함
- **핵심 컬럼**
  - `document_content_id (uuid, PK)`
  - `document_id (uuid)`: FK → `document.document_id`
  - `user_id (uuid)`: 해당 버전을 생성한 작성자
  - `contents (jsonb | null)`: 텍스트, PDF 파싱 결과, 음성 전사 등
  - `version (int)`: 동일 문서 내 1,2,3… 단조 증가
  - `created_at / updated_at / deleted_at`
- **제약**
  - `UNIQUE (document_id, version) WHERE deleted_at IS NULL`

애플리케이션에서 `document.latest_content_id`를 최신 `document_content`의 id로 유지/갱신합니다.

### 2.3. `document_relation` (문서 그래프)

- **역할**
  - 문서 간 관계(edge)를 명시적으로 표현
  - relation type으로 그래프 쿼리를 필터링
- **핵심 컬럼**
  - `document_relation_id (uuid, PK)`
  - `base_document_id (uuid)`: from/source, FK → `document.document_id`
  - `related_document_id (uuid)`: to/target, FK → `document.document_id`
  - `relation_type (document_relation_type)`:
    - `reference | summary | translation | derived | duplicate`
  - `created_at / updated_at / deleted_at`
- **제약**
  - `UNIQUE (base_document_id, related_document_id, relation_type) WHERE deleted_at IS NULL`

예시 쿼리:

- “이 PDF의 summary 노트들”
  - `WHERE base_document_id = ? AND relation_type = 'summary'`
- “이 문서를 참조하는 모든 문서”
  - `WHERE related_document_id = ? AND relation_type = 'reference'`

### 2.4. `document_chunk` (RAG 인덱스)

- **역할**
  - 특정 `document_content` 버전의 chunk + embedding 저장
  - 벡터 유사도 검색의 실제 타겟 테이블
- **핵심 컬럼**
  - `document_chunk_id (uuid, PK)`
  - `document_content_id (uuid)`: FK → `document_content.document_content_id`
  - `position (int | null)`: 원문 내 순서 (옵션)
  - `chunk_content (text)`: chunk 텍스트
  - `chunk_embedding (vector(1536))`: pgvector embedding
  - `created_at / updated_at / deleted_at`
- **인덱스**
  - `USING ivfflat (chunk_embedding vector_cosine_ops) WITH (lists = 100)`
    - Drizzle 스키마에서 index 메타를 정의하고, DB에는 pgvector 확장 설치 필요

`document_chunk`에는 `user_id`를 넣지 않고, `document_content → document` 경로를 타고 tenant 정보를 얻습니다.

### 2.5. 한 사이클 예시 (생성 → 버전 → RAG → 그래프)

1. **새 노트 생성**
   - `document` insert: `user_id`, `path (ltree)`, `kind = 'note'`
   - `latest_content_id`는 아직 `null`
2. **내용 작성/수정**
   - `document_content` insert: `document_id`, `user_id`, `contents`, `version = n`
   - 해당 id를 `document.latest_content_id`로 업데이트
3. **임베딩 생성**
   - 최신 `document_content.contents`를 chunk로 쪼개어 `document_chunk`에 insert
   - 검색 시 `document_chunk`를 pgvector 인덱스로 질의
4. **폴더/프로젝트 뷰**
   - `WHERE user_id = ? AND path <@ 'root.project.arcyou'::ltree` 로 subtree 조회
5. **문서 간 관계 연결**
   - PDF ↔ 요약 노트 생성 시 `document_relation`에 edge 추가

이 네 테이블을 통해 ArcWork 문서 시스템에서 **계층(path) / 버전 / RAG / 그래프**를 한 번에 커버할 수 있습니다.

---

## 3. 탭 메타데이터 모델 (`id / name / type`)

ArcWork에서 **하나의 탭**은 항상 다음 세 필드를 기준으로 정의됩니다.

- **id**
  - 탭의 **고유 식별자**이자 도메인 리소스 식별자
  - 예: 채팅방 ID, 문서 ID, 노트 ID 등
  - flexlayout 탭 노드의 `id`로 사용
  - 동일 `id`인 탭은 **하나의 탭**으로 간주 (이미 열려 있으면 이동/활성화)
  - 도메인 컴포넌트에서 API 호출 시 그대로 사용 (예: `GET /api/arcyou/chat-room/{id}`)

- **name**
  - 탭에 표시되는 **사람이 읽는 제목**(타이틀)
  - flexlayout 탭 노드의 `name`으로 사용
  - 탭 헤더에 그대로 표시
  - 이름 변경(예: 채팅방 이름 변경, 문서 제목 변경) 시 UI 탭 제목과 동기화
  - **반드시 값이 있어야 하는 필수 필드**이며, `id`로의 fallback을 허용하지 않습니다.

- **type**
  - ArcWork factory에서 렌더링할 **컴포넌트 타입 키**
  - flexlayout 탭 노드의 `component` 값으로 사용
  - `node.getComponent()`를 통해 어떤 React 컴포넌트를 렌더링할지 결정
    - 예: `type === 'arcyou-chat-room'` → `ArcYouChatRoom` 렌더링
  - 문자열 키로, 도메인/기능/뷰를 구분할 수 있도록 일관된 패턴 사용

요약하면:

- **id**: “어떤 리소스인가?” (resource identity)
- **name**: “탭에 뭐라고 보일 것인가?” (display title)
- **type**: “어떤 컴포넌트로 그릴 것인가?” (component key)

### 3.1. flexlayout JSON 매핑

ArcWork 레이아웃 스토어는 `{ id, name, type }`을 flexlayout JSON에 다음과 같이 매핑합니다.

- 입력: `{ id, name, type }`
- flexlayout 탭 노드 JSON:
  - `type: 'tab'`
  - `id: id`
  - `name: name`
  - `component: type`

이 규칙은 다음 API 전반에 공통으로 사용됩니다.

- **탭 열기/활성화**
  - `open({ id, name, type })`
  - `ensureOpen({ id, name, type })`
- **드래그 앤 드롭**
  - `startAddTabDrag(event, { id, name, type })`
  - `makeExternalDragHandler()`가 `dataTransfer`에서 `{ id, name, type }` JSON을 읽어 탭 생성

### 3.2. 중복 검사와 DnD에서의 의미

- **중복/존재 여부 판단은 오직 `id`로만 수행**됩니다.
  - 동일 `id`를 다시 드래그하거나 `ensureOpen({ id, ... })`를 호출하면:
    - “새 탭 생성”이 아니라 “기존 탭 활성화/이동”으로 처리합니다.
- `name`과 `type`의 역할:
  - `name`: 탭 타이틀 표시, 도메인 이름 변경 시 UI 동기화
  - `type`: 어떤 React 컴포넌트를 렌더링할지 결정

### 3.3. 도메인별 예시

- **ArcYou (채팅방 탭)**
  - `id`: `room.id` (채팅방 UUID)
  - `name`: `room.name` (채팅방 이름)
  - `type`: `'arcyou-chat-room'`

- **ArcData (문서 탭) - 예시**
  - `id`: `document.document_id`
  - `name`: 문서 제목 또는 파일명
  - `type`: 예: `'arcdata-document'` (실제 구현 시 factory에 매핑 필요)

---

## 4. ArcWork 레이아웃 스토어 API (`arcwork-layout-store.ts`)

파일 경로:  
`apps/main/src/client/states/stores/arcwork-layout-store.ts`

이 스토어는 ArcWork 레이아웃과 탭 상태를 전역에서 관리합니다.

### 4.1. 상태 타입

```ts
export interface ArcWorkLayoutState {
  model: Model | null;
  lastSavedLayout: IJsonModel | null;
  storageKey: string;
  layoutRef: FlexLayoutView | null;
}
```

### 4.2. 탭 입력 타입

```ts
export interface ArcWorkTabInput {
  id: string;
  type: string;  // flexlayout component key
  name: string;  // 탭 제목 (필수)
  tabsetId?: string;
}
```

### 4.3. 액션 인터페이스 (요약)

```ts
export interface ArcWorkLayoutActions {
  setModel(model: Model | null): void;
  setStorageKey(key: string): void;
  setLayoutRef(layout: FlexLayoutView | null): void;

  saveLayout(options?: { key?: string }): void;
  restoreLayout(options?: {
    key?: string;
    fallback?: IJsonModel;
    replace?: boolean;
  }): Model | null;
  clearSavedLayout(options?: { key?: string }): void;

  // Tabs API
  open(input: ArcWorkTabInput): boolean;
  activate(id: string): boolean;
  close(id: string): boolean;
  ensureOpen(input: ArcWorkTabInput): boolean;

  // DnD helpers
  makeExternalDragHandler(): (event: React.DragEvent<HTMLElement>) =>
    | undefined
    | { json: any; onDrop?: (node?: unknown, event?: React.DragEvent<HTMLElement>) => void };
  startAddTabDrag(
    event: React.DragEvent<HTMLElement>,
    input: ArcWorkTabInput,
    options?: { dragImage?: React.ReactNode; imageOffset?: { x: number; y: number } }
  ): boolean;
}
```

내부적으로는 `useArcWorkLayoutStore`로 생성된 zustand 스토어입니다.

### 4.4. 레이아웃 저장/복원 API

- **`saveLayout(options?)`**
  - 현재 `model`을 JSON으로 직렬화하여 LocalStorage에 저장
  - 키: `options.key ?? storageKey ?? 'arcwork:layout'`

- **`restoreLayout(options?)`**
  - LocalStorage에서 JSON을 읽어 `Model.fromJson`으로 복원
  - `fallback`이 있으면 저장된 값이 없을 때 사용
  - `replace === false`이면 `lastSavedLayout`만 갱신하고 `model`은 교체하지 않음

- **`clearSavedLayout(options?)`**
  - 해당 키의 LocalStorage 레이아웃을 삭제

### 4.5. Tabs API 동작

- **`open(input: ArcWorkTabInput)`**
  - `id`로 이미 탭이 열려 있는지 확인
    - 있으면 `selectTab(id)`로 활성화
    - 없으면 `addNode`로 새 탭 생성
  - `tabsetId`가 없으면:
    - `model.getActiveTabset()` → 없으면 `getFirstTabSet()`로 fallback

- **`ensureOpen(input: ArcWorkTabInput)`**
  - 동일 `id` 탭이 있으면 **활성화만** 수행
  - 없으면 `open(input)` 호출

- **`activate(id: string)`**
  - 탭이 존재하면 `selectTab(id)` 수행

- **`close(id: string)`**
  - 탭이 존재하면 `deleteTab(id)` 수행

### 4.6. DnD 헬퍼와 MIME 타입

#### 4.6.1. `startAddTabDrag(event, input, options?)`

- ArcWork 내부/외부에서 동일한 로직으로 사용 가능한 **통합 드래그 시작 함수**
- 동작:
  1. `layoutRef`가 없으면:
     - `dataTransfer`에 `{ id, type, name }` JSON을 저장
     - MIME 타입:  
       - `application/x-arcwork-tab`  
       - `text/plain` (fallback)
     - ArcWork의 `onExternalDrag`가 이 데이터를 읽어 탭 생성
  2. `layoutRef`가 있으면:
     - `options.dragImage`가 있으면 `layout.setDragComponent`로 커스텀 드래그 이미지를 설정
     - `model.getNodeById(input.id)`로 기존 탭 존재 여부 확인
       - 있으면: `moveTabWithDragAndDrop` (기존 탭 이동)
       - 없으면: `addTabWithDragAndDrop` (새 탭 생성)

#### 4.6.2. `makeExternalDragHandler()`

- ArcWork `Layout`의 `onExternalDrag`에 연결되는 핸들러 팩토리
- 동작:
  - `dataTransfer`에서 `application/x-arcwork-tab` 또는 `text/plain`을 읽음
  - `{ id, name, type }`를 파싱하고 유효성 검사
  - flexlayout 탭 JSON `{ type: 'tab', id, name, component: type }`를 반환
  - ArcWork는 이 JSON을 사용해 드롭 위치에 탭을 생성

#### 4.6.3. `setArcWorkTabDragData(event, data)`

```ts
export function setArcWorkTabDragData(
  event: DragEvent | React.DragEvent<HTMLElement>,
  data: ArcWorkTabInput
) {
  const dt = (event as DragEvent).dataTransfer || (event as React.DragEvent<HTMLElement>).dataTransfer;
  if (!dt) return;
  const json = JSON.stringify({ id: data.id, type: data.type, name: data.name });
  dt.setData('application/x-arcwork-tab', json);
  dt.setData('text/plain', json);
}
```

- 레이아웃이 아직 준비되지 않은 환경이나 외부 드래그에서 사용
- 반드시 `{ id, type, name }` 전체를 포함해야 합니다 (`name` 필수).

### 4.7. 셀렉터 훅 요약

```ts
export const useArcWorkModel = (): Model | null =>
  useArcWorkLayoutStore((s) => s.model);

export const useArcWorkStorageKey = (): string =>
  useArcWorkLayoutStore((s) => s.storageKey);

export const useArcWorkLastSavedLayout = (): IJsonModel | null =>
  useArcWorkLayoutStore((s) => s.lastSavedLayout);

export const useArcWorkSetModel = (): ArcWorkLayoutActions['setModel'] =>
  useArcWorkLayoutStore((s) => s.setModel);

// ... 이하 save/restore/clear/setLayoutRef 등도 동일 패턴

export const useArcWorkOpenTab =
  (): ArcWorkLayoutActions['open'] => useArcWorkLayoutStore((s) => s.open);

export const useArcWorkEnsureOpenTab =
  (): ArcWorkLayoutActions['ensureOpen'] => useArcWorkLayoutStore((s) => s.ensureOpen);

export const useArcWorkStartAddTabDrag =
  (): ArcWorkLayoutActions['startAddTabDrag'] =>
    useArcWorkLayoutStore((s) => s.startAddTabDrag);
```

---

## 5. ArcWork React 컴포넌트 통합

### 5.1. `ArcWork` 컴포넌트 (순수 레이아웃)

파일: `apps/main/src/client/components/arc/ArcWork/ArcWork.tsx`

핵심 props:

- **`defaultLayout: Model | IJsonModel`** (필수)
  - 초기 flexlayout 모델 또는 JSON
  - `globalOptions`가 있으면 JSON의 `global`에 병합
- **`onModelChange(model, action)`**
  - 모델 변경 시 호출
  - ArcWork 내부에서는 여기서 자동 저장 스케줄링을 수행
- **`factory(node: TabNode)`**
  - `node.getComponent()` 값(`type`)에 따라 실제 React 컴포넌트를 생성
  - 지정하지 않으면 `defaultArcWorkFactory` 사용
- **`onExternalDrag`**
  - 지정하지 않으면 `useArcWorkMakeExternalDragHandler()`에서 생성한 기본 핸들러 사용
- 그 외:
  - `onAction`, `onRenderTab`, `onRenderTabSet`, `onTabSetPlaceHolder`, `icons`, `responsive`, `autoSave`, `autoSaveDelayMs` 등 flexlayout 관련 옵션을 래핑

ArcWork는 내부에서:

- `useArcWorkSetModel()`로 `model`을 전역 스토어에 등록
- `useArcWorkSetLayoutRef()`로 `Layout` ref를 전역 스토어에 등록
- `useArcWorkSaveLayout()`을 이용해 디바운스된 자동 저장을 수행

### 5.2. `ArcWorkContent` (앱 통합용 래퍼)

파일:  
`apps/main/src/app/(frontend)/[locale]/(user)/(core)/components/ArcWorkContent.tsx`

역할:

- `useArcWorkRestoreLayout()`을 사용해 **저장된 레이아웃 우선 복원**
- 없으면 빈 레이아웃(JSON)으로 시작
- `useArcWorkTab()` 어댑터를 이용해 탭 이름 변경 등을 도메인 로직과 연결
- ArcYou 등 도메인 탭 타입을 factory에 매핑

핵심 부분 (요약):

```tsx
const { onAction: arcWorkOnAction } = useArcWorkTab();

const factory = useCallback(
  createFactory((node: TabNode) => {
    const component = node.getComponent();

    if (component === 'arcyou-chat-room') {
      const roomId = node.getId();
      const isActive = node.isSelected();
      return <ArcYouChatRoom id={roomId} isActive={isActive} />;
    }

    return null; // 나머지는 defaultArcWorkFactory로 위임
  }),
  []
);

const restoreLayout = useArcWorkRestoreLayout();
const defaultLayout = useMemo(() => {
  const restored = restoreLayout?.({ replace: false });
  if (restored instanceof Model) return restored;
  return Model.fromJson({ global: {}, borders: [], layout: { type: 'row', weight: 100, children: [] } });
}, [restoreLayout]);
```

---

## 6. 도메인 연동 레시피

### 6.1. ArcYou 채팅방 탭 연동

파일:  
`apps/main/src/client/components/arc/ArcYou/ArcYouChat/ArcYouChatRoomList.tsx`

핵심 포인트:

- 채팅방 리스트 아이템에서:
  - 더블클릭: `ensureOpen({ id, name, type })`로 탭을 열거나 활성화
  - 드래그: `startAddTabDrag(e, { id, name, type })`로 탭 이동/생성

관련 코드 (요약):

```13:27:apps/main/src/client/components/arc/ArcYou/ArcYouChat/ArcYouChatRoomList.tsx
import { useArcyouChat } from '@/client/states/queries/arcyou/useArcyouChat';
import { useArcWorkEnsureOpenTab, useArcWorkStartAddTabDrag } from '@/client/states/stores/arcwork-layout-store';

export function ArcYouChatRoomList({ type, className }: ArcYouChatRoomListProps) {
  const ensureOpen = useArcWorkEnsureOpenTab();
  const startAddTabDrag = useArcWorkStartAddTabDrag();
  const { data, isLoading, error } = useArcyouChat(type);
  // ...
  return (
    <div className={cn('w-full flex flex-col', className)}>
      {normalizedRooms.map((room) => {
        const id = room.id;
        const targetType = 'arcyou-chat-room';
        const name = room.name;

        return (
          <div
            key={room.id}
            draggable
            onDragStart={(e) => {
              startAddTabDrag(e, { id, type: targetType, name });
            }}
            onDoubleClick={() => {
              ensureOpen({ id, type: targetType, name });
            }}
          >
            <ArcYouChatRoomListItem {...room} />
          </div>
        );
      })}
    </div>
  );
}
```

요약:

- `id` = `room.id`
- `name` = `room.name`
- `type` = `'arcyou-chat-room'`
- DnD와 클릭 모두 **동일 메타데이터**로 동작

### 6.2. ArcData 문서 탭 연동 (패턴)

ArcData 문서 탭 역시 동일 패턴을 따릅니다.

- 문서 리스트에서:
  - `id`: `document.document_id`
  - `name`: 문서 제목/파일명
  - `type`: 예: `'arcdata-document'` (실제 구현 시 ArcWork factory에 매핑 추가 필요)
- 탭 열기/드래그:
  - `ensureOpen({ id, name, type })`
  - `startAddTabDrag(e, { id, name, type })`

- 문서 목록/트리 데이터:
  - API: `GET /api/document?kind=file`
    - 응답: `{ documents: { documentId, userId, path, kind, uploadStatus, fileMeta, createdAt, updatedAt }[] }`
  - React Query 옵션: `documentQueryOptions.listFiles()`
  - 훅: `useDocumentFiles()` (`apps/main/src/client/states/queries/document/useDocument.ts`)
    - 반환: `DocumentDTO[]`와 로딩/에러 상태
  - UI 예시: `ArcManager`의 files 탭에서 `useDocumentFiles()` → `path` 기반으로 `ArcManagerTreeItem[]` 트리 변환 후 렌더링

실제 연동 시에는:

1. ArcWork factory에 `component === 'arcdata-document'` 분기 추가
2. 해당 탭에서 ArcData 문서 뷰어 컴포넌트 렌더링
3. 필요하면 탭 이름 변경 로직을 `useArcWorkTabNameUpdateAdapter`와 유사하게 도메인 rename API와 연결

### 6.3. 새 탭 타입 추가 체크리스트

새로운 탭 타입(예: PDF 뷰어, 요약 노트 뷰, 설정 패널)을 추가할 때:

1. **도메인에서 `id / name / type` 결정**
   - `id`: 도메인 리소스 ID (또는 논리적 식별자)
   - `name`: 탭에서 보여줄 제목 (필수)
   - `type`: 고유한 컴포넌트 키 문자열
2. **UI/리스트/버튼에서 공통 입력 구성**
   - `const meta = { id, name, type };`
   - 클릭 시: `ensureOpen(meta)`
   - 드래그 시: `startAddTabDrag(e, meta)`
3. **ArcWork factory에 타입 매핑 추가**
   - `node.getComponent()`가 `type`과 일치할 때 적절한 React 컴포넌트를 렌더링
   - 컴포넌트에는 `node.getId()`와 필요한 props를 전달
4. **중복/이동 동작 확인**
   - 동일 `id` 드래그 시 “이미 열린 탭이 이동/활성화되는지” 확인
5. **문서/코멘트에 `id / name / type` 의미 명시**
   - 도메인 코드에서도 동일 용어를 사용해 팀 내 혼동을 줄임

---

## 7. 요약 및 권장 사항

- ArcWork는 **flexlayout-react 기반 레이아웃 + 문서 시스템 + 탭 DnD**를 제공하는 공통 인프라입니다.
- 모든 탭은 **`id / name / type`** 세 필드를 기준으로 정의되며,  
  - `id`: 리소스 ID + 중복/존재 여부 판단 기준  
  - `name`: 탭 제목(필수, fallback 없음)  
  - `type`: factory에서 사용할 컴포넌트 키
- 전역 스토어 `arcwork-layout-store.ts`는:
  - 레이아웃 저장/복원
  - 탭 열기/활성화/닫기
  - DnD(내부/외부) 통합 처리를 담당하며  
  - MIME 타입으로 `application/x-arcwork-tab`을 사용합니다.
- ArcYou/ArcData 등 도메인에서는:
  - 리스트/버튼/메뉴에서 **항상 동일한 `{ id, name, type }` 구조**를 사용하고
  - ArcWork factory에 타입 매핑만 추가하면, 레이아웃/탭 관리 로직을 모두 재사용할 수 있습니다.

이 문서를 ArcWork 관련 작업의 **단일 기준(single source of truth)** 으로 사용하고,  
추가적인 세부 구현이 생기면 이 문서에 섹션을 확장하는 방식으로 유지 보수하는 것을 권장합니다.



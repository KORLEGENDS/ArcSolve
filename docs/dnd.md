## 1. 개요

이 문서는 ArcWork / ArcManager / ArcData 전체에서 **드래그 앤 드롭(DnD)** 을 어떻게 해석하고 처리할지에 대한 **공통 정책**을 정의합니다.

목표:

- ArcManager에서 아이템을 드래그하면, 기본적으로는 **ArcWork 탭 생성/이동**으로 동작한다.
- 그러나 특정 컴포넌트(예: 노트 에디터, 입력창, 커스텀 DropZone 등)는 **“탭 생성보다 로컬 드롭 처리를 우선”** 할 수 있어야 한다.
- 이를 위해 **전역 상태 플래그 없이**, 각 요소에 **플래그 속성**을 달아 동작을 분기한다.

---

## 2. ArcWork DnD 구조 개요

ArcWork(flexlayout 기반)는 두 가지 방식으로 외부 DnD를 처리할 수 있습니다.

- **강한 경로 (내부 DnD 직접 시작)**  
  - `layout.addTabWithDragAndDrop(nativeEvent, json)` / `layout.moveTabWithDragAndDrop(...)` 호출.
  - ArcWork가 **전역 드래그 상태를 선점**하고, 레이아웃 전체를 탭 드롭 영역으로 취급한다.
  - 이 경로를 사용하면 탭 콘텐츠 내부의 자식 요소들은 사실상 드롭을 가로채기 어렵다.

- **약한 경로 (external drag 핸들러)**  
  - 드래그 시작 시 `dataTransfer`에 `application/x-arcwork-tab`를 설정한다.
  - ArcWork `Layout`은 `onExternalDrag`를 통해 이 MIME을 읽어, **드롭 시점에만 탭 생성 여부를 결정**한다.
  - 이 경로에서는 **드롭 위치(event.target)** 를 기준으로 “탭을 만들지 말지”를 선택적으로 제어할 수 있다.

정책 상, **ArcManager → ArcWork 간 DnD는 약한 경로(`onExternalDrag`)를 사용하는 것을 원칙**으로 한다.  
강한 경로는 내부 구현 혹은 특수한 경우에만 사용한다.

---

## 3. ArcManager → ArcWork: 드래그 시작 정책

ArcManager에서 아이템을 드래그할 때는 다음 두 가지 payload를 설정한다.

- **ArcWork 탭용 payload**

```ts
// 예시: ArcManager onItemDragStart 내부
setArcWorkTabDragData(event, {
  id: item.id,
  type: 'arcdata-document', // ArcData 탭 컴포넌트 타입
  name: tabName,
});
```

- **ArcManager 전용 payload**

```ts
const payload = {
  source: 'arcmanager' as const,
  documentId: item.id,
  path: item.path,
  name: item.name ?? item.path,
  kind: docMeta?.kind ?? 'file',
  itemType: item.itemType,
  mimeType: docMeta?.fileMeta?.mimeType ?? null,
};

dt.setData('application/x-arcmanager-item', JSON.stringify(payload));
```

이때 **ArcManager에서는 `startAddTabDrag`와 같이 flexlayout 내부 DnD를 직접 시작하는 API를 사용하지 않는다.**  
ArcWork 탭 생성은 **항상 external drag(`onExternalDrag`) 경로에서만 결정**되도록 한다.

> 참고: 과거에는 `startAddTabDrag`를 외부에서도 사용할 수 있었으나,  
> 현재는 ArcWork 내부 flexlayout 전용으로만 사용되며,  
> ArcManager / ArcYou 등 외부 도메인에서는 **반드시 `setArcWorkTabDragData` + `onExternalDrag` 경로만 사용**한다.

---

## 4. Drop Sink 요소 정책 (`data-arcwork-drop-sink`)

### 4.1 개념

- ArcWork 탭 내의 특정 영역에서:
  - **기본 동작**: ArcManager에서 드롭하면 ArcWork가 탭을 생성/이동한다.
  - **예외 영역**: “이 영역에서의 드롭은 탭 생성보다 로컬 처리가 우선”이어야 할 수 있다.
- 이를 위해 **Drop Sink 요소**를 정의한다.

### 4.2 Drop Sink 정의

- Drop Sink 요소는 DOM 속성으로 **`data-arcwork-drop-sink="true"`** 를 가진다.
- ArcWork `onExternalDrag` 구현은 다음 순서를 따른다:
  1. `event.target`에서 시작해 부모 방향으로 DOM을 타고 올라가며,
  2. `data-arcwork-drop-sink="true"` 인 요소를 찾는다.
  3. 찾았으면:  
     → **ArcWork 탭 생성/이동 로직을 실행하지 않고**, `undefined`를 반환한다.  
     → 이 경우 드롭은 해당 컴포넌트의 `onDrop` 핸들러에서 처리된다.
  4. 찾지 못했으면:  
     → 기존대로 `application/x-arcwork-tab` payload를 읽어 탭을 생성/이동한다.

이로써 **전역 플래그 없이도 특정 컴포넌트가 ArcWork 탭 생성보다 드롭 처리를 우선할 수 있다.**

---

## 5. Drop Sink 컴포넌트 구현 가이드

Drop Sink로 동작해야 하는 컴포넌트(예: ArcDataNote 내 ArcManager 파일 첨부 DropZone)는 다음 규칙을 따른다.

### 5.1 DOM 속성

- 루트 혹은 드롭을 받아야 하는 컨테이너에 다음 속성을 부여한다.

```tsx
<div
  data-arcwork-drop-sink="true"
  onDrop={handleDrop}
  onDragOver={handleDragOver}
>
  {/* 내부 UI */}
</div>
```

### 5.2 드롭 핸들러

- `onDragOver`에서 `event.preventDefault()`를 호출하여 드롭 가능 상태로 만든다.
- `onDrop`에서는 ArcManager payload를 읽어 로컬 로직을 수행한다.

```ts
const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
  event.preventDefault();
};

const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
  event.preventDefault();
  const dt = event.dataTransfer;
  if (!dt) return;

  const raw = dt.getData('application/x-arcmanager-item');
  if (!raw) return;

  const item = JSON.parse(raw) as {
    documentId: string;
    name: string;
    kind: 'file' | 'note' | 'folder';
    path: string;
    mimeType?: string | null;
  };

  // TODO: item 정보를 사용해 컴포넌트 내부에 필요한 동작 수행
};
```

### 5.3 적용 예시

- ArcDataNote의 “ArcManager에서 파일 첨부” DropZone
- 향후:
  - YouTube 플레이어 탭에서 “ArcManager에서 관련 노트 첨부”
  - 그래프 뷰에서 “ArcManager에서 문서를 끌어와 노드 생성”

이런 컴포넌트는 모두 동일한 Drop Sink 정책을 사용해 **ArcWork 탭 생성과 충돌 없이** 동작할 수 있다.

---

## 6. 탭 생성 기본 동작 정책

요약:

- **기본 동작**
  - ArcManager에서 아이템을 드래그하면:
    - `application/x-arcwork-tab` + `application/x-arcmanager-item` payload를 함께 설정한다.
    - ArcWork는 `onExternalDrag`에서 이를 읽어, **Drop Sink가 아닌 영역**에 드롭될 때만 탭을 생성/이동한다.

- **예외(로컬 우선)**
  - ArcWork 탭 내부에서 로컬 드롭 처리가 필요하면:
    - 해당 영역에 `data-arcwork-drop-sink="true"`를 부여하고,
    - `onDrop`에서 `application/x-arcmanager-item`를 직접 처리한다.
    - 이 경우 ArcWork는 탭을 생성/이동하지 않는다.

이 정책을 기준으로, 새로운 DnD 기능(예: 다른 도메인 탭에서 ArcManager 아이템을 받아서 렌더링하는 기능)을 설계할 때도  
**“기본은 탭 생성, 필요 시 Drop Sink로 로컬 우선 처리”**라는 패턴을 일관되게 적용한다.


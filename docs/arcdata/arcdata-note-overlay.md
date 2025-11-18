## ArcDataNote Overlay DnD 아이디어 메모

> 상태: **설계 아이디어만 정리**, 구현은 보류  
> 실제 코드 구현 중 React Hooks 순서 문제가 발생하여, 현재는 ArcDataNote 내부 커스텀 오버레이 로직을 모두 제거해 둔 상태입니다.  
> 현재 DnD 환경은 다음과 같이 정리되어 있습니다:
> - Plate DnD: ArcDataNote 루트 div를 `rootElement` 로 사용하는 `DndProvider + HTML5Backend` 위에서만 동작
> - ArcWork 탭 DnD: `setArcWorkTabDragData` + `makeExternalDragHandler` + `data-arcwork-drop-sink` 정책으로 처리
> - ArcManager → ArcDataNote 파일 첨부: 전역 `AlertDialog` + `ArcManagerDropZone` (Drop Sink) 기반
> 이 문서는 위 환경을 전제로, 다시 "에디터 내부 Overlay 기반 DropZone"을 도입할 때의 설계 아이디어를 기록합니다.

---

## 1. 목표

- ArcDataNote(PlateEditor) 내부에서만 동작하는 **전용 오버레이 + 드래그 앤 드롭 영역**을 제공한다.
- 사용자가 Media 툴바의 “ArcManager에서 선택” 버튼을 클릭하면:
  - ArcWork 전체를 가리는 전역 모달(`AlertDialog`)이 아니라,
  - **ArcDataNote 탭 영역 안에 한정된 overlay**가 뜨고,
  - ArcManager에서 파일을 끌어다 놓으면 노트에 참조/Embed를 삽입한다.
- ArcWork의 탭 DnD(`setArcWorkTabDragData` + `onExternalDrag` + Drop Sink 정책)와 충돌하지 않고,  
  ArcManager → ArcDataNote 간 DnD UX를 자연스럽게 만든다.

---

## 2. Plate 렌더 훅을 이용한 Editor 내부 오버레이

Plate(PlateJS)는 `render` 옵션으로 에디터 구조의 특정 위치에 React 노드를 주입할 수 있다.

```ts
render?: {
  beforeContainer?: EditableSiblingComponent;
  afterContainer?: EditableSiblingComponent;
  beforeEditable?: EditableSiblingComponent;
  afterEditable?: EditableSiblingComponent;
  aboveNodes?: RenderNodeWrapper<...>;
  belowNodes?: RenderNodeWrapper<...>;
  belowRootNodes?: (props: PlateElementProps<TElement, C>) => React.ReactNode;
}
```

이 중 **`belowRootNodes`** 를 사용하면:

- Editor root 엘리먼트 내부에서, children(실제 문단 노드들) 위에 커스텀 오버레이를 렌더할 수 있다.
- 함수 안에서는 일반 React 컴포넌트처럼 **React 훅 사용 가능** (Plate 문서 기준).

아이디어:

- `OverlayKit` 같은 Plate 플러그인을 추가하고,
- `render.belowRootNodes`에서 `<ArcDataNoteOverlay />`를 렌더:

```ts
createPlatePlugin({
  key: 'arcdata-note-overlay',
  render: {
    belowRootNodes: () => <ArcDataNoteOverlay />,
  },
});
```

이렇게 하면 오버레이는 **ArcDataNote 탭 내부 / Editor 영역 안에만 존재**하게 된다.

---

## 3. ArcDataNote 전용 Overlay 컨텍스트

오버레이 ON/OFF 상태는 ArcDataNote 안에서만 공유되면 되므로, 간단한 Context로 관리할 수 있다.

설계 개요:

```ts
type ArcDataNoteOverlayMode = 'arcmanager-file';

interface ArcDataNoteOverlayState {
  isOpen: boolean;
  mode: ArcDataNoteOverlayMode | null;
}

interface ArcDataNoteOverlayContextValue {
  state: ArcDataNoteOverlayState;
  open: (mode: ArcDataNoteOverlayMode) => void;
  close: () => void;
}
```

- `ArcDataNoteOverlayProvider`는 `ArcDataNote` 루트에서 `PlateEditor`를 감싸는 Provider.
- `useArcDataNoteOverlay()` 훅을 통해:
  - Media 툴바 버튼 → `open('arcmanager-file')`
  - Overlay 컴포넌트 → `state.isOpen`, `close()` 사용.

Plate 플러그인의 `belowRootNodes`와 Context 훅을 함께 쓰면,

- Editor 구조 내부에서 overlay 위치를 제어하면서도,
- 외부 UI(툴바, 버튼)에서 overlay 열기/닫기를 쉽게 트리거할 수 있다.

---

## 4. Overlay UI 및 DnD 동작

### 4.1 Overlay DOM 구조

오버레이 자체는 Editor 컨테이너를 기준으로 absolute 포지션을 사용:

```tsx
function ArcDataNoteOverlay() {
  const { state, close } = useArcDataNoteOverlay();

  if (!state.isOpen || state.mode !== 'arcmanager-file') return null;

  return (
    <div
      data-arcwork-drop-sink="true"
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
    >
      <div className="pointer-events-auto rounded-md border bg-background/95 p-4 shadow-lg">
        {/* 안내 텍스트 + ArcManagerDropZone */}
      </div>
    </div>
  );
}
```

- `absolute inset-0` + `z-20`:
  - ArcDataNote(Editor) 영역만 덮는 오버레이.
  - ArcWork 전체 레이아웃을 가리지 않음.
- `pointer-events-none`/`pointer-events-auto` 조합:
  - 오버레이 외곽은 클릭/선택에 영향을 최소화,
  - 중앙 카드 영역만 마우스 이벤트 처리.
- `data-arcwork-drop-sink="true"`:
  - **Drop Sink 정책** (docs/dnd.md)에 따라,
  - ArcWork 쪽 external DnD가 이 영역 위의 드롭을 "탭 생성/이동"이 아닌 **로컬 드롭 처리**로 간주하게 하는 힌트.

### 4.2 ArcManager에서 드롭 처리

오버레이 내부에는 `ArcManagerDropZone`을 넣어 ArcManager 전용 payload를 처리:

```tsx
<ArcManagerDropZone
  allowedKinds={['file']}
  onSelect={(item) => {
    if (item.kind !== 'file') return;

    // 예: Plate 노드 삽입
    editor.tf.insertNodes({
      type: 'p',
      children: [{ text: `[파일] ${item.name}` }],
    });

    close();
  }}
/>
```

- ArcManager에서 시작한 드래그는:
  - `setArcWorkTabDragData(event, { id, type: 'arcdata-document', name })` 호출로 ArcWork 쪽에 탭 정보를 싣고,
  - 동시에 `application/x-arcmanager-item` payload도 포함합니다.
- Overlay 위에서 드롭하면:
  - `ArcManagerDropZone`이 `application/x-arcmanager-item`을 읽어 로컬 삽입을 처리하고,
  - 루트에 `data-arcwork-drop-sink="true"` 가 있기 때문에 ArcWork `onExternalDrag` 는 이 드롭을 탭 생성/이동으로 해석하지 않습니다.

---

## 5. MediaToolbarButton과의 연동

현재 구현(2025-11 기준)은 다시 **전역 `AlertDialog` + `ArcManagerDropZone`** 방식으로 되돌린 상태이다.  
향후 Overlay 아이디어를 구현할 때는 다음과 같이 연동한다:

1. `ArcDataNote`에서 `ArcDataNoteOverlayProvider`로 `PlateEditor`를 감싼다.
2. `EditorKit`에 `OverlayKit` Plate 플러그인을 추가한다.
3. `MediaToolbarButton`에서:

```ts
const { open } = useArcDataNoteOverlay();

<DropdownMenuItem onSelect={() => open('arcmanager-file')}>
  <FileUpIcon className="mr-2 size-4" />
  Select from ArcManager
</DropdownMenuItem>
```

4. 기존 `AlertDialog` + `ArcManagerDropZone` 코드는 제거하고,  
   ArcDataNoteOverlay가 내부에서 DropZone을 렌더하도록 책임을 위임한다.

이렇게 되면:

- 사용자는 여전히 Media 툴바의 “Select from ArcManager”를 통해 파일 첨부를 시작하지만,
- UI는 **ArcDataNote 탭 영역 안에 한정된 overlay**로 정리되고,
- ArcWork 전역 레이아웃과의 DnD 충돌을 최소화하는 구조를 만들 수 있다.

---

## 6. 현재 상태와 TODO

현재 상태:

- ArcDataNote 내부에 시도했던 Overlay 관련 코드(컨텍스트, 플러그인, UI)는 **모두 제거**되었다.
- 다시 **전역 AlertDialog 기반 `ArcManagerDropZone`**으로 돌아간 상태이며,
  - 이 방식은 React Hooks 순서 문제 없이 안정적으로 동작한다.

향후 구현 시 고려할 점:

- Plate `render.belowRootNodes`와 기존 플러그인들의 렌더 순서/훅 호출 순서가 충돌하지 않도록 주의.
- ArcWork external drag (`setArcWorkTabDragData` + `makeExternalDragHandler`) 와  
  Overlay DropZone의 Drop Sink(`data-arcwork-drop-sink="true"`) 관계를 다시 한 번 정밀하게 설계.
- 필요하다면, Overlay 모드를 켤 때 **ArcManager 쪽 DnD를 조금 더 "첨부 전용"으로 바꾸는 전역/로컬 플래그**도 함께 도입할 수 있다.

이 문서는 ArcDataNote Overlay 기능을 다시 도입할 때 참고하기 위한 설계 메모로 유지한다.

---

## 7. 현재 해결된 문제 요약

- **React DnD HTML5 backend와 ArcWork 탭 DnD 충돌**  
  - ArcDataNote에서 `DndProvider` 의 `rootElement` 를 노트 탭 컨테이너로 한정하여,  
    ArcWork/ArcManager 쪽 탭 드래그는 Plate DnD backend에서 관찰하지 않도록 분리했습니다.
- **ArcManager → ArcWork/ArcData 탭/로컬 드롭 혼재 문제**  
  - ArcManager는 항상 `setArcWorkTabDragData` + `application/x-arcmanager-item` 두 payload를 싣고,  
    ArcWork는 Drop Sink(`data-arcwork-drop-sink="true"`) 유무로 "탭 생성 vs 로컬 드롭"을 분기합니다.
- **ArcDataNote 전용 Overlay 설계**는 아직 구현하지 않았으며,  
  - 현재는 전역 `AlertDialog + ArcManagerDropZone` 을 사용해 기능을 제공하고,  
  - Overlay는 이 문서를 바탕으로 향후 다시 설계/도입할 예정입니다.



# ArcDataNote 개발 가이드

## 현재 상태

ArcDataNote 컴포넌트 구조 정리 및 경로 수정이 완료되었습니다.

### 완료된 작업

1. **컴포넌트 구조 정리**
   - `-static` 컴포넌트 → `ui/static/` 디렉토리로 이동 (25개)
   - `-node` 컴포넌트 → `ui/node/` 디렉토리로 이동 (28개)
   - `-button` 컴포넌트 → `ui/button/` 디렉토리로 이동 (23개)
   - `-buttons` 컴포넌트 → `ui/buttons/` 디렉토리로 이동 (2개)
   - `-toolbar` 컴포넌트 → `ui/toolbar/` 디렉토리로 이동 (4개)
   - `block-` 컴포넌트 → `ui/block/` 디렉토리로 이동 (6개)

2. **경로 수정 완료**
   - 절대 경로(`@/client/components/ui/...`) → 상대 경로(`../../ui/...`) 변경
   - 커스텀 훅 경로 업데이트 (`@/hooks/...` → `@/client/components/arc/ArcData/hooks/note/...`)
   - 상대 경로 문제 해결

3. **필수 패키지 설치 완료**
   - `lowlight` (코드 하이라이팅)
   - `react-dnd`, `react-dnd-html5-backend` (드래그앤드롭)
   - `remark-gfm`, `remark-math` (마크다운)
   - `date-fns` (날짜 처리)
   - `@emoji-mart/data` (이모지)
   - `lodash` (유틸리티)

4. **DnD 구조 정리 완료**
   - Plate DnD의 관할 범위를 ArcDataNote 루트 컨테이너로 한정
   - ArcWork/ArcManager 탭 DnD와 Plate 내부 블록 DnD가 서로 간섭하지 않도록 분리
   - ArcManager → ArcDataNote 파일 첨부는 `ArcManagerDropZone` + Drop Sink 정책으로 처리

## 앞으로 해야 할 사항

### 1. 누락된 패키지 설치 (우선순위: 중간)

현재 코드 기준으로 **파일 선택/업로드는 모두 커스텀 구현**으로 전환되었습니다.

- `use-file-picker` 의존성은 완전히 제거되었고,
  - 로컬 파일 선택: 브라우저 네이티브 `<input type="file">` 사용  
    (`media-toolbar-button.tsx`, `import-toolbar-button.tsx`, `media-placeholder-node.tsx`)
  - ArcManager 파일 선택: `ArcManagerDropZone` + HTML5 DnD payload(`application/x-arcmanager-item`) 사용
- 향후 확장용 패키지(아직 미도입)는 다음과 같습니다:

```bash
pnpm add @ariakit/react html2canvas-pro pdf-lib react-lite-youtube-embed react-tweet
```

**예정된 사용처(설계 레벨):**
- `@ariakit/react`: 자동완성/inline-combobox 개선
- `html2canvas-pro`: 에디터 캔버스를 이미지로 내보내기
- `pdf-lib`: 노트/뷰를 PDF로 내보내기
- `react-lite-youtube-embed`: YouTube 비디오 임베드
- `react-tweet`: 트윗(현 X) 임베드

실제 도입 시에는 각 기능을 ArcDataNote의 도메인 요구에 맞춰 **선별적으로** 추가하는 것을 권장합니다.

### 2. 타입 에러 수정 (우선순위: 중간)

최근 정리 기준으로 남아 있는 대표적인 타입 이슈는 다음과 같습니다(예시):

- `editor/settings-dialog.tsx`  
  - 버튼 variant: `"default"` → `"brand" | "outline" | "point" | "ghost"` 중 하나로 교체 필요
- `ui/node/equation-node.tsx`  
  - 버튼 variant: `"secondary"` 사용 → 동일하게 유효한 variant 값으로 변경 필요
- `ui/button/media-toolbar-button.tsx`  
  - `PlaceholderPlugin.insert.media` 의 인자가 `FileList` 타입을 기대하는 부분  
    → 현재는 `File[]` 를 넘기고 있어, 타입 단언/래퍼 유틸 등으로 정리 필요

이 외의 **use-file-picker 관련 타입 에러, Tooltip title 누락 등은 모두 제거/해결된 상태**입니다.  
새로 생기는 타입 에러는 ArcDataNote 코드가 안정화된 이후에 순차적으로 정리하는 것을 목표로 합니다.

### 3. 기능 테스트 (우선순위: 낮음)

패키지 설치 및 타입 에러 수정 후 다음 기능들을 테스트해야 합니다:

1. **에디터 기본 기능**
   - 텍스트 입력 및 편집
   - 블록 드래그 앤 드롭
   - 코드 블록 하이라이팅

2. **미디어 기능**
   - 이미지/비디오/오디오 업로드
   - YouTube 임베드
   - 트위터 임베드

3. **내보내기 기능**
   - 이미지 내보내기 (html2canvas-pro)
   - PDF 내보내기 (pdf-lib)

4. **AI 기능**
   - AI 채팅
   - 자동완성 (copilot)

## 참고사항

### 디렉토리 구조

```
ui/
├── static/          # 정적 렌더링용 컴포넌트 (-static)
├── node/            # 노드 타입 컴포넌트 (-node)
├── button/          # 툴바 버튼 컴포넌트 (-button)
├── buttons/         # 툴바 버튼 그룹 (-buttons)
├── toolbar/         # 툴바 컴포넌트 (-toolbar)
├── block/            # 블록 관련 컴포넌트 (block-)
└── ...              # 기타 공통 컴포넌트
```

### 경로 규칙

- `editor/plugins/` → `ui/`: `../../ui/`
- `editor/plugins/` → `ui/node/`: `../../ui/node/`
- `editor/plugins/` → `ui/static/`: `../../ui/static/`
- `editor/plugins/` → `ui/block/`: `../../ui/block/`
- 공통 UI 컴포넌트: `@/client/components/ui/...`
- 커스텀 훅: `@/client/components/arc/ArcData/hooks/note/...`

---

## 4. DnD 구조 및 ArcWork/ArcManager 연동

### 4.1 Plate 내부 DnD (블록 이동)

- Plate DnD는 `@platejs/dnd` 의 `DndPlugin` 과 `BlockDraggable` 로 구성됩니다.
- `editor/plugins/dnd-kit.tsx`:

```ts
export const DndKit = [
  DndPlugin.configure({
    options: {
      enableScroller: true,
      onDropFiles: ({ dragItem, editor, target }) => {
        editor
          .getTransforms(PlaceholderPlugin)
          .insert.media(dragItem.files, { at: target, nextBlock: false });
      },
    },
    render: {
      aboveNodes: BlockDraggable,
    },
  }),
];
```

- `ArcDataNote` 컴포넌트에서 `DndProvider + HTML5Backend` 를 한 번만 감싸고,  
  **`options.rootElement` 를 ArcDataNote 루트 div** 로 지정하여 Plate DnD의 관할 범위를 노트 탭 내부로 한정합니다.

```ts
export function ArcDataNote(): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [rootElement, setRootElement] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (containerRef.current && rootElement !== containerRef.current) {
      setRootElement(containerRef.current);
    }
  }, [rootElement]);

  return (
    <div ref={containerRef} className="h-full w-full">
      {rootElement && (
        <DndProvider backend={HTML5Backend} options={{ rootElement }}>
          <PlateEditor />
        </DndProvider>
      )}
    </div>
  );
}
```

→ 이 구조 덕분에 **ArcWork/ArcManager 탭 DnD와 Plate 내부 블록 DnD가 서로의 backend를 건드리지 않고 공존**할 수 있습니다.

### 4.2 ArcManager → ArcDataNote 파일 첨부 DnD

- ArcManager에서 문서를 드래그할 때:
  - **ArcWork 탭용 payload**: `setArcWorkTabDragData(event, { id, type: 'arcdata-document', name })`
  - **ArcManager 전용 payload**: `application/x-arcmanager-item` (`documentId, path, name, kind, mimeType` 등)
- ArcDataNote 쪽에서는 Media 툴바의 **"Select from ArcManager"** 항목을 통해  
  `AlertDialog + ArcManagerDropZone` 를 띄워, ArcManager payload 만 로컬에서 처리합니다.

```tsx
<AlertDialog
  open={arcManagerDialogOpen}
  onOpenChange={(value) => {
    setArcManagerDialogOpen(value);
  }}
>
  <AlertDialogContent className="gap-4">
    <AlertDialogHeader>
      <AlertDialogTitle>ArcManager에서 파일 선택</AlertDialogTitle>
    </AlertDialogHeader>
    <AlertDialogDescription>
      ArcManager 파일 트리에서 문서를 드래그해 이 영역에 드롭하면, 노트에 간단한 파일 참조가 추가됩니다.
    </AlertDialogDescription>
    <ArcManagerDropZone
      allowedKinds={['file']}
      onSelect={handleSelectFromArcManager}
    />
    …
  </AlertDialogContent>
</AlertDialog>
```

- `ArcManagerDropZone` 루트에는 `data-arcwork-drop-sink="true"` 가 부여되어 있어,  
  **이 영역 위에서는 ArcWork 탭 생성/이동 로직이 비활성화되고, ArcDataNote의 로컬 드롭 로직만 실행**됩니다.

### 4.3 향후 Overlay 설계와의 관계

- 현재는 전역 `AlertDialog` 기반 DropZone을 사용하지만,
  - Plate `render.belowRootNodes` 를 활용한 ArcDataNote 전용 오버레이 설계는  
    `docs/arcdata/arcdata-note-overlay.md` 에 별도로 정리되어 있습니다.
- 중요한 점은 **이미 DnD 경계(Plate vs ArcWork/ArcManager)가 정리된 상태**이므로,
  - 향후 Overlay를 다시 도입할 때는  
    - Plate DnD는 ArcDataNote 루트 컨테이너 내부에서만 동작하고,
    - ArcWork 쪽 DnD는 `setArcWorkTabDragData + Drop Sink` 정책만 따르면 된다는 것입니다.

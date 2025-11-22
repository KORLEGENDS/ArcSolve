## ArcData 문서 뷰어 API (개요)

ArcData는 ArcSolve 내에서 **문서(특히 파일 기반 문서)를 조회/편집하기 위한 통합 뷰어 레이어**입니다.  
현재 구현은 **PDF + 노트(Plate) + 드로우(Excalidraw) + 이미지(ArcDataImage)**를 지원하며, 추후 다른 파일 타입까지 확장할 수 있도록 설계되어 있습니다.

이 문서는 ArcData의 **전반적인 개념과 ArcWork/ArcManager 연동 방식, 파일 타입 확장 전략**을 다룹니다.  
PDF 뷰어 내부 구조(툴바, 사이드바, PDFManager, 상태 훅 등)는 [`arcdata-pdf.md`](./arcdata-pdf.md)에 별도로 정리되어 있습니다.

---

## 1. ArcData의 역할

- **탭 기반 문서 뷰어 컨테이너**
  - ArcWork 탭 시스템과 연동되어, 사용자가 ArcManager에서 특정 문서를 드래그하면  
    해당 문서를 ArcData 탭으로 열어주는 역할을 합니다.
- **문서 ID 기반 데이터 로딩**
  - ArcData는 `documentId`만 알고 있고, 실제 문서 메타데이터/다운로드 URL 조회는  
    내부에서 React Query를 통해 처리합니다.
- **레이아웃 및 뷰어 공통 패턴 제공**
  - 상단 툴바 + 좌측 패널(예: 썸네일 사이드바) + 우측 메인 뷰어라는 일관된 레이아웃을 제공합니다.
  - 파일 타입별로 내부 뷰어(PDF, 이미지, 텍스트 등)를 교체하는 구조를 목표로 합니다.

현재는 **PDF/노트/드로우/이미지**를 기본으로 지원하며, PDF 뷰어에 대한 자세한 API 설명은 [`arcdata-pdf.md`](./arcdata-pdf.md)를 참고하세요. 노트/드로우 저장 흐름은 아래 “저장/편집 공통 로직”을 참고합니다.

---

## 2. ArcData 컴포넌트 API (공통)

### 2.1. ArcDataProps

```ts
export interface ArcDataProps {
  /** ArcWork 탭 메타데이터에서 넘어오는 문서 ID (document.documentId) */
  documentId: string;
}
```

- ArcData는 **문서 전체 DTO가 아니라 `documentId`만**을 인자로 받습니다.
- 실제 문서 메타/다운로드 URL 조회는 내부에서 React Query를 통해 수행합니다.
  - 예: `useDocumentDownloadUrl(documentId)` → R2 사인 URL 발급

### 2.2. 내부 데이터 플로우 (요약)

ArcData의 기본 동작 흐름은 다음과 같습니다.

1. `documentId`로 문서 메타/콘텐츠 조회 (`useDocumentDetail`, `useDocumentContent`)
2. 문서 kind 및 MIME 정보를 기반으로 적절한 호스트 컴포넌트를 선택
   - `ArcDataNoteHost`: Plate 기반 노트 (`application/vnd.arc.note+plate` 등)
   - `ArcDataDrawHost`: Excalidraw 기반 드로우 (`application/vnd.arc.note+draw`)
   - `ArcDataImageHost`: Next Image 기반 이미지 뷰어 (`image/*`)
   - `ArcDataPDFHost`: PDF/파일 MIME
   - `ArcDataPlayerHost`: 오디오/비디오/YouTube
3. 각 호스트는 공통 저장 훅(`useDocumentSave`)을 통해 mod+s 단축키로만 서버에 POST (자동 저장 없음)
4. 뷰어 내부 상태(페이지, 툴, 모드 등) 관리
5. 상단 툴바 + 좌측 패널 + 우측 메인 뷰어 레이아웃 렌더링

PDF 세부 구조는 [`arcdata-pdf.md`](./arcdata-pdf.md)에, 이미지 뷰어 요약은 아래 2.3 절에 정리되어 있습니다.

### 2.3. ArcDataImage (이미지 뷰어)

- MIME이 `image/`로 시작하면 `ArcDataImageHost`가 동작합니다.
- 호스트는 `storageKey`가 외부 URL인지 확인한 뒤
  - 외부 URL이면 그대로 전달하고
  - 내부 스토리지(R2 등)라면 `useDocumentDownloadUrl(documentId, { inline: true })`로 서명 URL을 발급합니다.
- `ArcDataImage` 컴포넌트는 Next.js `Image`만으로 화면 전체에 이미지를 렌더링하며, 추가 툴바나 버튼/스피너 없이 즉시 표시합니다.
- 보기 전용이므로 저장/편집 로직은 없습니다.

---

## 3. 저장/편집 공통 로직

ArcData의 노트/드로우 편집기는 동일한 저장 파이프라인을 공유합니다.

1. **공통 저장 훅 `useDocumentSave`**
   - 위치: `src/client/components/arc/ArcData/hooks/common/useDocumentSave.ts`
   - `documentQueryOptions.updateContent`를 감싸며 `saveContent(contents)` 한 번으로 서버에 POST
   - 저장 성공 시 해당 document content 쿼리만 무효화
   - `useSaveShortcut`을 함께 제공해 `Cmd/Ctrl + S` 입력을 감지 후 전달된 핸들러 실행

2. **드로우 저장 훅 `useDocumentDrawSave`**
   - 최신 Excalidraw 씬(`DrawContent`)을 ref에 보관
   - `ArcDataDraw`의 `onChange`에서 ref를 업데이트
   - mod+s 또는 외부에서 `save()` 호출 시 ref의 씬을 `useDocumentSave`에 전달
   - 파일 업로드/다운로드는 아직 구현하지 않고 `files` 맵을 그대로 JSON에 포함해 저장

3. **노트 저장 훅 `useDocumentNoteSave`**
   - Plate 에디터의 `EditorContent`를 ref로 유지
   - `ArcDataNote`의 `onChange`를 통해 ref를 갱신
   - mod+s 시 ref 값을 `useDocumentSave`로 전달하여 저장

4. **호스트 연동 규칙**
   - `ArcDataNoteHost`와 `ArcDataDrawHost`는 항상 `useDocumentContent(documentId)`와 저장 훅을 함께 호출해 React 훅 순서를 일정하게 유지
   - 로딩/에러 상태에서도 훅이 먼저 실행된 뒤 조건부 렌더링으로 분기
   - 저장은 자동으로 실행되지 않고, mod+s 시점 또는 다른 명시적 트리거에서만 수행

이 구조 덕분에 향후 이미지 등 새로운 편집기를 추가하더라도 `useDocumentSave` + `useSaveShortcut` 조합을 재사용할 수 있습니다.

---

## 3. ArcWork 연동 (탭 시스템)

ArcData는 ArcWork의 탭/레이아웃 시스템과 긴밀하게 연동되어 동작합니다.  
ArcWork 자체에 대한 자세한 설명은 [`docs/arcwork/arcwork-api.md`](../arcwork/arcwork-api.md)를 참고하세요.

### 3.1. ArcData 탭 메타데이터

ArcData 탭은 다음 메타데이터 구조를 사용합니다.

- `id`:
  - `document.documentId` (문서 UUID)
- `name`:
  - 탭 타이틀로 표시할 파일명 (가능하면 `document.name` 사용, 없으면 path fallback)
- `type`:
  - `'arcdata-document'` (ArcData 문서 뷰어용 컴포넌트 키)

예:

```ts
const meta = {
  id: document.documentId,
  name: document.name ?? document.path.split('.').pop()!, // 가능하면 document.name 사용, 없으면 path 마지막 segment
  type: 'arcdata-document',
};
```

### 3.2. ArcWorkContent factory 바인딩

`ArcWorkContent`에서 ArcData 탭을 factory에 매핑합니다.  
실제 구현은 프로젝트 버전에 따라 다를 수 있으므로, 아래는 **패턴 예시**로만 참고하세요.

```tsx
import { ArcData } from '@/client/components/arc/ArcData';

const factory = useCallback(
  createFactory((node: TabNode) => {
    const component = node.getComponent();

    if (component === 'arcdata-document') {
      const documentId = node.getId();
      if (!documentId) {
        return <div className="p-4">문서 ID 정보가 없습니다.</div>;
      }
      return <ArcData documentId={documentId} />;
    }

    // ... 다른 component 타입(arcyou-chat-room 등) 처리 ...
    return null;
  }),
  [],
);
```

- 공통 규칙:
  - ArcWork는 flexlayout 탭 노드의 `component` 필드를 보고,  
    `component === 'arcdata-document'`일 때 ArcData를 렌더합니다.
  - `node.getId()`는 탭 메타데이터의 `id`(`documentId`)를 그대로 반환합니다.

> 실제 동작은 `src/app/(frontend)/[locale]/(user)/(core)/components/ArcWorkContent.tsx`의  
> 최신 구현을 항상 기준으로 삼으세요.

### 3.3. ArcManager 파일 트리에서 DnD로 탭 열기

ArcData 탭은 주로 **ArcManager 파일 트리에서 DnD로 생성**됩니다.

`ArcManager.tsx`의 files 탭에서 `ArcManagerTree`에 다음과 같이 DnD 핸들러를 전달합니다.

```tsx
setArcWorkTabDragData(event, {
  id: item.id,
  name: item.name || item.path.split('.').pop()!,
  type: 'arcdata-document',
});

<ArcManagerTree
  items={treeItems}
  onFolderEnter={(path) =>
    patchTabState('documents', { currentPath: path, isCollapsed: false })
  }
  onItemDragStart={({ item, event }) => {
    if (item.itemType === 'item') {
      setArcWorkTabDragData(event, {
        id: item.id,          // = documentId
        name: item.name || item.path.split('.').pop()!,
        type: 'arcdata-document',
      });
    }

    // ArcManager 전용 드래그 데이터 설정 (문서 이동용 등)
    // ...
  }}
  // ...
/>;
```

- `item.itemType === 'item'`인 항목만 ArcData 탭 대상입니다.
- `id`에는 `doc.documentId`가, `name`에는 ltree 경로의 마지막 segment가 들어갑니다.
- `startAddTabDrag`는 ArcWork 레이아웃에 `{ id, name, type }`를 넣어 DnD 탭 생성/이동을 처리합니다.

> 현재 구현에서는 **DnD로 ArcData 탭을 여는 패턴**이 기본이며,  
> 더블클릭 등 다른 트리거는 별도 구현이 필요합니다.

---

## 4. 파일 타입/렌더러 확장 전략

### 4.1. 기본 아이디어

- ArcData는 궁극적으로 **여러 종류의 문서 타입**을 지원하기 위한 컨테이너입니다.
  - 예: `kind = 'file' | 'note' | 'folder'` 및 `fileMeta.mimeType` 기반으로 렌더러를 선택
- 현재는 PDF만 지원하지만, 동일한 패턴으로 이미지/텍스트/오디오/비디오 뷰어를 추가할 수 있습니다.

### 4.2. 확장 시 권장 절차

1. **Document 스키마 확인**
   - `kind`, `fileMeta.mimeType`, `uploadStatus` 등을 기준으로 렌더링 가능한 상태인지 판별합니다.
2. **렌더러 컴포넌트 정의**
   - 예: `ArcDataImageViewer`, `ArcDataTextViewer` 등
   - 가능한 한 **ArcDataTopbar + 좌측 패널 + 메인 뷰어** 레이아웃 패턴을 재사용합니다.
3. **ArcData 내부 분기 추가**
   - `documentId`로 조회한 문서 메타를 기반으로:
     - PDF → 기존 PDF 뷰어 경로로
     - 이미지 → 이미지 뷰어 경로로
     - 기타 → 적절한 fallback 또는 “미지원 파일 형식” 메시지
4. **문서화 및 ArcWork 통합**
   - 새 파일 타입에 대해 `type`을 나눌지(`arcdata-image`, `arcdata-text` 등)  
     또는 하나의 `arcdata-document`로 모두 처리할지 정책을 결정합니다.

> PDF 전용 뷰어의 구체적인 구현(줌/너비 맞춤/사이드바/렌더러 내부 구조)은  
> [`arcdata-pdf.md`](./arcdata-pdf.md)를 참고하세요.

---

## 5. 정리

- ArcData는 **문서 ID → 문서 뷰어**를 매핑해주는 상위 컨테이너로, ArcWork/ArcManager와 연동됩니다.
- 현재는 PDF/노트/드로우를 지원하며, 저장 로직은 `useDocumentSave`를 중심으로 mod+s 단축키만 허용합니다(자동 저장 없음).
- 새로운 렌더러를 추가할 때는 **탭 메타데이터 / ArcData 내부 분기 / ArcWork factory / 공통 저장 훅 / 문서화**의 다섯 축을 함께 고려하세요.
- PDF 뷰어 구체 구현은 [`arcdata-pdf.md`](./arcdata-pdf.md)를 참고하고, 노트/드로우는 위의 저장/편집 공통 로직을 기준으로 확장합니다.



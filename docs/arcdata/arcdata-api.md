## ArcData 문서 뷰어 API (개요)

ArcData는 ArcSolve 내에서 **문서(특히 파일 기반 문서)를 조회/편집하기 위한 통합 뷰어 레이어**입니다.  
현재 구현은 **PDF 전용 MVP**에 초점을 맞추고 있지만, 추후 다른 파일 타입까지 확장할 수 있도록 설계되어 있습니다.

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

현재는 **PDF 파일만 지원**하며, PDF 뷰어에 대한 자세한 API 설명은 [`arcdata-pdf.md`](./arcdata-pdf.md)를 참고하세요.

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

1. `documentId`로 문서 다운로드 URL 조회
2. 다운로드 URL을 사용해 실제 파일(PDF 등)을 로드
3. 현재 페이지/총 페이지/뷰어 ref 등 상호작용 상태 관리
4. 뷰어 줌/뷰 설정 상태 관리
5. 상단 툴바 + 좌측 패널 + 우측 메인 뷰어 레이아웃 렌더링

현재는 2~5 단계가 **PDF 전용 구현**으로 구성되어 있으며,  
해당 세부 구조는 [`arcdata-pdf.md`](./arcdata-pdf.md)에서 중복 없이 설명합니다.

---

## 3. ArcWork 연동 (탭 시스템)

ArcData는 ArcWork의 탭/레이아웃 시스템과 긴밀하게 연동되어 동작합니다.  
ArcWork 자체에 대한 자세한 설명은 [`docs/arcwork/arcwork-api.md`](../arcwork/arcwork-api.md)를 참고하세요.

### 3.1. ArcData 탭 메타데이터

ArcData 탭은 다음 메타데이터 구조를 사용합니다.

- `id`:
  - `document.documentId` (문서 UUID)
- `name`:
  - 탭 타이틀로 표시할 파일명 (일반적으로 `path`의 마지막 segment)
- `type`:
  - `'arcdata-document'` (ArcData 문서 뷰어용 컴포넌트 키)

예:

```ts
const meta = {
  id: document.documentId,
  name: getNameFromPath(document.path), // 예: "files.gpt_4_pdf" → "gpt_4_pdf"
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
const startAddTabDrag = useArcWorkStartAddTabDrag();

<ArcManagerTree
  items={treeItems}
  onFolderEnter={(path) =>
    patchTabState('files', { currentPath: path, isCollapsed: false })
  }
  onItemDragStart={({ item, event }) => {
    if (item.itemType === 'item') {
      const name = getNameFromPath(item.path);
      startAddTabDrag(event, {
        id: item.id,          // = documentId
        name,
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

- ArcData는 **문서 ID → 문서 뷰어**를 매핑해주는 상위 컨테이너로,  
  ArcWork/ArcManager와의 연동을 통해 탭 기반 문서 뷰잉 경험을 제공합니다.
- 현재는 PDF 전용이지만, 동일한 패턴으로 다른 파일 타입을 수용할 수 있도록 설계되어 있으며,  
  새로운 렌더러를 추가할 때는 **탭 메타데이터 / ArcData 내부 분기 / ArcWork factory / 문서화**의 네 축을 함께 고려해야 합니다.
- PDF 뷰어 구체 구현을 파악하려면 반드시 [`arcdata-pdf.md`](./arcdata-pdf.md)를 함께 참고하세요.



## ArcData PDF 뷰어 API

ArcData는 ArcSolve 내에서 **파일 기반 문서 조회/편집을 위한 통합 뷰어 레이어**이며,  
현재는 **PDF 전용 MVP**가 먼저 구현되어 있습니다. 이 문서는 PDF 뷰어 관련 API를 상세히 설명합니다.

> ArcData 전반(ArcWork 연동, 탭 메타데이터, 파일 타입 확장 전략 등)에 대한 개요는  
> [`arcdata-api.md`](./arcdata-api.md)를 참고하세요.

---

## 1. 전체 구조

PDF 뷰어 관련 주요 구성요소는 다음과 같습니다.

- `ArcData.tsx`
  - ArcData 도메인의 **엔트리 포인트 컴포넌트**
  - props: `{ documentId: string }`
  - 역할:
    - `documentId`로 문서 다운로드 URL 조회
    - PDF 문서 로드
    - 페이지/뷰어 상호작용 상태 관리
    - 뷰어 설정(줌/너비 맞춤) 관리
    - 상단 툴바 / 좌측 썸네일 / 메인 PDF 뷰어 레이아웃 구성

- `components/core/ArcDataPDF/ArcDataPDFTopbar.tsx`
  - PDF 상단 툴바
  - 공용 상단 레이아웃 컴포넌트인 `ArcDataTopbar` 위에서 동작하며,
  - **확대/축소/너비 맞춤**을 제어하는 UI를 제공합니다.

- `components/core/ArcDataPDF/ArcDataPDFSidebar.tsx`
  - PDF 썸네일 목록 및 페이지 네비게이션 담당
  - 내부에서 공용 레이아웃 컴포넌트인 `ArcDataSidebar`를 사용해 좌측 사이드바 레이아웃/스크롤 보정을 처리하고,
  - `pdfManager.renderPage()`를 사용해 각 페이지 썸네일을 렌더링합니다.

- `components/core/ArcDataPDF/PDFViewer.tsx`
  - PDF 코어 렌더러 래퍼
  - 내부에서 **`PDFCore`**만 사용 (오버레이는 MVP에서 비활성화)

- `components/core/ArcDataPDF/PDFCore.tsx`
  - 실제 PDF 페이지 캔버스를 렌더링하고, 가상화/스크롤/페이지 감지 등을 처리

- `hooks/pdf/usePDFLoad.ts`
  - PDF 문서를 로드하는 단순 상태 훅

- `hooks/pdf/usePDFInteraction.ts`
  - 현재 페이지, 총 페이지 수, 스크롤 기반 페이지 감지 등을 관리

- `hooks/pdf/usePDFSetting.ts` (`usePDFSetting` / `useViewerSetting`)
  - 줌 레벨, 너비 맞춤, 뷰어 컨테이너 ref를 관리하는 뷰 설정 훅

- `managers/PDFManager.ts`
  - pdf.js(`pdfjs-dist`)와 상호작용하는 **싱글톤 매니저**
  - 문서 로드/캐시/렌더링/취소를 담당

---

## 2. ArcData 컨테이너 (PDF 전용 동작)

### 2.1. ArcDataProps

```ts
export interface ArcDataProps {
  /** ArcWork 탭 메타데이터에서 넘어오는 문서 ID (document.documentId) */
  documentId: string;
}
```

- ArcData는 **문서 전체 DTO가 아니라 `documentId`만**을 인자로 받습니다.
- 실제 문서 데이터/다운로드 URL 조회는 내부에서 React Query(`useDocumentDownloadUrl`)를 통해 수행합니다.

### 2.2. ArcData 내부 렌더링 플로우

1. **다운로드 URL 발급**
   - `useDocumentDownloadUrl(documentId, { inline: true, enabled: true })`
   - 서버는 R2 사인 URL을 만들어 `{ url, expiresAt }`를 반환합니다.
2. **PDF 문서 로드**
   - `usePDFLoad(pdfUrl)` → `pdfManager.loadDocument(pdfUrl)` 호출
   - 캐시를 활용해 동일 URL에 대한 중복 로드를 방지합니다.
3. **페이지/스크롤 상호작용 관리**
   - `usePDFInteraction()`으로 현재 페이지, 총 페이지 수, 뷰어 ref, 사이드바 클릭 핸들러를 관리합니다.
4. **뷰어 설정(줌/너비 맞춤) 관리**
   - `useViewerSetting({ isPDF: true, pdfDocument, imageNaturalWidth: null, ... })`
   - `zoomLevel` / `isFitWidth` / `viewerContentRef` / `fitWidthOnce` 등을 제공합니다.
5. **상단 툴바 + 좌/우 레이아웃 렌더링**

핵심 레이아웃은 다음과 같습니다 (요약):

```tsx
return (
  <div className="flex h-full w-full flex-col">
    <ArcDataPDFTopbar
      zoomLevel={zoomLevel}
      canZoomIn={zoomLevel < ZOOM_LEVELS.MAX}
      canZoomOut={zoomLevel > ZOOM_LEVELS.MIN}
      isFitWidth={isFitWidth}
      onZoomIn={handleZoomIn}
      onZoomOut={handleZoomOut}
      onFitWidthOnce={fitWidthOnce}
      onFitWidthToggle={toggleFitWidth}
    />

    <div className="flex h-0 w-full flex-1 flex-row">
      <ArcDataPDFSidebar
        currentPage={visiblePage}
        totalPages={totalPages}
        pdfDocument={pdfDocument}
        onPageChange={handleSidebarPageClick}
      />

      <div ref={viewerContentRef} className="flex h-full min-w-0 flex-1">
        <PDFViewer
          ref={viewerRef}
          document={pdfDocument}
          zoom={zoomLevel}
          textLayerEnabled
          onVisiblePageChange={onVisiblePageChange}
          className="h-full w-full"
        />
      </div>
    </div>
  </div>
);
```

---

## 3. 상단 툴바 API (`ArcDataPDFTopbar`)

### 3.1. Props

```ts
export interface ArcDataPDFTopbarProps {
  zoomLevel: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  isFitWidth: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** 퍼센트 텍스트 클릭 시 '일시적' 너비 맞춤 */
  onFitWidthOnce: () => void;
  /** 아이콘 버튼으로 지속적인 너비 맞춤 모드를 토글 */
  onFitWidthToggle: () => void;
  className?: string;
}
```

### 3.2. 동작 규칙

- **확대/축소 버튼**
  - `onZoomOut` / `onZoomIn` 호출
  - `canZoomOut` / `canZoomIn`에 따라 버튼 `disabled` 제어
- **현재 줌 비율 표시 (`{zoomLevel}%`)**
  - 단순 텍스트가 아니라 `button`으로 렌더링됩니다.
  - 클릭 시 **`onFitWidthOnce()`를 호출**하여,
    - 현재 뷰어 컨테이너 너비를 기준으로 **딱 한 번만** 줌 레벨을 너비 맞춤에 맞게 재계산합니다.
    - 이때 `isFitWidth` 상태는 변경되지 않으므로, 리사이즈나 사이드바 토글에 따른 자동 재계산은 수행되지 않습니다.
- **너비 맞춤 아이콘 버튼**
  - `pressed={isFitWidth}`
  - 클릭 시 `onFitWidthToggle()`을 호출하여 **지속적인 너비 맞춤 모드**를 ON/OFF 합니다.
  - 모드 ON 시:
    - `ResizeObserver`를 통해 컨테이너 크기 변화에 대응하여 자동으로 줌을 재계산합니다.
    - 사이드바 토글/문서 변경 시에도 너비 맞춤이 유지되도록 `recomputeFitWidth()`가 호출됩니다.

---

## 4. 썸네일 사이드바 API (`ArcDataPDFSidebar`)

### 4.1. Props

```ts
export interface ArcDataPDFSidebarProps {
  currentPage: number;
  totalPages: number;
  pdfDocument: PDFDocumentProxy | null;
  onPageChange: (pageNumber: number) => void;
  className?: string;
}
```

### 4.2. 동작 요약

- PDF 문서가 없거나 `totalPages <= 0`이면 `null`을 반환하여 렌더링하지 않습니다.
- `pdfDocument.numPages`를 기반으로 `[1, totalPages]` 범위의 페이지에 대해 썸네일 캔버스를 생성합니다.
- 각 썸네일은 `pdfManager.renderPage`를 호출해 낮은 DPR(기본 1.5)로 렌더링합니다.
- `ArcDataPDFSidebar`는 내부에서 공용 레이아웃 컴포넌트인 `ArcDataSidebar`를 사용합니다.
  - `ArcDataSidebar`는 좌측 고정 폭 사이드바와 스크롤 컨테이너를 제공하고,
  - 현재 활성 페이지(`currentPage`)가 바뀔 때 해당 썸네일이 리스트 뷰포트 안에 들어오도록 스크롤을 자동 보정합니다.

---

## 5. PDF 뷰어 코어 (`PDFViewer` / `PDFCore`)

### 5.1. `PDFViewer` 래퍼

```ts
export interface PDFViewerProps {
  document: PDFDocumentProxy;
  docKey?: string;
  zoom: number; // 100 = 100%
  textLayerEnabled?: boolean;
  onVisiblePageChange?: (pageNumber: number) => void;
  className?: string;
}
```

- `zoom`은 **퍼센트 값(예: 100, 125, 150)**으로 전달되며, 내부에서 `scale = zoom / 100`으로 변환됩니다.
- MVP 버전에서는:
  - 오버레이/번역/인용 기능을 모두 제거하여 **순수 PDF 캔버스 뷰어**로만 동작합니다.
  - `textLayerEnabled`는 현재 구현에서는 실제 텍스트 레이어를 생성하지 않지만, 향후 확장을 위해 옵션으로 남겨두었습니다.

### 5.2. `PDFViewerHandle`

```ts
export interface PDFViewerHandle {
  scrollToPage: (pageNumber: number) => void;
  // 오버레이 관련 메서드는 MVP에서는 no-op 또는 null 반환
}
```

- `ArcData`는 `viewerRef`를 통해 `scrollToPage`를 사용합니다.
  - `usePDFInteraction`에서 사이드바 클릭 시 해당 페이지로 스크롤 이동하는 데 사용됩니다.

### 5.3. `PDFCore`

- 문서 전체를 세로 방향으로 렌더링하고, 다음을 담당합니다.
  - 페이지별 캔버스 DOM 생성
  - 뷰포트(viewport) 기반 렌더링 크기 계산
  - 스크롤 이벤트를 감지하여 현재 보이는 페이지(`visiblePage`)를 계산
  - 가시 범위를 벗어난 페이지는 **저해상도 플레이스홀더 캔버스로 교체**하여 메모리 사용량을 줄임
- `pdfManager.renderToCanvas`를 활용하여 고해상도 디스플레이에서도 선명한 렌더링을 제공하되, DPR 상한(`maxDpr`)으로 메모리 사용량을 제어합니다.

---

## 6. 뷰 상태 훅

### 6.1. `usePDFLoad`

- 시그니처 (요약):

```ts
function usePDFLoad(src: string | null): {
  document: PDFDocumentProxy | null;
  isLoading: boolean;
  error: Error | null;
}
```

- `src`가 `null`이면 로드를 시도하지 않고 `{ document: null }`을 유지합니다.
- `src`가 변경될 때마다 `pdfManager.loadDocument(src)`를 호출합니다.

### 6.2. `usePDFInteraction`

- 역할:
  - 현재 보이는 페이지(`visiblePage`) 계산
  - 총 페이지 수(`totalPages`) 상태 관리
  - `viewerRef`를 통해 `PDFViewerHandle`을 제어
  - 사이드바 클릭 → `scrollToPage`로 스크롤 이동
- 반환값 (요약):

```ts
{
  visiblePage: number;
  totalPages: number;
  viewerRef: React.RefObject<PDFViewerHandle | null>;
  setTotalPages: (n: number) => void;
  handleSidebarPageClick: (pageNumber: number) => void;
  onVisiblePageChange: (pageNumber: number) => void;
}
```

### 6.3. `usePDFSetting` / `useViewerSetting` (`usePDFSetting.ts`)

- **줌/너비 맞춤/사이드바 상태**를 캡슐화하는 훅입니다.

```ts
export const ZOOM_LEVELS = {
  MIN: 25,      // 25%
  MAX: 500,     // 500%
  DEFAULT: 100, // 100%
  STEP: 25,     // 25% 단위
} as const;
```

- 파라미터:

```ts
usePDFSetting({
  isPDF: boolean;
  pdfDocument: PDFDocumentProxy | null;
  imageNaturalWidth: number | null;
  imageNaturalHeight?: number | null;
  fitMode?: 'width' | 'longer-edge';
});
// 기존 코드 호환을 위해 useViewerSetting() 별칭도 제공합니다.

- 반환값 (주요 필드):

```ts
{
  zoomLevel: number;                // 현재 줌(%)
  isSidebarOpen: boolean;           // 향후 사이드바 토글용 (현재는 UI에 노출 X)
  isFitWidth: boolean;              // 지속적인 너비 맞춤 모드 여부
  pdfBaseWidth: number | null;      // PDF 기준 폭 (1x scale 기준)
  viewerContentRef: React.RefObject<HTMLDivElement | null>;

  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  toggleSidebar: () => void;
  toggleFitWidth: () => void;       // isFitWidth 토글 + 자동 재계산
  recomputeFitWidth: () => void;    // isFitWidth가 true일 때, 즉시 재계산
  fitWidthOnce: () => void;         // isFitWidth는 변경하지 않고 한 번만 너비 맞춤
}
```

- 특징:
  - 수동 줌(`handleZoomIn/Out/Reset`)을 호출하면 자동으로 `isFitWidth`를 `false`로 만들어 **자동 너비 맞춤 모드**를 해제합니다.
  - `fitWidthOnce`는 현재 컨테이너 크기의 스냅샷을 기준으로 zoom만 재설정하므로,  
    “한 번만 너비에 맞춰 보고 이후에는 자유롭게 줌을 조절”하는 UX에 적합합니다.

---

## 7. PDFManager 상세

### 7.1. 싱글톤 및 동적 import

```ts
class PDFManager {
  private static instance: PDFManager;
  private static pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

  private constructor() {}

  static getInstance(): PDFManager {
    if (!PDFManager.instance) {
      PDFManager.instance = new PDFManager();
    }
    return PDFManager.instance;
  }

  private async getPdfJs() {
    if (typeof window === 'undefined') {
      throw new Error('PDF.js는 브라우저 환경에서만 사용할 수 있습니다.');
    }

    if (!PDFManager.pdfjsLibPromise) {
      PDFManager.pdfjsLibPromise = import('pdfjs-dist').then((mod) => {
        if (!mod.GlobalWorkerOptions.workerSrc) {
          mod.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
        }
        return mod;
      });
    }

    return PDFManager.pdfjsLibPromise;
  }
}
```

- 서버 렌더링 시 DOM 전역(`DOMMatrix` 등)이 없기 때문에, **정적 import가 아닌 동적 import**를 사용합니다.
- 브라우저 환경에서 최초 호출 시에만 `GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'`를 설정합니다.
- `/public/pdf.worker.mjs`는 `node_modules/pdfjs-dist/build/pdf.worker.mjs`와 **버전을 맞춰야** 합니다.

### 7.2. 문서 로드

```ts
private async loadDocumentInternal(url: string): Promise<PDFDocumentProxy> {
  const pdfjsLib = await this.getPdfJs();
  const loadingTask = pdfjsLib.getDocument({ url });
  return (await loadingTask.promise) as PDFDocumentProxy;
}
```

- 현재는 pdf.js의 기본 설정만 사용하며, wasm/cMap 등 추가 자원은 사용하지 않습니다.
- R2 사인 URL을 그대로 `getDocument`에 전달합니다.

### 7.3. 렌더링

```ts
async renderPage(options: RenderOptions): Promise<void> {
  const { eventId, document, pageNumber, canvas, scale, maxDpr } = options;
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr ?? 2);

  // 캔버스 크기/스타일 설정 후 page.render 호출
}
```

- `renderToCanvas`는 내부에서 오프스크린 캔버스를 생성해 `renderPage`를 호출한 뒤, 완성된 캔버스를 반환합니다.
- ArcDataPDFSidebar 및 PDFCore는 이 메서드를 사용해 실제 페이지 비트를 캔버스로 그립니다.

---

## 8. 렌더링/상호작용 시퀀스 요약

1. ArcWork 탭에서 `ArcData documentId`를 열면 `ArcData`가 마운트됩니다.
2. `useDocumentDownloadUrl(documentId)`로 R2 사인 URL을 발급받습니다.
3. `usePDFLoad(pdfUrl)` → `pdfManager.loadDocument(pdfUrl)`로 PDF 문서를 로드합니다.
4. `usePDFInteraction()` → `visiblePage`, `totalPages`, `viewerRef`, `handleSidebarPageClick` 등을 초기화합니다.
5. `usePDFSetting()` → `zoomLevel`, `isFitWidth`, `viewerContentRef`, `fitWidthOnce` 등을 초기화합니다.
6. `ArcDataPDFTopbar` / `ArcDataPDFSidebar` / `PDFViewer`가 위 상태를 기반으로 렌더링됩니다.
7. 사용자의 스크롤/썸네일 클릭/툴바 버튼 액션에 따라:
   - `visiblePage`가 갱신되고,
   - `zoomLevel` 및 `isFitWidth`가 조정되며,
   - PDFCore가 필요한 페이지 캔버스만 고해상도 렌더링을 유지하도록 가상화합니다.



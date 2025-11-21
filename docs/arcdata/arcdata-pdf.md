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
    - `documentId`로 문서 메타데이터/다운로드 URL 조회
    - 파일 MIME 타입에 따라 **어떤 호스트를 사용할지 결정**
    - PDF인 경우 `ArcDataPDFHost`로 위임

- `hosts/ArcDataPDFHost.tsx`
  - ArcData 전용 **PDF 호스트 컴포넌트**
  - 역할:
    - `useDocumentDownloadUrl(documentId)`로 R2 서명 URL 발급
    - `ArcDataPDFManager(pdfManager)`를 통해 PDF 문서 로드/캐시/해제 관리
    - `usePDFPageController()`로 현재 페이지/총 페이지/페이지 이동 상태 관리
    - 확대/축소/너비 맞춤 상태를 관리하고 `ArcDataPDFTopbar`/`ArcDataPDFViewer`에 전달
    - 상단 툴바 / 좌측 썸네일 / 메인 PDF 뷰어 레이아웃을 조립

- `components/core/ArcDataPDF/layout/ArcDataPDFTopbar.tsx`
  - PDF 상단 툴바
  - 공용 상단 레이아웃 컴포넌트인 `ArcDataTopbar` 위에서 동작하며,
  - **확대/축소/너비 맞춤**을 제어하는 UI를 제공합니다.

- `components/core/ArcDataPDF/layout/ArcDataPDFSidebar.tsx`
  - PDF 썸네일 목록 및 페이지 네비게이션 담당
  - 내부에서 공용 레이아웃 컴포넌트인 `ArcDataSidebar`를 사용해 좌측 사이드바 레이아웃/스크롤 보정을 처리하고,
  - `pdfDocument.getPage()` + `page.render()`를 사용해 각 페이지 썸네일을 렌더링합니다.

- `components/core/ArcDataPDF/ArcDataPDFViewer.tsx`
  - pdf.js의 `PDFViewer`를 감싸는 **메인 PDF 뷰어 래퍼**
  - `usePDFViewerServices()`로 생성한 `EventBus` / `PDFLinkService` / `PDFFindController`와 연동하여
    스크롤/현재 페이지/줌 등을 pdf.js에게 위임합니다.

- `hooks/pdf/usePDFPageController.ts`
  - 현재 페이지, 총 페이지 수, 사이드바 클릭 시 페이지 이동, 스크롤 기반 페이지 감지 등을 관리
  - `ArcDataPDFViewerHandle` ref를 통해 메인 뷰어를 제어합니다.

- `hooks/pdf/usePDFViewController.ts`
  - 줌 레벨, 너비 맞춤, 뷰어 컨테이너 ref를 관리하는 **뷰 설정 컨트롤러 훅**
  - 현재 PDF 호스트에서는 일부 로직을 인라인으로 구현하지만, 공통 패턴은 이 훅에 캡슐화되어 있습니다.

- `hooks/pdf/usePDFViewerServices.ts`
  - pdf.js Viewer 계열 모듈을 동적으로 로드하고,
  - `EventBus` / `PDFLinkService` / `PDFFindController`를 **한 번에 생성/캐시**하는 훅과 로더 함수를 제공합니다.

- `managers/ArcDataPDFManager.ts`
  - pdf.js(`pdfjs-dist`)와 상호작용하는 **싱글톤 매니저**
  - 문서 로드/캐시/렌더링/취소를 담당하며 `pdfManager` 이름으로 사용됩니다.

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

### 2.2. ArcDataPDFHost 내부 렌더링 플로우

1. **다운로드 URL 발급**
   - `useDocumentDownloadUrl(documentId, { inline: true, enabled: true })`
   - 서버는 R2 사인 URL을 만들어 `{ url, expiresAt }`를 반환합니다.
2. **PDF 문서 로드**
   - `pdfManager.loadDocument(pdfUrl)`을 호출하여 pdf.js 문서를 로드하고,
   - 동일 URL에 대해 캐시를 활용해 중복 로드를 방지합니다.
3. **페이지/스크롤 상호작용 관리**
   - `usePDFPageController()`로 현재 페이지, 총 페이지 수, 뷰어 ref, 사이드바 클릭 핸들러를 관리합니다.
4. **뷰어 설정(줌/너비 맞춤) 관리**
   - 현재 구현에서는 `ArcDataPDFHost` 내부에서 줌/너비 맞춤 상태를 관리하며,
   - `viewerRef`(= `ArcDataPDFViewerHandle`)의 `setZoom()` / `getCurrentScale()`를 통해 pdf.js 뷰어와 동기화합니다.
   - 동일 패턴은 `usePDFViewController` 훅으로 일반화되어 있으며, 다른 호스트에서 재사용할 수 있습니다.
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
        <ArcDataPDFViewer
          ref={viewerRef}
          document={pdfDocument}
          className="h-full w-full"
          onPageChange={onVisiblePageChange}
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
- 각 썸네일은 `pdfDocument.getPage(pageNumber)`로 페이지를 가져온 뒤,
  `page.getViewport({ scale: 0.2 })`와 `page.render({ canvasContext, viewport, canvas })`를 사용해
  **저해상도 DPR**로 렌더링합니다.
- `ArcDataPDFSidebar`는 내부에서 공용 레이아웃 컴포넌트인 `ArcDataSidebar`를 사용합니다.
  - `ArcDataSidebar`는 좌측 고정 폭 사이드바와 스크롤 컨테이너를 제공하고,
  - 현재 활성 페이지(`currentPage`)가 바뀔 때 해당 썸네일이 리스트 뷰포트 안에 들어오도록 스크롤을 자동 보정합니다.

---

## 5. PDF 뷰어 코어 (`ArcDataPDFViewer` + `usePDFViewerServices`)

### 5.1. `ArcDataPDFViewerProps`

```ts
export interface ArcDataPDFViewerProps {
  document: PDFDocumentProxy;
  /** 문서를 구분하기 위한 키 (히스토리/이벤트 prefix 등으로 사용 가능) */
  docKey?: string;
  className?: string;
  /** pdf.js 뷰어에서 인식하는 "현재 페이지"가 바뀔 때 호출 */
  onPageChange?: (pageNumber: number) => void;
}
```

- `document`는 pdf.js의 `PDFDocumentProxy`입니다.
- `docKey`는 이벤트/히스토리 prefix 등으로 사용할 수 있는 선택적 식별자입니다.
- `onPageChange`는 pdf.js `EventBus`의 `pagechanging` 이벤트를 통해 전달되는
  현재 페이지 번호를 상위(`ArcDataPDFHost` 등)에 전달합니다.

### 5.2. `ArcDataPDFViewerHandle`

```ts
export interface ArcDataPDFViewerHandle {
  /** 지정한 페이지로 스크롤 이동 */
  scrollToPage: (pageNumber: number) => void;
  /**
   * 줌 설정
   * - number: 퍼센트(100 = 100%)
   * - string: pdf.js 프리셋 값(e.g. 'page-width')
   */
  setZoom: (zoom: ArcDataPdfScaleValue | number) => void;
  /** 현재 numeric 스케일(1.0 = 100%)을 반환 (없으면 null) */
  getCurrentScale: () => number | null;
  /** pdf.js의 currentScaleValue 그대로 반환 (없으면 null) */
  getCurrentScaleValue: () => number | string | null;
}
```

- `ArcDataPDFHost`는 이 핸들을 `usePDFPageController`에서 관리하며,
  - 썸네일 클릭 시 `scrollToPage(pageNumber)`를 호출해 해당 페이지로 이동하고,
  - 확대/축소/너비 맞춤 시 `setZoom()`을 통해 pdf.js 뷰어의 스케일을 제어합니다.
- `getCurrentScale()` / `getCurrentScaleValue()`는 실제 적용된 배율을 읽어와 상단 툴바의
  `zoomLevel` 상태와 동기화하는 데 사용됩니다.

---

## 6. Tailwind 전역 스타일과 pdf.js 레이아웃 이슈

### 6.1. 문제 요약

ArcData는 클라이언트 전역에 Tailwind v4 preflight가 적용되어 있으며, 이때 다음과 같은 규칙이 기본으로 깔립니다.

- `*, ::before, ::after { box-sizing: border-box; border-width: 0; ... }`

pdf.js에서 제공하는 기본 뷰어 스타일(`pdf_viewer.css`)은 **기본 UA 환경(= content-box)** 을 전제로 설계되어 있습니다.  
특히 다음 요소들이 `content-box` 기준으로 크기/좌표를 계산합니다.

- `.pdfViewer .page` — `width: 816px; height: 1056px; border: 9px solid transparent;`
- `.pdfViewer .canvasWrapper` — `width: 100%; height: 100%;`
- `.textLayer` — `position: absolute; inset: 0;`

하지만 Tailwind의 전역 `box-sizing: border-box`가 적용되면:

- `.page`의 `width: 816px` 이 “내용 + border” 전체 너비가 되어, **실제 내용 영역은 798px(= 816 - 9*2)** 로 줄어들고
- `canvasWrapper`는 이 798px 내용 영역만 채우는 반면,
- `textLayer`는 여전히 816px 기준으로 계산되어 **캔버스보다 우측/하단으로 9px씩 더 크게** 렌더링됩니다.

그 결과:

- 시각적으로는 `.textLayer` outline이 `.page`/캔버스보다 약간 우측·하단으로 커지고,
- 텍스트 선택 시에는 **줄이 내려갈수록 선택 하이라이트가 점점 아래로 밀리는** 현상이 발생했습니다.

### 6.2. 해결 전략: pdf 뷰어 서브트리를 content-box 로 되돌리기

문제의 근본 원인은 **“pdf.js가 content-box를 가정해 계산한 값”과 “Tailwind에 의해 border-box로 렌더된 DOM” 사이의 불일치**입니다.  
이를 해결하기 위해 ArcData에서는 **PDF 뷰어 서브트리 내부의 box-sizing을 명시적으로 content-box로 되돌립니다.**

구현 위치:

- 파일: `ArcDataPDFViewer.css`
- 규칙:

```css
.pdfViewer,
.pdfViewer *{
  box-sizing:content-box;
}
```

이렇게 하면:

- `.page`/`.canvasWrapper`/`.textLayer` 등 pdf.js가 생성하는 모든 요소가 **원래 pdf_viewer.css가 전제한 content-box 환경**에서 동작하게 되고,
- Tailwind 전역 `box-sizing: border-box`는 **뷰어 바깥 영역에만 적용**됩니다.

실제 효과:

- `.textLayer` 영역이 `.page`/캔버스와 정확히 일치하고,
- 텍스트 선택 시 **줄이 내려갈수록 하이라이트가 아래로 처지는 오차가 사라짐**을 확인했습니다.

### 6.3. 개발 시 주의사항

- PDF 뷰어 내부 레이아웃이 깨지는 현상을 디버깅할 때는 **먼저 box-sizing을 의심**해야 합니다.
  - DevTools에서 `.pdfViewer .page`, `.canvasWrapper`, `.textLayer`의 `boxSizing`, `clientWidth/clientHeight`, `getBoundingClientRect()`를 비교해보면,
    Tailwind 전역 스타일과 pdf.js 기본 가정이 충돌하는지 쉽게 확인할 수 있습니다.
- pdf.js 뷰어 내부에 새로운 커스텀 요소를 추가할 때도,  
  `.pdfViewer` 서브트리는 `content-box` 기준으로 동작한다는 점을 염두에 두고 레이아웃을 설계해야 합니다.

### 5.3. `usePDFViewerServices` (EventBus / LinkService / FindController)

- 위치: `hooks/pdf/usePDFViewerServices.ts`
- 역할:
  - pdf.js Viewer 모듈(`pdfjs-dist/web/pdf_viewer.mjs`)을 **브라우저 환경에서만 동적 import**하고,
  - `EventBus` / `PDFLinkService` / `PDFFindController`를 **한 번만 생성하여 재사용**할 수 있도록 제공합니다.

요약 시그니처는 다음과 같습니다.

```ts
export interface UsePDFViewerServicesResult {
  eventBus: EventBus | null;
  linkService: PDFLinkService | null;
  findController: PDFFindController | null;
}

export function usePDFViewerServices(): UsePDFViewerServicesResult;

export async function loadPdfJsViewerModule(): Promise<
  typeof import('pdfjs-dist/web/pdf_viewer.mjs')
>;
```

- `ArcDataPDFViewer`는 `usePDFViewerServices()`를 호출해 준비된 `eventBus` / `linkService` / `findController`를 받아
  내부에서 `PDFViewer` 인스턴스를 생성하고, `EventBus`의 `pagechanging` 이벤트를 구독합니다.
- `loadPdfJsViewerModule()`는 동일 프로세스 내에서 한 번만 pdf.js Viewer 모듈을 로드하도록
  `viewerModulePromise`를 캐시합니다.

---

## 6. 뷰 상태 훅 / 컨트롤러

### 6.1. `usePDFPageController`

- 역할:
  - 현재 보이는 페이지(`visiblePage`) 계산
  - 총 페이지 수(`totalPages`) 상태 관리
  - `viewerRef`를 통해 `ArcDataPDFViewerHandle`을 제어
  - 사이드바 클릭 → `scrollToPage`로 스크롤 이동
- 반환값 (요약):

```ts
{
  visiblePage: number;
  totalPages: number;
  viewerRef: React.RefObject<ArcDataPDFViewerHandle | null>;
  setVisiblePage: (page: number) => void;
  setTotalPages: (n: number) => void;
  handleSidebarPageClick: (pageNumber: number) => void;
  onVisiblePageChange: (pageNumber: number) => void;
}
```

- `ArcDataPDFHost`는 이 훅을 통해:
  - 썸네일 사이드바 클릭 시 `handleSidebarPageClick(pageNumber)`를 호출하고,
  - pdf.js 뷰어에서 감지한 페이지 변경 시 `onVisiblePageChange(pageNumber)`를 통해
    상단/사이드바와 현재 페이지를 동기화합니다.

### 6.2. `usePDFViewController` (`usePDFViewController.ts`)

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
usePDFViewController({
  isPDF: boolean;
  pdfDocument: PDFDocumentProxy | null;
  imageNaturalWidth: number | null;
  imageNaturalHeight?: number | null;
  fitMode?: 'width' | 'longer-edge';
});
```

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

### 7.1. 싱글톤 및 동적 import (초기화 개선)
 
 ```ts
 export class ArcDataPDFManager {
   private static instance: ArcDataPDFManager;
   private static pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;
 
   private constructor() {}
 
   static getInstance(): ArcDataPDFManager {
     if (!ArcDataPDFManager.instance) {
       ArcDataPDFManager.instance = new ArcDataPDFManager();
     }
     return ArcDataPDFManager.instance;
   }
 
   /**
    * 브라우저 환경에서만 pdfjs-dist를 동적으로 import하고 초기화합니다.
    * - Worker 설정을 한 곳에서 관리하기 위해 public static으로 노출
    */
   static async initPDFJS(): Promise<typeof import('pdfjs-dist')> {
     if (typeof window === 'undefined') {
       throw new Error('PDF.js는 브라우저 환경에서만 사용할 수 있습니다.');
     }
 
     if (!ArcDataPDFManager.pdfjsLibPromise) {
       ArcDataPDFManager.pdfjsLibPromise = import('pdfjs-dist').then((mod) => {
         // 워커 경로 설정 (JPEG 2000 등 복잡한 이미지 렌더링에 필수)
         if (!mod.GlobalWorkerOptions.workerSrc) {
           const workerSrc = '/pdf.worker.mjs';
           console.log(`[ArcDataPDFManager] Setting workerSrc to ${workerSrc}`);
           mod.GlobalWorkerOptions.workerSrc = workerSrc;
         }
         return mod;
       });
     }
 
     return ArcDataPDFManager.pdfjsLibPromise;
   }
 }
 ```
 
 - **중앙 집중식 초기화:** `initPDFJS()` 정적 메서드를 통해 `pdfjs-dist` 로드와 `GlobalWorkerOptions.workerSrc` 설정을 한 곳에서 처리합니다.
 - **Race Condition 방지:** `usePDFViewerServices` 등 다른 곳에서도 이 메서드를 호출하여 초기화 순서를 보장합니다.
 - **리소스 경로:** `/public/pdf.worker.mjs`를 워커 소스로 사용합니다.
 
 ### 7.2. 문서 로드 및 필수 리소스 설정
 
 ```ts
 async loadDocument(url: string): Promise<PDFDocumentProxy> {
   const pdfjsLib = await ArcDataPDFManager.initPDFJS();
   
   // ArcDataManager를 통해 공통 바이너리 다운로드 경로 사용
   const blob = await arcDataManager.loadBlobFromSource(url, {
     mimeType: 'application/pdf',
   });
   const data = new Uint8Array(await blob.arrayBuffer());
 
   const loadingTask = pdfjsLib.getDocument({
     data,
     cMapUrl: '/cmaps/', // 한글 등 CMap 지원
     cMapPacked: true,
     standardFontDataUrl: '/standard_fonts/', // 표준 폰트 지원
     wasmUrl: '/wasm/', // JPEG 2000 등 디코딩을 위한 WASM 경로
     verbosity: pdfjsLib.VerbosityLevel.INFOS, // 상세 로그 (디버깅용)
   });
   return (await loadingTask.promise) as PDFDocumentProxy;
 }
 ```
 
 - **필수 리소스 설정:** JPEG 2000 이미지(JPXDecode)나 복잡한 폰트 렌더링을 위해 다음 리소스 경로를 명시적으로 설정합니다.
   - `cMapUrl`: `/cmaps/`
   - `standardFontDataUrl`: `/standard_fonts/`
   - `wasmUrl`: `/wasm/` (OpenJPEG WASM 모듈 등)
 - **데이터 로드:** URL을 직접 넘기는 대신 `ArcDataManager`를 통해 Blob을 다운로드하고 `Uint8Array` 형태로 전달하여, 인증 헤더나 커스텀 다운로드 로직을 태울 수 있습니다.

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
- 썸네일/프리뷰 등, 메인 뷰어와는 독립적인 캔버스 렌더링을 위해 사용할 수 있는 유틸리티 메서드입니다.

---

## 8. 렌더링/상호작용 시퀀스 요약

1. ArcWork 탭에서 `ArcData documentId`를 열면 `ArcData`가 마운트됩니다.
2. `useDocumentDownloadUrl(documentId)`로 R2 사인 URL을 발급받습니다.
3. `pdfManager.loadDocument(pdfUrl)`로 PDF 문서를 로드하고, 언마운트 시 `releaseDocument(pdfUrl)`로 캐시를 정리합니다.
4. `usePDFPageController()` → `visiblePage`, `totalPages`, `viewerRef`, `handleSidebarPageClick`, `onVisiblePageChange` 등을 초기화합니다.
5. `ArcDataPDFHost` 내부의 뷰어 설정 상태 → `zoomLevel`, `isFitWidth`, `viewerContentRef` 등을 초기화하고,
   `ArcDataPDFTopbar`/`ArcDataPDFViewer`와 동기화합니다.
6. `ArcDataPDFTopbar` / `ArcDataPDFSidebar` / `ArcDataPDFViewer`가 위 상태를 기반으로 렌더링됩니다.
7. 사용자의 스크롤/썸네일 클릭/툴바 버튼 액션에 따라:
   - `visiblePage`가 갱신되고,
   - `zoomLevel` 및 `isFitWidth`가 조정되며,
   - pdf.js `PDFViewer`가 내부 가상화/렌더링 전략에 따라 필요한 페이지만 고해상도로 유지합니다.



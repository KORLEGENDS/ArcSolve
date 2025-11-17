import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

/**
 * pdf.js PDFViewer에서 사용할 수 있는 스케일 값 타입
 * - 숫자: 배율(1.0 = 100%)
 * - 문자열: pdf.js가 해석하는 프리셋 값(e.g. 'auto', 'page-width', 'page-fit')
 */
export type ArcDataPdfScaleValue = number | 'auto' | 'page-width' | 'page-fit';

export interface ArcDataPDFNewViewerProps {
  document: PDFDocumentProxy;
  /** 문서를 구분하기 위한 키 (히스토리/이벤트 prefix 등으로 사용 가능) */
  docKey?: string;
  className?: string;
  /** pdf.js 뷰어에서 인식하는 "현재 페이지"가 바뀔 때 호출 */
  onPageChange?: (pageNumber: number) => void;
}

export interface ArcDataPDFNewViewerHandle {
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

export interface ArcDataPDFNewInternalContext {
  container: HTMLDivElement | null;
  sidebarContainer: HTMLDivElement | null;
}



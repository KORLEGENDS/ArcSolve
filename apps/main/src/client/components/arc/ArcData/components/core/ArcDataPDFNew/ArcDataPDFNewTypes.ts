import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

export interface ArcDataPDFNewViewerProps {
  document: PDFDocumentProxy;
  /** 문서를 구분하기 위한 키 (히스토리/이벤트 prefix 등으로 사용 가능) */
  docKey?: string;
  className?: string;
  /** pdf.js 뷰어에서 인식하는 "현재 페이지"가 바뀔 때 호출 */
  onPageChange?: (pageNumber: number) => void;
}

export interface ArcDataPDFNewViewerHandle {
  scrollToPage: (pageNumber: number) => void;
  setZoom: (zoomPercent: number) => void;
}

export interface ArcDataPDFNewInternalContext {
  container: HTMLDivElement | null;
  sidebarContainer: HTMLDivElement | null;
}



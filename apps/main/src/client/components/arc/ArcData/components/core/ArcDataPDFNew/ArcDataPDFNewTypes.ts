import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

export interface ArcDataPDFNewViewerProps {
  document: PDFDocumentProxy;
  /** 문서를 구분하기 위한 키 (히스토리/이벤트 prefix 등으로 사용 가능) */
  docKey?: string;
  className?: string;
}

export interface ArcDataPDFNewViewerHandle {
  scrollToPage: (pageNumber: number) => void;
  setZoom: (zoomPercent: number) => void;
}

export interface ArcDataPDFNewInternalContext {
  container: HTMLDivElement | null;
  sidebarContainer: HTMLDivElement | null;
}



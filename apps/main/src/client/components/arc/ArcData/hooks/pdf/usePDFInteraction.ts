/**
 * PDF 상호작용 훅
 * - PDF 페이지 네비게이션 및 상호작용 로직 관리
 * - 사이드바 클릭, 스크롤 감지, 페이지 이동 등
 */

import { useCallback, useRef, useState } from 'react';
import type { ArcDataPDFViewerHandle } from '../../components/core/ArcDataPDF/ArcDataPDFViewer';

interface PDFInteractionState {
  visiblePage: number;
  totalPages: number;
  viewerRef: React.RefObject<ArcDataPDFViewerHandle | null>;
  setVisiblePage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  handleSidebarPageClick: (pageNumber: number) => void;
  onVisiblePageChange: (pageNumber: number) => void;
}

export const usePDFInteraction = (): PDFInteractionState => {
  // 현재 보이는 페이지 상태
  const [visiblePage, setVisiblePage] = useState(1);

  // 총 페이지 수
  const [totalPages, setTotalPages] = useState(1);

  // ArcDataPDFViewer ref (페이지 이동용)
  const viewerRef = useRef<ArcDataPDFViewerHandle | null>(null);

  // 사이드바 페이지 클릭 핸들러
  const handleSidebarPageClick = useCallback((pageNumber: number) => {
    setVisiblePage(pageNumber);
    viewerRef.current?.scrollToPage(pageNumber);
  }, []);

  // ArcDataPDFViewer에서 호출되는 페이지 변경 콜백 (스크롤 감지용)
  const onVisiblePageChange = useCallback((pageNumber: number) => {
    setVisiblePage(pageNumber);
  }, []);

  return {
    visiblePage,
    totalPages,
    viewerRef,
    setVisiblePage,
    setTotalPages,
    handleSidebarPageClick,
    onVisiblePageChange,
  };
};

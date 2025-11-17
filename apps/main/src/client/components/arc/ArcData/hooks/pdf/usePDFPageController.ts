/**
 * PDF 페이지 컨트롤러 훅
 * - 현재 페이지 / 전체 페이지 / 페이지 이동(사이드바 클릭 등)을 관리합니다.
 * - 기존 `usePDFInteraction` 훅을 역할에 맞게 리네이밍한 구현입니다.
 */

import { useCallback, useRef, useState } from 'react';
import type { ArcDataPDFNewViewerHandle } from '../../components/core/ArcDataPDFNew/ArcDataPDFNewTypes';

interface PDFPageControllerState {
  visiblePage: number;
  totalPages: number;
  viewerRef: React.RefObject<ArcDataPDFNewViewerHandle | null>;
  setVisiblePage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  handleSidebarPageClick: (pageNumber: number) => void;
  /** pdf.js 뷰어에서 감지한 현재 페이지 변경 콜백 */
  onVisiblePageChange: (pageNumber: number) => void;
}

export const usePDFPageController = (): PDFPageControllerState => {
  // 현재 보이는 페이지 상태
  const [visiblePage, setVisiblePage] = useState(1);

  // 총 페이지 수
  const [totalPages, setTotalPages] = useState(1);

  // ArcDataPDFNewViewer ref (페이지 이동용)
  const viewerRef = useRef<ArcDataPDFNewViewerHandle | null>(null);

  // 사이드바 페이지 클릭 핸들러
  const handleSidebarPageClick = useCallback((pageNumber: number) => {
    setVisiblePage(pageNumber);
    viewerRef.current?.scrollToPage(pageNumber);
  }, []);

  // pdf.js 뷰어에서 호출되는 페이지 변경 콜백 (스크롤 감지용)
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



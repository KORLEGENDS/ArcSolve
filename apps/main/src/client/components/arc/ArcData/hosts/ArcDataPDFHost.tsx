'use client';

import * as React from 'react';

import { useDocumentDownloadUrl } from '@/client/states/queries/document/useDocument';

import { ArcDataPDFSidebar } from '../components/core/ArcDataPDF/ArcDataPDFSidebar';
import { ArcDataPDFTopbar } from '../components/core/ArcDataPDF/ArcDataPDFTopbar';
import ArcDataPDFNewViewer from '../components/core/ArcDataPDFNew/ArcDataPDFNewViewer';
import { usePDFInteraction } from '../hooks/pdf/usePDFInteraction';
import { usePDFLoad } from '../hooks/pdf/usePDFLoad';
import { ZOOM_LEVELS, usePDFSetting } from '../hooks/pdf/usePDFSetting';

export interface ArcDataPDFHostProps {
  /** ArcWork 탭 메타데이터에서 넘어오는 문서 ID (document.documentId) */
  documentId: string;
}

/**
 * ArcData 전용 PDF 호스트
 * - documentId 기준으로 파일 다운로드 URL을 조회하고
 * - PDF를 로드한 뒤, Topbar + Sidebar + 메인 ArcDataPDFViewer 레이아웃으로 렌더링합니다.
 * - ArcData 엔트리 컴포넌트에서는 어떤 호스트를 사용할지만 결정하고,
 *   실제 PDF 뷰어/상태 관리는 이 컴포넌트에서 담당합니다.
 */
export function ArcDataPDFHost({
  documentId,
}: ArcDataPDFHostProps): React.ReactElement | null {
  // 1) 문서 다운로드 URL 발급 (R2 서명 URL)
  const {
    data: download,
    isLoading: isDownloadLoading,
    error: downloadError,
  } = useDocumentDownloadUrl(documentId, {
    inline: true,
    enabled: true,
  });

  const pdfUrl = download?.url ?? null;

  // 2) PDF 문서 로드
  const {
    document: pdfDocument,
    isLoading: isPdfLoading,
    error: pdfError,
  } = usePDFLoad(pdfUrl ?? null);

  // 3) 페이지/뷰어 상호작용 상태 (현재 페이지, 총 페이지, 스크롤 이동 등)
  const {
    visiblePage,
    totalPages,
    viewerRef,
    setTotalPages,
    handleSidebarPageClick,
  } = usePDFInteraction();

  // 문서 로드 완료 후 총 페이지 수 동기화
  React.useEffect(() => {
    if (!pdfDocument) return;
    setTotalPages(pdfDocument.numPages);
  }, [pdfDocument, setTotalPages]);

  // 4) 뷰어 크기/줌 상태 (확대/축소/너비 맞춤)
  const {
    zoomLevel,
    isFitWidth,
    viewerContentRef,
    handleZoomIn,
    handleZoomOut,
    fitWidthOnce,
    toggleFitWidth,
  } = usePDFSetting({
    isPDF: true,
    pdfDocument,
    imageNaturalWidth: null,
    imageNaturalHeight: null,
    fitMode: 'width',
  });

  // 줌 레벨 변경 시 새 뷰어에 반영
  React.useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.setZoom(zoomLevel);
  }, [zoomLevel, viewerRef]);

  // 에러는 조용히 실패 (MVP에서는 렌더 생략)
  if (downloadError || pdfError) {
    return null;
  }

  const isReady =
    !!pdfUrl && !!pdfDocument && !isDownloadLoading && !isPdfLoading;
  if (!isReady) {
    return null;
  }

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
        {/* 좌측: 기존 ArcData 썸네일 사이드바 (pdf.js 코어와 독립된 썸네일 렌더링) */}
        <ArcDataPDFSidebar
          currentPage={visiblePage}
          totalPages={totalPages}
          pdfDocument={pdfDocument}
          onPageChange={handleSidebarPageClick}
        />

        {/* 우측: 메인 PDF 뷰어 (pdf.js Viewer 기반) */}
        <div ref={viewerContentRef} className="flex h-full min-w-0 flex-1">
          <ArcDataPDFNewViewer
            ref={viewerRef}
            document={pdfDocument}
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}

export default ArcDataPDFHost;



'use client';

import * as React from 'react';

import { useDocumentDownloadUrl } from '@/client/states/queries/document/useDocument';

import { ArcDataSidebar } from './components/base/ArcDataSidebar';
import { ArcDataTopbar } from './components/base/ArcDataTopbar';
import { PDFViewer } from './components/core/ArcDataPDF';
import { usePDFInteraction } from './hooks/pdf/usePDFInteraction';
import { usePDFLoad } from './hooks/pdf/usePDFLoad';
import { ZOOM_LEVELS, useViewerSetting } from './hooks/pdf/usePDFSetting';

export interface ArcDataProps {
  /** ArcWork 탭 메타데이터에서 넘어오는 문서 ID (document.documentId) */
  documentId: string;
}

/**
 * ArcData MVP
 * - documentId 기준으로 파일 다운로드 URL을 조회하고
 * - PDF로 로드한 뒤, 사이드바 썸네일 + 메인 뷰어로만 렌더링
 * - 오버레이/줌/Topbar/Bottombar 등은 추후 확장
 */
export function ArcData({ documentId }: ArcDataProps): React.ReactElement | null {
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
    onVisiblePageChange,
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
  } = useViewerSetting({
    isPDF: true,
    pdfDocument,
    imageNaturalWidth: null,
    imageNaturalHeight: null,
    fitMode: 'width',
  });

  // 에러는 로그만 남기고 렌더는 생략 (MVP에서는 조용히 실패)
  if (downloadError || pdfError) {
    // eslint-disable-next-line no-console
    console.error('[ArcData] PDF load error', {
      documentId,
      pdfUrl,
      isDownloadLoading,
      isPdfLoading,
      downloadRaw: download,
      downloadError:
        downloadError instanceof Error
          ? {
              name: downloadError.name,
              message: downloadError.message,
              stack: downloadError.stack,
            }
          : downloadError,
      pdfError:
        pdfError instanceof Error
          ? {
              name: pdfError.name,
              message: pdfError.message,
              stack: pdfError.stack,
            }
          : pdfError,
    });
    return null;
  }

  const isReady =
    !!pdfUrl &&
    !!pdfDocument &&
    !isDownloadLoading &&
    !isPdfLoading;
  if (!isReady) {
    return null;
  }

  return (
    <div className="flex h-full w-full flex-col">
      <ArcDataTopbar
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
        {/* 좌측: PDF 썸네일 사이드바 (고정 폭) */}
        <ArcDataSidebar
          currentPage={visiblePage}
          totalPages={totalPages}
          pdfDocument={pdfDocument}
          onPageChange={handleSidebarPageClick}
        />

        {/* 우측: 메인 PDF 뷰어 (남은 영역 전체 차지) */}
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
}

export default ArcData;
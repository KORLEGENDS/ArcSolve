'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import * as React from 'react';

import { useDocumentDownloadUrl } from '@/client/states/queries/document/useDocument';

import ArcDataPDFNewViewer from '../components/core/ArcDataPDF/ArcDataPDFNewViewer';
import { ArcDataPDFSidebar } from '../components/core/ArcDataPDF/ArcDataPDFSidebar';
import { ArcDataPDFTopbar } from '../components/core/ArcDataPDF/ArcDataPDFTopbar';
import { usePDFPageController } from '../hooks/pdf/usePDFPageController';
import { pdfManager } from '../managers/ArcDataPDFManager';

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

  // 2) PDF 문서 로드 (ArcDataPDFManager를 통해 로드/캐시 위임)
  const [pdfDocument, setPdfDocument] = React.useState<PDFDocumentProxy | null>(null);
  const [isPdfLoading, setIsPdfLoading] = React.useState<boolean>(false);
  const [pdfError, setPdfError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!pdfUrl) {
      setPdfDocument(null);
      setIsPdfLoading(false);
      setPdfError(null);
      return;
    }

    let cancelled = false;

    setIsPdfLoading(true);
    setPdfError(null);

    const loadDocument = async (): Promise<void> => {
      try {
        const doc = await pdfManager.loadDocument(pdfUrl);
        if (cancelled) return;
        setPdfDocument(doc);
        setIsPdfLoading(false);
      } catch (error) {
        if (cancelled) return;
        setPdfDocument(null);
        setIsPdfLoading(false);
        setPdfError(error instanceof Error ? error : new Error('PDF 로드 실패'));
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
      pdfManager.releaseDocument(pdfUrl);
    };
  }, [pdfUrl]);

  // 3) 페이지/뷰어 상호작용 상태 (현재 페이지, 총 페이지, 스크롤 이동 등)
  const {
    visiblePage,
    totalPages,
    viewerRef,
    setTotalPages,
    handleSidebarPageClick,
    onVisiblePageChange,
  } = usePDFPageController();

  // 문서 로드 완료 후 총 페이지 수 동기화
  React.useEffect(() => {
    if (!pdfDocument) return;
    setTotalPages(pdfDocument.numPages);
  }, [pdfDocument, setTotalPages]);

  // 4) 뷰어 줌/너비 맞춤 상태 (모든 실제 계산은 pdf.js API에 위임)
  const ZOOM_LEVELS = React.useMemo(
    () => ({
      MIN: 25,
      MAX: 500,
      DEFAULT: 100,
      STEP: 25,
    }),
    [],
  );

  const [zoomLevel, setZoomLevel] = React.useState<number>(ZOOM_LEVELS.DEFAULT);
  const [isFitWidth, setIsFitWidth] = React.useState<boolean>(false);
  const viewerContentRef = React.useRef<HTMLDivElement | null>(null);

  const syncZoomFromViewer = React.useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const scale = viewer.getCurrentScale?.();
    if (typeof scale === 'number' && !Number.isNaN(scale)) {
      setZoomLevel(Math.round(scale * 100));
    }
  }, [viewerRef]);

  const handleZoomIn = React.useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    setIsFitWidth(false);
    setZoomLevel((prev) => {
      const next = Math.min(prev + ZOOM_LEVELS.STEP, ZOOM_LEVELS.MAX);
      viewer.setZoom(next);
      return next;
    });

    // 실제 적용된 배율은 pdf.js가 최종 결정하므로 동기화
    syncZoomFromViewer();
  }, [ZOOM_LEVELS.MAX, ZOOM_LEVELS.STEP, syncZoomFromViewer, viewerRef]);

  const handleZoomOut = React.useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    setIsFitWidth(false);
    setZoomLevel((prev) => {
      const next = Math.max(prev - ZOOM_LEVELS.STEP, ZOOM_LEVELS.MIN);
      viewer.setZoom(next);
      return next;
    });

    syncZoomFromViewer();
  }, [ZOOM_LEVELS.MIN, ZOOM_LEVELS.STEP, syncZoomFromViewer, viewerRef]);

  const handleFitWidthOnce = React.useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // pdf.js의 'page-width' 프리셋을 그대로 사용 (커스텀 계산 없음)
    viewer.setZoom('page-width');
    setIsFitWidth(false);
    syncZoomFromViewer();
  }, [syncZoomFromViewer, viewerRef]);

  const handleFitWidthToggle = React.useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    setIsFitWidth((prev) => {
      const next = !prev;
      if (next) {
        // 모드 ON: pdf.js 'page-width' 모드 위임
        viewer.setZoom('page-width');
      } else {
        // 모드 OFF: 기본 100%로 복귀 (필요 시 향후 최근 배율 복원 방식으로 확장 가능)
        viewer.setZoom(ZOOM_LEVELS.DEFAULT);
      }
      syncZoomFromViewer();
      return next;
    });
  }, [ZOOM_LEVELS.DEFAULT, syncZoomFromViewer, viewerRef]);

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
        onFitWidthOnce={handleFitWidthOnce}
        onFitWidthToggle={handleFitWidthToggle}
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
            onPageChange={onVisiblePageChange}
          />
        </div>
      </div>
    </div>
  );
}

export default ArcDataPDFHost;



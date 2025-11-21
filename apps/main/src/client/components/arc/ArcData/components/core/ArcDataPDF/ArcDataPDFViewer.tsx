'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import type { PDFViewer, PDFViewerOptions } from 'pdfjs-dist/types/web/pdf_viewer';
import * as React from 'react';
import { loadPdfJsViewerModule, usePDFViewerServices } from '../../../hooks/pdf/usePDFViewerServices';
import type { ArcDataPDFViewerHandle, ArcDataPDFViewerProps, ArcDataPdfScaleValue } from './ArcDataPDFTypes';

import './ArcDataPDFViewer.css';

export const ArcDataPDFViewer = React.forwardRef<ArcDataPDFViewerHandle, ArcDataPDFViewerProps>(
  ({ document, docKey, className, onPageChange }, ref) => {
    const { eventBus, linkService, findController } = usePDFViewerServices();

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const viewerElementRef = React.useRef<HTMLDivElement | null>(null);
    const viewerRef = React.useRef<PDFViewer | null>(null);

    // pdf.js PDFViewer 인스턴스 생성 및 문서 바인딩
    React.useEffect(() => {
      let cancelled = false;

      const ensureViewer = async (): Promise<void> => {
        if (!containerRef.current || !viewerElementRef.current) return;
        if (!eventBus || !linkService) return;

        if (!viewerRef.current) {
          const pdfjsViewer = await loadPdfJsViewerModule();
          if (cancelled) return;

          const ViewerCtor = (pdfjsViewer as unknown as {
            PDFViewer: new (options: PDFViewerOptions) => PDFViewer;
          }).PDFViewer;

          const instance = new ViewerCtor({
            container: containerRef.current,
            viewer: viewerElementRef.current,
            eventBus,
            linkService,
            findController: findController ?? undefined,
            enableAutoLinking: false,
          });

          console.log('[ArcDataPDF] PDFViewer initialized', instance);

          viewerRef.current = instance;
          linkService.setViewer?.(instance);
        }

        const viewer = viewerRef.current;
        if (!viewer) return;

        // 문서 바인딩만 위임 (초기 스케일/페이지/링크 주입 등은 모두 pdf.js 기본 동작 사용)
        console.log('[ArcDataPDF] Binding document to viewer', document);
        try {
          viewer.setDocument?.(document);
          linkService.setDocument?.(document, null);
        } catch (e) {
          console.error('[ArcDataPDF] Error binding document:', e);
        }
      };

      void ensureViewer();

      return () => {
        cancelled = true;
        // 구독 및 문서 정리는 viewer가 초기화된 이후에만 수행
        if (eventBus && viewerRef.current) {
          // NOTE: 현재 pdf.js EventBus는 off 시 동일 레퍼런스가 필요하지만,
          // ArcData에서는 on/off를 반복적으로 호출하지 않으므로 noop 핸들러를 전달합니다.
          viewerRef.current.setDocument?.(null as unknown as PDFDocumentProxy);
        }
      };
    }, [document, eventBus, linkService, findController]);

    // pdf.js EventBus로부터 현재 페이지 변경 이벤트를 받아 상위로 전달
    React.useEffect(() => {
      if (!eventBus || !onPageChange) return;
      const handler = (evt: { pageNumber: number }): void => {
        onPageChange(evt.pageNumber);
      };
      eventBus.on('pagechanging', handler);
      return () => {
        eventBus.off('pagechanging', handler);
      };
    }, [eventBus, onPageChange]);

    // [DEBUG] 렌더링 상태 및 에러 모니터링 로그
    React.useEffect(() => {
      if (!eventBus) return;

      const onPagesInit = () => console.log('[ArcDataPDF] Event: pagesinit');
      const onPagesLoaded = () => console.log('[ArcDataPDF] Event: pagesloaded');
      const onPageRendered = (evt: any) => console.log('[ArcDataPDF] Event: pagerendered', evt);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onError = (evt: any) => console.error('[ArcDataPDF] Event: error', evt);

      eventBus.on('pagesinit', onPagesInit);
      eventBus.on('pagesloaded', onPagesLoaded);
      eventBus.on('pagerendered', onPageRendered);
      eventBus.on('error', onError);

      return () => {
        eventBus.off('pagesinit', onPagesInit);
        eventBus.off('pagesloaded', onPagesLoaded);
        eventBus.off('pagerendered', onPageRendered);
        eventBus.off('error', onError);
      };
    }, [eventBus]);

    React.useImperativeHandle(
      ref,
      () => ({
        scrollToPage: (pageNumber: number) => {
          if (!viewerRef.current) return;
          viewerRef.current.currentPageNumber = pageNumber;
        },
        setZoom: (zoom: ArcDataPdfScaleValue | number) => {
          if (!viewerRef.current) return;

          // 문자열 값은 pdf.js 프리셋(e.g. 'page-width') 그대로 위임
          if (typeof zoom === 'string') {
            // pdf.js PDFViewer.currentScaleValue는 number | string 을 허용
            (viewerRef.current as unknown as { currentScaleValue: string }).currentScaleValue = zoom;
            return;
          }

          // 숫자는 퍼센트(100 = 100%)로 간주하여 1.0 스케일로 변환
          const scale = zoom / 100;
          (viewerRef.current as unknown as { currentScaleValue: number }).currentScaleValue = scale;
        },
        getCurrentScale: () => {
          if (!viewerRef.current) return null;
          const v = (viewerRef.current as unknown as { currentScale?: number }).currentScale;
          return typeof v === 'number' && !Number.isNaN(v) ? v : null;
        },
        getCurrentScaleValue: () => {
          if (!viewerRef.current) return null;
          const v = (viewerRef.current as unknown as { currentScaleValue?: number | string }).currentScaleValue;
          return typeof v === 'number' || typeof v === 'string' ? v : null;
        },
      }),
      [],
    );

    return (
      <div className={className} data-doc-key={docKey}>
        <div className="flex h-full w-full">
          <div className="flex-1 overflow-hidden">
            <div
              className="h-full w-full"
              data-role="pdfjs-viewer-root"
              style={{ position: 'relative' }}
            >
              <div
                ref={containerRef}
                data-role="pdfjs-viewer-container"
                className="h-full w-full overflow-auto"
                style={{ position: 'absolute', inset: 0 }}
              >
                <div
                  ref={viewerElementRef}
                  data-role="pdfjs-viewer-inner"
                  className="pdfViewer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

ArcDataPDFViewer.displayName = 'ArcDataPDFViewer';

export default ArcDataPDFViewer;



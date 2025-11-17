'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import type { PDFFindController } from 'pdfjs-dist/types/web/pdf_find_controller';
import type { PDFLinkService } from 'pdfjs-dist/types/web/pdf_link_service';
import type { EventBus, PDFViewer, PDFViewerOptions } from 'pdfjs-dist/types/web/pdf_viewer';
import * as React from 'react';
import type { ArcDataPDFNewViewerHandle } from './ArcDataPDFNewTypes';
import { loadPdfJsViewerModule } from './pdfjsViewerLoader';

export interface ArcDataPDFNewViewerCoreProps {
  document: PDFDocumentProxy;
  className?: string;
  eventBus: EventBus | null;
  linkService: PDFLinkService | null;
  findController: PDFFindController | null;
  onPageChange?: (pageNumber: number) => void;
}

export const ArcDataPDFNewViewerCore = React.forwardRef<ArcDataPDFNewViewerHandle, ArcDataPDFNewViewerCoreProps>(
  ({ document, className, eventBus, linkService, findController, onPageChange }, ref) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const viewerElementRef = React.useRef<HTMLDivElement | null>(null);
    const viewerRef = React.useRef<PDFViewer | null>(null);

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

          viewerRef.current = instance;
          linkService.setViewer?.(instance);
        }

        const viewer = viewerRef.current;
        if (!viewer) return;

        // 문서 바인딩만 위임 (초기 스케일/페이지/링크 주입 등은 모두 pdf.js 기본 동작 사용)
        viewer.setDocument?.(document);
        linkService.setDocument?.(document, null);
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

    React.useImperativeHandle(
      ref,
      () => ({
        scrollToPage: (pageNumber: number) => {
          if (!viewerRef.current) return;
          viewerRef.current.currentPageNumber = pageNumber;
        },
        setZoom: (zoomPercent: number) => {
          if (!viewerRef.current) return;
          const scale = zoomPercent / 100;
          if (typeof viewerRef.current.currentScaleValue !== 'undefined') {
            viewerRef.current.currentScaleValue = String(scale);
          }
        },
      }),
      [],
    );

    return (
      <div className={className} data-role="pdfjs-viewer-root">
        <div
          ref={containerRef}
          data-role="pdfjs-viewer-container"
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'auto',
          }}
        >
          <div
            ref={viewerElementRef}
            data-role="pdfjs-viewer-inner"
            className="pdfViewer"
          />
        </div>
      </div>
    );
  },
);

ArcDataPDFNewViewerCore.displayName = 'ArcDataPDFNewViewerCore';

export default ArcDataPDFNewViewerCore;



'use client';

import type { PDFFindController } from 'pdfjs-dist/types/web/pdf_find_controller';
import type { PDFLinkService } from 'pdfjs-dist/types/web/pdf_link_service';
import type { EventBus } from 'pdfjs-dist/types/web/pdf_viewer';
import * as React from 'react';
import { ArcDataPDFEventBus } from './ArcDataPDFEventBus';
import { ArcDataPDFFindController } from './ArcDataPDFFindController';
import { ArcDataPDFLinkService } from './ArcDataPDFLinkService';
import type { ArcDataPDFViewerHandle, ArcDataPDFViewerProps, ArcDataPdfScaleValue } from './ArcDataPDFTypes';
import { ArcDataPDFViewerCore } from './ArcDataPDFViewerCore';

import './ArcDataPDFViewer.css';

export const ArcDataPDFViewer = React.forwardRef<ArcDataPDFViewerHandle, ArcDataPDFViewerProps>(
  ({ document, docKey, className, onPageChange }, ref) => {
    const [eventBus, setEventBus] = React.useState<EventBus | null>(null);
    const [linkService, setLinkService] = React.useState<PDFLinkService | null>(null);
    const [findController, setFindController] = React.useState<PDFFindController | null>(null);

    const coreRef = React.useRef<ArcDataPDFViewerHandle | null>(null);

    React.useImperativeHandle(
      ref,
      () => ({
        scrollToPage: (pageNumber: number) => {
          coreRef.current?.scrollToPage(pageNumber);
        },
        setZoom: (zoom: ArcDataPdfScaleValue | number) => {
          coreRef.current?.setZoom(zoom);
        },
        getCurrentScale: () => {
          return coreRef.current?.getCurrentScale() ?? null;
        },
        getCurrentScaleValue: () => {
          return coreRef.current?.getCurrentScaleValue() ?? null;
        },
      }),
      [],
    );

    return (
      <div className={className} data-doc-key={docKey}>
        <ArcDataPDFEventBus onReady={setEventBus} />
        <ArcDataPDFLinkService eventBus={eventBus} onReady={setLinkService} />
        <ArcDataPDFFindController eventBus={eventBus} linkService={linkService} onReady={setFindController} />

        <div className="flex h-full w-full">
          <div className="flex-1 overflow-hidden">
            <ArcDataPDFViewerCore
              ref={coreRef}
              document={document}
              eventBus={eventBus}
              linkService={linkService}
              findController={findController}
              className="h-full w-full"
              onPageChange={onPageChange}
            />
          </div>
        </div>
      </div>
    );
  },
);

ArcDataPDFViewer.displayName = 'ArcDataPDFViewer';

export default ArcDataPDFViewer;



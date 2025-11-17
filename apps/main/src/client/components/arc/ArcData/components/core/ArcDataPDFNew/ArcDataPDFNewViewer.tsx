'use client';

import type { PDFFindController } from 'pdfjs-dist/types/web/pdf_find_controller';
import type { PDFLinkService } from 'pdfjs-dist/types/web/pdf_link_service';
import type { EventBus } from 'pdfjs-dist/types/web/pdf_viewer';
import * as React from 'react';
import { ArcDataPDFNewEventBus } from './ArcDataPDFNewEventBus';
import { ArcDataPDFNewFindController } from './ArcDataPDFNewFindController';
import { ArcDataPDFNewLinkService } from './ArcDataPDFNewLinkService';
import type { ArcDataPDFNewViewerHandle, ArcDataPDFNewViewerProps } from './ArcDataPDFNewTypes';
import { ArcDataPDFNewViewerCore } from './ArcDataPDFNewViewerCore';

import './ArcDataPDFNewViewer.css';

export const ArcDataPDFNewViewer = React.forwardRef<ArcDataPDFNewViewerHandle, ArcDataPDFNewViewerProps>(
  ({ document, docKey, className, onPageChange }, ref) => {
    const [eventBus, setEventBus] = React.useState<EventBus | null>(null);
    const [linkService, setLinkService] = React.useState<PDFLinkService | null>(null);
    const [findController, setFindController] = React.useState<PDFFindController | null>(null);

    const coreRef = React.useRef<ArcDataPDFNewViewerHandle | null>(null);

    React.useImperativeHandle(
      ref,
      () => ({
        scrollToPage: (pageNumber: number) => {
          coreRef.current?.scrollToPage(pageNumber);
        },
        setZoom: (zoomPercent: number) => {
          coreRef.current?.setZoom(zoomPercent);
        },
      }),
      [],
    );

    return (
      <div className={className} data-doc-key={docKey}>
        <ArcDataPDFNewEventBus onReady={setEventBus} />
        <ArcDataPDFNewLinkService eventBus={eventBus} onReady={setLinkService} />
        <ArcDataPDFNewFindController eventBus={eventBus} linkService={linkService} onReady={setFindController} />

        <div className="flex h-full w-full">
          <div className="flex-1 overflow-hidden">
            <ArcDataPDFNewViewerCore
              ref={coreRef}
              document={document}
              eventBus={eventBus}
              linkService={linkService}
              findController={findController}
              className="h-full w-full overflow-auto"
              onPageChange={onPageChange}
            />
          </div>
        </div>
      </div>
    );
  },
);

ArcDataPDFNewViewer.displayName = 'ArcDataPDFNewViewer';

export default ArcDataPDFNewViewer;



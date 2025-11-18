'use client';

import type { PDFLinkService } from 'pdfjs-dist/types/web/pdf_link_service';
import type { EventBus } from 'pdfjs-dist/types/web/pdf_viewer';
import * as React from 'react';
import { loadPdfJsViewerModule } from './pdfjsViewerLoader';

export interface ArcDataPDFLinkServiceProps {
  eventBus: EventBus | null;
  onReady: (linkService: PDFLinkService) => void;
}

export function ArcDataPDFLinkService({
  eventBus,
  onReady,
}: ArcDataPDFLinkServiceProps): React.ReactElement | null {
  const linkServiceRef = React.useRef<PDFLinkService | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const ensureLinkService = async (): Promise<void> => {
      if (!eventBus || linkServiceRef.current) return;
      const pdfjsViewer = await loadPdfJsViewerModule();
      if (cancelled) return;

      const LinkServiceCtor = (pdfjsViewer as unknown as {
        PDFLinkService: new (options: { eventBus: EventBus }) => PDFLinkService;
      }).PDFLinkService;

      linkServiceRef.current = new LinkServiceCtor({ eventBus });
      onReady(linkServiceRef.current);
    };

    void ensureLinkService();

    return () => {
      cancelled = true;
    };
  }, [eventBus, onReady]);

  return null;
}

ArcDataPDFLinkService.displayName = 'ArcDataPDFLinkService';

export default ArcDataPDFLinkService;





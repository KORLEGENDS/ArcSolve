'use client';

import type { PDFFindController, PDFFindControllerOptions } from 'pdfjs-dist/types/web/pdf_find_controller';
import type { PDFLinkService } from 'pdfjs-dist/types/web/pdf_link_service';
import type { EventBus } from 'pdfjs-dist/types/web/pdf_viewer';
import * as React from 'react';
import { loadPdfJsViewerModule } from './pdfjsViewerLoader';

export interface ArcDataPDFFindControllerProps {
  eventBus: EventBus | null;
  linkService: PDFLinkService | null;
  onReady: (findController: PDFFindController) => void;
}

export function ArcDataPDFFindController({
  eventBus,
  linkService,
  onReady,
}: ArcDataPDFFindControllerProps): React.ReactElement | null {
  const findControllerRef = React.useRef<PDFFindController | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const ensureFindController = async (): Promise<void> => {
      if (!eventBus || !linkService || findControllerRef.current) return;

      const pdfjsViewer = await loadPdfJsViewerModule();
      if (cancelled) return;

      const FindControllerCtor = (pdfjsViewer as unknown as {
        PDFFindController: new (options: PDFFindControllerOptions) => PDFFindController;
      }).PDFFindController;

      findControllerRef.current = new FindControllerCtor({ eventBus, linkService });
      const instance = findControllerRef.current;
      if (!instance) return;
      onReady(instance);
    };

    void ensureFindController();

    return () => {
      cancelled = true;
    };
  }, [eventBus, linkService, onReady]);

  return null;
}

ArcDataPDFFindController.displayName = 'ArcDataPDFFindController';

export default ArcDataPDFFindController;





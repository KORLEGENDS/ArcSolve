'use client';

import type { EventBus } from 'pdfjs-dist/types/web/pdf_viewer';
import * as React from 'react';
import { loadPdfJsViewerModule } from './pdfjsViewerLoader';

export interface ArcDataPDFEventBusProps {
  onReady: (eventBus: EventBus) => void;
}

export function ArcDataPDFEventBus({ onReady }: ArcDataPDFEventBusProps): React.ReactElement | null {
  const eventBusRef = React.useRef<EventBus | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const ensureEventBus = async (): Promise<void> => {
      if (eventBusRef.current) return;
      const pdfjsViewer = await loadPdfJsViewerModule();
      if (cancelled) return;
      const EventBusCtor = (pdfjsViewer as unknown as { EventBus: new () => EventBus }).EventBus;
      eventBusRef.current = new EventBusCtor();
      onReady(eventBusRef.current);
    };

    void ensureEventBus();

    return () => {
      cancelled = true;
    };
  }, [onReady]);

  return null;
}

ArcDataPDFEventBus.displayName = 'ArcDataPDFEventBus';

export default ArcDataPDFEventBus;






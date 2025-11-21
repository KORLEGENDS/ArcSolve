import type { PDFFindController, PDFFindControllerOptions } from 'pdfjs-dist/types/web/pdf_find_controller';
import type { PDFLinkService } from 'pdfjs-dist/types/web/pdf_link_service';
import type { EventBus } from 'pdfjs-dist/types/web/pdf_viewer';
import * as React from 'react';

/**
 * pdf.js Viewer 계열 모듈 로더
 * - 브라우저 환경에서만 동적 import 수행
 * - 먼저 코어(pdfjs-dist)를 로드하여 globalThis.pdfjsLib를 세팅한 뒤
 *   web/pdf_viewer.mjs에서 Viewer/EventBus 등을 가져옵니다.
 */
let viewerModulePromise: Promise<typeof import('pdfjs-dist/web/pdf_viewer.mjs')> | null = null;

import { ArcDataPDFManager } from '../../managers/ArcDataPDFManager';

export async function loadPdfJsViewerModule(): Promise<typeof import('pdfjs-dist/web/pdf_viewer.mjs')> {
  if (viewerModulePromise) return viewerModulePromise;

  viewerModulePromise = (async () => {
    if (typeof window === 'undefined') {
      throw new Error('PDF.js Viewer는 브라우저 환경에서만 사용할 수 있습니다.');
    }

    // 1) 코어 모듈 로드 및 초기화 (ArcDataPDFManager를 통해 중앙 관리)
    const pdfjsLib = await ArcDataPDFManager.initPDFJS();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).pdfjsLib = pdfjsLib;

    // 2) Viewer 모듈 로드 (EventBus, PDFViewer 등)
    const pdfjsViewer = await import('pdfjs-dist/web/pdf_viewer.mjs');
    return pdfjsViewer;
  })();

  return viewerModulePromise;
}

export interface UsePDFViewerServicesResult {
  eventBus: EventBus | null;
  linkService: PDFLinkService | null;
  findController: PDFFindController | null;
}

/**
 * pdf.js Viewer 계열 서비스(EventBus, LinkService, FindController)를
 * 한 번에 생성/초기화해 React 상태로 노출하는 훅
 *
 * - 브라우저 환경에서만 동작 (내부에서 동적 import 사용)
 * - 동일 컴포넌트 수명 동안에는 인스턴스를 재사용
 */
export function usePDFViewerServices(): UsePDFViewerServicesResult {
  const eventBusRef = React.useRef<EventBus | null>(null);
  const linkServiceRef = React.useRef<PDFLinkService | null>(null);
  const findControllerRef = React.useRef<PDFFindController | null>(null);

  const [eventBus, setEventBus] = React.useState<EventBus | null>(null);
  const [linkService, setLinkService] = React.useState<PDFLinkService | null>(null);
  const [findController, setFindController] = React.useState<PDFFindController | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const ensureServices = async (): Promise<void> => {
      // 이미 모두 준비된 경우, 다시 생성하지 않음
      if (eventBusRef.current && linkServiceRef.current && findControllerRef.current) {
        setEventBus(eventBusRef.current);
        setLinkService(linkServiceRef.current);
        setFindController(findControllerRef.current);
        return;
      }

      const pdfjsViewer = await loadPdfJsViewerModule();
      if (cancelled) return;

      const { EventBus: EventBusCtor } = pdfjsViewer as unknown as { EventBus: new () => EventBus };
      const { PDFLinkService: LinkServiceCtor } = pdfjsViewer as unknown as {
        PDFLinkService: new (options: { eventBus: EventBus }) => PDFLinkService;
      };
      const { PDFFindController: FindControllerCtor } = pdfjsViewer as unknown as {
        PDFFindController: new (options: PDFFindControllerOptions) => PDFFindController;
      };

      const nextEventBus = eventBusRef.current ?? new EventBusCtor();
      const nextLinkService =
        linkServiceRef.current ?? new LinkServiceCtor({ eventBus: nextEventBus });
      const nextFindController =
        findControllerRef.current ??
        new FindControllerCtor({ eventBus: nextEventBus, linkService: nextLinkService });

      if (cancelled) return;

      eventBusRef.current = nextEventBus;
      linkServiceRef.current = nextLinkService;
      findControllerRef.current = nextFindController;

      setEventBus(nextEventBus);
      setLinkService(nextLinkService);
      setFindController(nextFindController);
    };

    void ensureServices();

    return () => {
      cancelled = true;
    };
  }, []);

  return { eventBus, linkService, findController };
}



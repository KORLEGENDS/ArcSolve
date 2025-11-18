'use client';

/**
 * pdf.js Viewer 계열 모듈 로더
 * - 브라우저 환경에서만 동적 import 수행
 * - 먼저 코어(pdfjs-dist)를 로드하여 globalThis.pdfjsLib를 세팅한 뒤
 *   web/pdf_viewer.mjs에서 Viewer/EventBus 등을 가져옵니다.
 */

let viewerModulePromise: Promise<typeof import('pdfjs-dist/web/pdf_viewer.mjs')> | null = null;

export async function loadPdfJsViewerModule(): Promise<typeof import('pdfjs-dist/web/pdf_viewer.mjs')> {
  if (viewerModulePromise) return viewerModulePromise;

  viewerModulePromise = (async () => {
    if (typeof window === 'undefined') {
      throw new Error('PDF.js Viewer는 브라우저 환경에서만 사용할 수 있습니다.');
    }

    // 1) 코어 모듈 로드 후 globalThis.pdfjsLib 세팅
    const pdfjsLib = await import('pdfjs-dist');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).pdfjsLib = pdfjsLib;

    // 2) Viewer 모듈 로드 (EventBus, PDFViewer 등)
    const pdfjsViewer = await import('pdfjs-dist/web/pdf_viewer.mjs');
    return pdfjsViewer;
  })();

  return viewerModulePromise;
}


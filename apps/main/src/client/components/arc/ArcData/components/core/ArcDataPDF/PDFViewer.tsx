/**
 * PDFViewer (래퍼)
 * - PDFCore(렌더/가상화/스크롤/텍스트 레이어) + PDFOverlay(오버레이/번역/인용) 합성
 */

'use client';

import type { OverlayLayout } from '@/share/schema/zod/file-zod/layout-zod';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import React, { useImperativeHandle } from 'react';
import { captureBlockToBlob } from '../../../utils/overlay-capture';
import PDFCore, { type PDFCoreHandle, type PageCanvas } from './PDFCore';
import PDFOverlayNew, { type PDFOverlayNewHandle } from './PDFOverlay';

export interface PDFViewerProps {
  document: PDFDocumentProxy;
  docKey?: string;
  zoom: number; // 100 = 100%
  layout?: OverlayLayout;
  overlayEnabled?: boolean;
  textLayerEnabled?: boolean;
  translateOverlayEnabled?: boolean;
  onVisiblePageChange?: (pageNumber: number) => void;
  onError?: (error: Error) => void;
  className?: string;
  onAddCitation?: (citation: any) => void; // keep as-is to avoid rippling types
  sourceId?: string;
  source?: string;
}

export interface PDFViewerHandle {
  scrollToPage: (pageNumber: number) => void;
  captureOverlayRegion: (params: {
    pageNumber: number;
    blockId: string;
    targetCssWidth?: number;
    maxDpr?: number;
    paddingPx?: number;
  }) => Promise<Blob | null>;
  ingestTranslationDelta: (e: { blockId: string; text: string }) => void;
  ingestTranslationFinal: (e: { blockId: string; text: string }) => void;
}

export interface OverlayHoverInfo {
  pageNumber: number;
  id: string;
  containerEl: HTMLDivElement;
  containerLeft: number;
  containerTop: number;
  width: number;
  height: number;
}

const PDFViewer = React.forwardRef<PDFViewerHandle, PDFViewerProps>(
  (
    { document, docKey, zoom, layout, overlayEnabled, textLayerEnabled = true, translateOverlayEnabled, onVisiblePageChange, onError, className, onAddCitation, sourceId, source },
    ref
  ) => {
    const coreRef = React.useRef<PDFCoreHandle>(null);
    const overlayRef = React.useRef<PDFOverlayNewHandle>(null);
    type CoreEnv = { containerEl: HTMLDivElement | null; pages: PageCanvas[]; renderVersion: number; zoomStable: boolean; visibleWindow: { center: number; start: number; end: number } };
    const [coreEnv, setCoreEnv] = React.useState<CoreEnv>({ containerEl: null, pages: [], renderVersion: 0, zoomStable: false, visibleWindow: { center: 1, start: 1, end: 1 } });
    const rafIdRef = React.useRef<number | null>(null);
    const pendingEnvRef = React.useRef<CoreEnv | null>(null);
    const handleCoreEnvChange = React.useCallback((next: CoreEnv) => {
      pendingEnvRef.current = next;
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (pendingEnvRef.current) {
          setCoreEnv(pendingEnvRef.current);
          pendingEnvRef.current = null;
        }
      });
    }, []);
    React.useEffect(() => {
      return () => { if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; } };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        scrollToPage: (pageNumber: number) => coreRef.current?.scrollToPage(pageNumber),
        captureOverlayRegion: async ({ pageNumber, blockId, targetCssWidth = 1000, maxDpr = 1.5, paddingPx = 4 }) => {
          return await captureBlockToBlob({ document, layout, pageNumber, blockId, docKey, options: { targetCssWidth, maxDpr, paddingPx } });
        },
        ingestTranslationDelta: (e) => overlayRef.current?.ingestTranslationDelta(e),
        ingestTranslationFinal: (e) => overlayRef.current?.ingestTranslationFinal(e),
      }),
      [document, layout, docKey]
    );

    return (
      <div className={className}>
        <PDFCore
          ref={coreRef}
          document={document}
          docKey={docKey}
          zoom={zoom}
          textLayerEnabled={textLayerEnabled}
          onVisiblePageChange={onVisiblePageChange}
          className={className}
          onCoreEnvChange={handleCoreEnvChange}
        />
        <PDFOverlayNew
          ref={overlayRef}
          containerEl={coreEnv.containerEl}
          pages={coreEnv.pages}
          renderVersion={coreEnv.renderVersion}
          zoomStable={coreEnv.zoomStable}
          visibleWindow={coreEnv.visibleWindow}
          document={document}
          docKey={docKey}
          layout={layout}
          overlayEnabled={overlayEnabled}
          translateOverlayEnabled={translateOverlayEnabled}
          onAddCitation={onAddCitation}
          sourceId={sourceId}
          source={source}
        />
      </div>
    );
  }
);

PDFViewer.displayName = 'PDFViewer';

export default PDFViewer;




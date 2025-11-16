/**
 * PDFViewer (래퍼)
 * - PDFCore(렌더/가상화/스크롤/텍스트 레이어) + PDFOverlay(오버레이/번역/인용) 합성
 */

'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import React, { useImperativeHandle } from 'react';
import PDFCore, { type PDFCoreHandle } from './PDFCore';

export interface PDFViewerProps {
  document: PDFDocumentProxy;
  docKey?: string;
  zoom: number; // 100 = 100%
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
    { document, docKey, zoom, overlayEnabled, textLayerEnabled = true, translateOverlayEnabled, onVisiblePageChange, onError, className, onAddCitation, sourceId, source },
    ref
  ) => {
    const coreRef = React.useRef<PDFCoreHandle>(null);

    useImperativeHandle(
      ref,
      () => ({
        scrollToPage: (pageNumber: number) => coreRef.current?.scrollToPage(pageNumber),
        captureOverlayRegion: async ({ pageNumber, blockId, targetCssWidth = 1000, maxDpr = 1.5, paddingPx = 4 }) => {
          // 오버레이 기능은 MVP에서는 사용하지 않으므로 항상 null 반환
          return null;
        },
        // 오버레이/번역 기능은 MVP에서는 사용하지 않으므로 no-op으로 유지
        ingestTranslationDelta: () => {},
        ingestTranslationFinal: () => {},
      }),
      [document, docKey]
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
          // 오버레이 환경 연동은 MVP에서는 사용하지 않음
          onCoreEnvChange={undefined}
        />
      </div>
    );
  }
);

PDFViewer.displayName = 'PDFViewer';

export default PDFViewer;




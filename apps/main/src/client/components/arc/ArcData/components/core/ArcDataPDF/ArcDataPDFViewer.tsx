/**
 * ArcDataPDFViewer (래퍼)
 * - ArcDataPDFCore(렌더/가상화/스크롤/텍스트 레이어)를 감싸는 래퍼 컴포넌트
 * - 과거 오버레이/번역/인용 레이어(PDFOverlay)는 MVP 단계에서 제거되어 이 컴포넌트에서는 사용하지 않습니다.
 */

'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import React, { useImperativeHandle } from 'react';
import ArcDataPDFCore, { type ArcDataPDFCoreHandle } from './ArcDataPDFCore';

export interface ArcDataPDFViewerProps {
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

export interface ArcDataPDFViewerHandle {
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

const ArcDataPDFViewer = React.forwardRef<ArcDataPDFViewerHandle, ArcDataPDFViewerProps>(
  (
    { document, docKey, zoom, overlayEnabled, textLayerEnabled = true, translateOverlayEnabled, onVisiblePageChange, onError, className, onAddCitation, sourceId, source },
    ref
  ) => {
    const coreRef = React.useRef<ArcDataPDFCoreHandle>(null);

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
        <ArcDataPDFCore
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

ArcDataPDFViewer.displayName = 'ArcDataPDFViewer';

export default ArcDataPDFViewer;


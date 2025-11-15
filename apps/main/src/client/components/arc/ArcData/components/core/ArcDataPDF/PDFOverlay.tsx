'use client';

import { Toolbar, ToolbarButton, ToolbarGroup } from '@/client/components/ui-base/toolbar';
import type { CitationData } from '@/client/components/ui-service/Chat/ArcChat.types';
import AnimatedMarkdown from '@/client/components/ui-service/Chat/components/message/animated-markdown';
import { Response } from '@/client/components/ui-service/Chat/components/message/response';
import { ResponsePreparing } from '@/client/components/ui-service/Chat/components/message/response-preparing';
import { Loading } from '@/client/components/ui/loading';
import useChatFileTranslate from '@/client/hooks/chat/useChatFileTranslate';
import { iconFromToken } from '@/share/configs/icons/icon-utils';
import type { OverlayLayout } from '@/share/schema/zod/file-zod/layout-zod';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildCitationFromBlock } from '../../../utils/citation';
import { captureBlockToBlob } from '../../../utils/overlay-capture';
import { clearOverlayCanvas, computePixelRects, drawHoverRect, getBlockById, getBlockText, resolveHitTargetAtPoint, syncOverlayCanvasSize } from '../../../utils/overlay-geometry';
import type { PageCanvas } from './PDFCore';

// 상단: 계산/상태 관리 레이어 -------------------------------------------------

export interface PDFOverlayNewHandle {
  ingestTranslationDelta: (e: { blockId: string; text: string }) => void;
  ingestTranslationFinal: (e: { blockId: string; text: string }) => void;
}

export interface PDFOverlayNewProps {
  containerEl: HTMLDivElement | null;
  pages: PageCanvas[];
  renderVersion: number;
  zoomStable: boolean;
  visibleWindow?: { center: number; start: number; end: number };
  document: PDFDocumentProxy;
  docKey?: string;
  layout?: OverlayLayout;
  overlayEnabled?: boolean;
  translateOverlayEnabled?: boolean;
  onAddCitation?: (citation: CitationData) => void;
  sourceId?: string;
  source?: string;
}

type OverlayAnchor = {
  pageNumber: number;
  containerEl: HTMLDivElement;
  rect: { left: number; top: number; width: number; height: number };
  id: string;
};

type OverlayMode = 'highlight' | 'translate';
type StreamState = 'idle' | 'translating' | 'done' | 'error';

function isUuidLike(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^[0-9a-fA-F-]{36}$/.test(value);
}

// 폰트 자동 맞춤 훅: translate-overlay.tsx의 측정 로직을 재구성
function useAutoFitFont(content: string, isStreaming?: boolean) {
  const [optimalFontSize, setOptimalFontSize] = useState<number>(16);
  const [isMeasuring, setIsMeasuring] = useState<boolean>(true);
  const measurementRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const measuringRef = useRef<boolean>(false);
  const pendingMeasureRef = useRef<boolean>(false);
  const isPreparing = !!isStreaming && !content.trim();

  const measureAndFitFontSize = useCallback(() => {
    if (!measurementRef.current || !displayRef.current || !content.trim()) return;
    if (isPreparing) return;
    if (measuringRef.current) { pendingMeasureRef.current = true; return; }

    setIsMeasuring(true);
    measuringRef.current = true;
    const measurementEl = measurementRef.current;
    const displayEl = displayRef.current;
    const availableHeight = displayEl.clientHeight;

    let minSize = 8;
    let maxSize = 32;
    let bestSize = 8;

    const binarySearch = () => {
      if (maxSize - minSize <= 1) {
        setOptimalFontSize(bestSize);
        setIsMeasuring(false);
        measuringRef.current = false;
        if (pendingMeasureRef.current) {
          pendingMeasureRef.current = false;
          requestAnimationFrame(() => measureAndFitFontSize());
        }
        return;
      }
      const midSize = (minSize + maxSize) / 2;
      measurementEl.style.fontSize = `${midSize}px`;
      measurementEl.offsetHeight; // 강제 리플로우
      const contentHeight = measurementEl.scrollHeight;
      if (contentHeight <= availableHeight) {
        bestSize = midSize;
        minSize = midSize;
      } else {
        maxSize = midSize;
      }
      requestAnimationFrame(binarySearch);
    };

    requestAnimationFrame(binarySearch);
  }, [content, isPreparing]);

  useEffect(() => {
    if (isStreaming) {
      setIsMeasuring(false);
    } else if (content.trim()) {
      measureAndFitFontSize();
    }
  }, [isStreaming, content, measureAndFitFontSize]);

  return { optimalFontSize, isMeasuring, measurementRef, displayRef, isPreparing } as const;
}

function useOverlayCanvasLayer(overlayEnabled: boolean | undefined, pages: PageCanvas[], renderVersion: number) {
  const overlayMapRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const roRef = useRef<ResizeObserver | null>(null);

  const ensureOverlayForPage = useCallback((p: PageCanvas): void => {
    if (!overlayEnabled) return;
    const existing = overlayMapRef.current.get(p.pageNumber);
    const stale = !existing || !existing.isConnected || existing.parentElement !== p.container;
    if (!stale) return;
    if (existing) { try { existing.remove(); } catch {} overlayMapRef.current.delete(p.pageNumber); }
    const overlay = window.document.createElement('canvas');
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.zIndex = '3';
    overlay.style.pointerEvents = 'none';
    overlay.dataset.role = 'pdf-overlay';
    overlay.width = 1; overlay.height = 1;
    overlay.style.width = `${p.canvas.clientWidth}px`;
    overlay.style.height = `${p.canvas.clientHeight}px`;
    p.container.appendChild(overlay);
    syncOverlayCanvasSize(p.canvas, overlay);
    overlayMapRef.current.set(p.pageNumber, overlay);
  }, [overlayEnabled]);

  const clearAllOverlays = useCallback((): void => {
    for (const [, overlay] of overlayMapRef.current) {
      clearOverlayCanvas(overlay);
    }
  }, []);

  useEffect(() => {
    // renderVersion 변경 시 맵 리셋: DOM 재구성 이후 stale 참조 제거
    for (const [, overlay] of overlayMapRef.current) {
      try { overlay.remove(); } catch {}
    }
    overlayMapRef.current.clear();
  }, [renderVersion]);

  useEffect(() => {
    // ResizeObserver로 크기 동기화
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (!pages || pages.length === 0) return;
    const ro = new ResizeObserver((_entries) => {
      for (const [pageNumber, overlay] of overlayMapRef.current.entries()) {
        const page = pages.find(p => p.pageNumber === pageNumber);
        if (!page) continue;
        syncOverlayCanvasSize(page.canvas, overlay);
      }
    });
    for (const p of pages) ro.observe(p.canvas);
    roRef.current = ro;
    return () => { ro.disconnect(); roRef.current = null; };
  }, [pages, renderVersion]);

  return { overlayMapRef, ensureOverlayForPage, clearAllOverlays } as const;
}

function useAnchors(pages: PageCanvas[], layout?: OverlayLayout) {
  const resolveByPointer = useCallback((px: number, py: number): OverlayAnchor | null => {
    if (!layout) return null;
    const hit = resolveHitTargetAtPoint(pages as any, layout, px, py);
    if (!hit) return null;
    return {
      pageNumber: hit.page.pageNumber,
      containerEl: hit.page.container,
      rect: { left: hit.rect.left, top: hit.rect.top, width: hit.rect.width, height: hit.rect.height },
      id: hit.rect.id,
    };
  }, [pages, layout]);

  const resolveById = useCallback((blockId: string): OverlayAnchor | null => {
    if (!layout) return null;
    const page = pages.find(p => {
      const rects = computePixelRects(p.canvas, layout, p.pageNumber);
      return rects.some(r => r.id === blockId);
    });
    if (!page) return null;
    const rects = computePixelRects(page.canvas, layout, page.pageNumber);
    const rect = rects.find(r => r.id === blockId) ?? null;
    if (!rect) return null;
    return { pageNumber: page.pageNumber, containerEl: page.container, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, id: blockId };
  }, [pages, layout]);

  return { resolveByPointer, resolveById } as const;
}

function usePinState() {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const activeId = pinnedId ?? hoverId ?? null;

  const clearAll = useCallback(() => { setHoverId(null); setPinnedId(null); }, []);

  const toggleByAnchor = useCallback((anchor: OverlayAnchor | null) => {
    if (!anchor) { setPinnedId(null); return; }
    if (pinnedId && (pinnedId === anchor.id)) {
      // 같은 타깃 → 해제
      setPinnedId(null);
      return;
    }
    // 다른 타깃 → 전환
    setPinnedId(anchor.id);
    setHoverId(null);
  }, [pinnedId]);

  return { hoverId, pinnedId, activeId, setHoverId, setPinnedId, clearAll, toggleByAnchor } as const;
}

function useTranslateStreams(fileId: string) {
  type BlockTranslateState = { status: StreamState; text: string; updatedAt: number };
  const [blockTranslations, setBlockTranslations] = useState<Record<string, BlockTranslateState>>({});
  const [activeStreams, setActiveStreams] = useState<Record<string, { blockId: string; text: string; targetLang?: string; pageNumber: number }>>({});

  const makeKey = useCallback((fid: string, bid: string) => `${fid}:${bid}`, []);

  const ingestDelta = useCallback((e: { blockId: string; text: string }) => {
    const k = makeKey(fileId, e.blockId);
    setBlockTranslations((prev) => ({ ...prev, [k]: { status: 'translating', text: e.text, updatedAt: Date.now() } }));
  }, [fileId, makeKey]);

  const ingestFinal = useCallback((e: { blockId: string; text: string }) => {
    const k = makeKey(fileId, e.blockId);
    setBlockTranslations((prev) => ({ ...prev, [k]: { status: 'done', text: e.text, updatedAt: Date.now() } }));
  }, [fileId, makeKey]);

  return { blockTranslations, activeStreams, setActiveStreams, makeKey, ingestDelta, ingestFinal } as const;
}

const BlockTranslateStream: React.FC<{
  streamId: string;
  fileId: string;
  blockId: string;
  text: string;
  targetLang?: string;
  pageNumber: number;
  onProgress: (text: string) => void;
  onComplete: (finalText: string) => void;
  onError?: (error: Error, lastText: string) => void;
}> = ({ streamId, fileId, blockId, text, targetLang, pageNumber, onProgress, onComplete, onError }) => {
  const lastTextRef = useRef('');
  const translate = useChatFileTranslate({
    id: `tr:${streamId}`,
    onDelta: (e) => {
      if (e.blockId === blockId) {
        lastTextRef.current = e.text;
        onProgress(e.text);
      }
    },
    onDone: () => { onComplete(lastTextRef.current); },
    onError: (e) => {
      const errorMsg = e.error instanceof Error ? e.error.message : String(e.error);
      onError?.(new Error(errorMsg), lastTextRef.current);
    },
  });

  useEffect(() => {
    void translate.send({ fileId, targetLang, rangeStart: pageNumber, rangeEnd: pageNumber, blocks: [{ id: blockId, text }] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

// 하단: 표시/스타일 레이어 -----------------------------------------------------

function UnifiedOverlayCard(props: {
  containerEl: HTMLDivElement;
  anchor: OverlayAnchor;
  mode: OverlayMode;
  content: { text?: string; isStreaming?: boolean };
  actions: {
    onCopy(): void | Promise<void>;
    onCopyImage(): void | Promise<void>;
    onCite(): void | Promise<void>;
    onTranslate(): void;
  };
}) {
  const { containerEl, anchor, mode, content, actions } = props;
  const [copying, setCopying] = React.useState(false);
  const [justCopied, setJustCopied] = React.useState(false);
  const [justCopiedImage, setJustCopiedImage] = React.useState(false);
  const [justAddedCitation, setJustAddedCitation] = React.useState(false);

  const handleCopyClick = React.useCallback(async () => {
    if (copying) return;
    setCopying(true);
    try {
      const r = actions.onCopy();
      if (r && typeof (r as any).then === 'function') { await (r as Promise<void>); }
      setJustCopied(true); window.setTimeout(() => setJustCopied(false), 900);
    } finally {
      setCopying(false);
    }
  }, [actions, copying]);

  const handleCopyImageClick = React.useCallback(async () => {
    const r = actions.onCopyImage();
    if (r && typeof (r as any).then === 'function') { await (r as Promise<void>); }
    setJustCopiedImage(true); window.setTimeout(() => setJustCopiedImage(false), 900);
  }, [actions]);

  const handleCiteClick = React.useCallback(async () => {
    const r = actions.onCite();
    if (r && typeof (r as any).then === 'function') { await (r as Promise<void>); }
    setJustAddedCitation(true); window.setTimeout(() => setJustAddedCitation(false), 900);
  }, [actions]);
  const card = (
    <div
      data-overlay-root="true"
      style={{ position: 'absolute', left: 0, top: 0, inset: 0, pointerEvents: 'none', zIndex: 4 }}
    >
      {/* Toolbar: 블록 상단 중앙, 오프셋 없이 딱 붙게 배치 (히트 슬롭 확장 래퍼) */}
      <div
        style={{
          position: 'absolute',
          left: `${anchor.rect.left + anchor.rect.width / 2}px`,
          top: `${anchor.rect.top + 1}px`,
          transform: 'translate(-50%, -100%)',
          pointerEvents: 'auto',
          padding: '8px 12px 0px 12px',
        }}
        data-overlay-interactive="true"
      >
        <div
          data-overlay-interactive="true"
          className="rounded-t-md bg-background/95 shadow-md border px-1.5 py-1"
        >
          <Toolbar className="flex items-center gap-1 border-none bg-transparent p-0">
        <ToolbarGroup className="mx-0.5">
            <ToolbarButton
              size="xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCopyClick}
              disabled={copying}
              tooltip="복사"
            >
              {justCopied
                ? iconFromToken('arc.service.arcViewer.floatingToolbar.success', { className: 'size-4' })
                : iconFromToken('arc.service.arcViewer.floatingToolbar.copy', { className: 'size-4' })}
            </ToolbarButton>

            <ToolbarButton
              size="xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCopyImageClick}
              tooltip="이미지 복사"
            >
              {justCopiedImage
                ? iconFromToken('arc.service.arcViewer.floatingToolbar.success', { className: 'size-4' })
                : iconFromToken('arc.service.arcViewer.floatingToolbar.imageCopy', { className: 'size-4' })}
            </ToolbarButton>

            <ToolbarButton
              size="xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCiteClick}
              tooltip="인용 추가"
            >
              {justAddedCitation
                ? iconFromToken('arc.service.arcViewer.floatingToolbar.success', { className: 'size-4' })
                : iconFromToken('arc.service.arcViewer.floatingToolbar.cite', { className: 'size-4' })}
            </ToolbarButton>

            <ToolbarButton
              size="xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={actions.onTranslate}
              tooltip={content.isStreaming ? '번역 중' : '번역'}
            >
              {content.isStreaming
                ? <Loading size="xs" indicatorOnly inline className="m-0 p-0" />
                : iconFromToken('arc.service.arcViewer.floatingToolbar.translate', { className: 'size-4' })}
            </ToolbarButton>
        </ToolbarGroup>
          </Toolbar>
        </div>
      </div>

      {/* 번역 내용: translate-overlay.tsx 방식으로 블록 내부 렌더 */}
      {mode === 'translate' && (
        <InlineTranslateInline
          containerEl={containerEl}
          left={Math.round(anchor.rect.left)}
          top={Math.round(anchor.rect.top)}
          width={Math.max(1, Math.round(anchor.rect.width))}
          height={Math.max(1, Math.round(anchor.rect.height))}
          content={content.text ?? ''}
          isStreaming={content.isStreaming}
        />
      )}
    </div>
  );

  return createPortal(card, containerEl);
}

const InlineTranslateInline: React.FC<{
  containerEl: HTMLElement | null;
  left: number;
  top: number;
  width: number;
  height: number;
  content: string;
  isStreaming?: boolean;
}> = ({ containerEl, left, top, width, height, content, isStreaming }) => {
  const { optimalFontSize, isMeasuring, measurementRef, displayRef, isPreparing } = useAutoFitFont(content, isStreaming);
  if (!containerEl) return null;
  return createPortal(
    <div
      data-role="translate-inline"
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        backgroundColor: '#ffffff',
        color: '#000000',
        pointerEvents: 'auto',
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      <div
        ref={measurementRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 'auto',
          padding: '2px 4px',
          fontSize: `${optimalFontSize}px`,
          lineHeight: '1.4',
          textAlign: 'justify',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <Response>{content}</Response>
      </div>
      <div
        ref={displayRef}
        style={{
          width: '100%',
          height: '100%',
          padding: '2px 4px',
          fontSize: `${optimalFontSize}px`,
          lineHeight: '1.4',
          textAlign: isPreparing ? 'center' : 'justify',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflow: 'hidden',
          display: isPreparing ? 'flex' : undefined,
          alignItems: isPreparing ? 'center' : undefined,
          justifyContent: isPreparing ? 'center' : undefined,
          opacity: isPreparing ? 1 : (isMeasuring ? 0 : 1),
          transition: isStreaming ? undefined : 'opacity 0.1s ease-out',
        }}
      >
        {isPreparing ? (
          <ResponsePreparing />
        ) : isStreaming ? (
          <AnimatedMarkdown content={content} mode="fade" granularity="word" />
        ) : (
          <Response>{content}</Response>
        )}
      </div>
    </div>,
    containerEl
  );
};

const PDFOverlayNew = React.forwardRef<PDFOverlayNewHandle, PDFOverlayNewProps>(function PDFOverlayNew(props, ref) {
  const { containerEl, pages, renderVersion, visibleWindow, document, docKey, layout, overlayEnabled, translateOverlayEnabled, onAddCitation, sourceId, source } = props;

  const fileKey = useMemo(() => String(sourceId ?? docKey ?? ''), [sourceId, docKey]);
  const { overlayMapRef, ensureOverlayForPage, clearAllOverlays } = useOverlayCanvasLayer(!!overlayEnabled, pages, renderVersion);
  const { resolveByPointer, resolveById } = useAnchors(pages, layout);
  const { hoverId, pinnedId, activeId, setHoverId, setPinnedId, toggleByAnchor } = usePinState();
  const { blockTranslations, activeStreams, setActiveStreams, makeKey, ingestDelta, ingestFinal } = useTranslateStreams(fileKey);

  // 가시 윈도우 내 오버레이 보장 및 윈도우 밖 제거
  useEffect(() => {
    if (!overlayEnabled || !layout) return;
    const w = visibleWindow ?? { start: 1, end: Number.MAX_SAFE_INTEGER, center: 1 };
    for (const p of pages) {
      if (p.pageNumber >= w.start && p.pageNumber <= w.end) ensureOverlayForPage(p);
    }
    for (const [pageNumber] of overlayMapRef.current) {
      if (pageNumber < w.start || pageNumber > w.end) {
        const overlay = overlayMapRef.current.get(pageNumber);
        if (overlay) { try { overlay.remove(); } catch {} overlayMapRef.current.delete(pageNumber); }
      }
    }
  }, [pages, renderVersion, overlayEnabled, layout, ensureOverlayForPage, overlayMapRef, visibleWindow]);

  // 마우스 이동 → hoverOnly (pin이 없을 때만)
  useEffect(() => {
    const container = containerEl;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent): void => {
      if (pinnedId) return;
      // 인터랙티브 UI 위에서는 hover 상태를 유지(클리어/갱신 금지)
      const isInteractivePath = (event: MouseEvent): boolean => {
        const path = (event.composedPath && event.composedPath()) || [];
        for (const n of path) {
          if (n && (n as Element).nodeType === 1) {
            const el = n as Element;
            if (el.hasAttribute && el.hasAttribute('data-overlay-interactive')) return true;
          }
        }
        return false;
      };
      if (isInteractivePath(e)) return;
      if (!overlayEnabled || !layout) { clearAllOverlays(); setHoverId(null); return; }
      const px = e.clientX; const py = e.clientY;
      const anchor = resolveByPointer(px, py);
      if (!anchor) { clearAllOverlays(); setHoverId(null); return; }
      try { ensureOverlayForPage((pages as any).find((p: PageCanvas) => p.pageNumber === anchor.pageNumber)); } catch {}
      // 하이라이트 갱신
      clearAllOverlays();
      const overlay = overlayMapRef.current.get(anchor.pageNumber) ?? null;
      const ctx = overlay?.getContext('2d', { willReadFrequently: true }) ?? null;
      if (ctx) drawHoverRect(ctx, { id: anchor.id, left: anchor.rect.left, top: anchor.rect.top, width: anchor.rect.width, height: anchor.rect.height } as any);
      setHoverId(anchor.id);
    };

    container.addEventListener('mousemove', handleMouseMove);
    return () => { container.removeEventListener('mousemove', handleMouseMove); };
  }, [containerEl, pages, overlayEnabled, layout, pinnedId, overlayMapRef, resolveByPointer, ensureOverlayForPage, clearAllOverlays, setHoverId]);

  // 클릭 → 토글(인터랙티브 내부만 예외)
  useEffect(() => {
    const container = containerEl;
    if (!container) return;

    const isInteractivePath = (event: MouseEvent): boolean => {
      const path = (event.composedPath && event.composedPath()) || [];
      for (const n of path) {
        if (n && (n as Element).nodeType === 1) {
          const el = n as Element;
          if (el.hasAttribute && el.hasAttribute('data-overlay-interactive')) return true;
        }
      }
      return false;
    };

    const handleMouseDownCapture = (e: MouseEvent): void => {
      if (e.button !== 0) return;
      if (!overlayEnabled || !layout) return;
      if (isInteractivePath(e)) return; // 인터랙티브 UI는 상태 변화 없음
      const px = e.clientX; const py = e.clientY;
      const anchor = resolveByPointer(px, py);
      toggleByAnchor(anchor);
      // 빈 영역 클릭으로 pin 해제되는 경우, 즉시 오버레이 지우기
      if (!anchor) {
        clearAllOverlays();
        setHoverId(null);
      }
    };

    const handleWindowMouseDown = (e: MouseEvent): void => {
      if (!pinnedId) return;
      if (!container.contains(e.target as Node)) {
        setPinnedId(null);
        setHoverId(null);
        clearAllOverlays();
      }
    };

    // 캡처 단계에서 먼저 토글 판정
    container.addEventListener('mousedown', handleMouseDownCapture, true);
    window.addEventListener('mousedown', handleWindowMouseDown, true);
    return () => {
      container.removeEventListener('mousedown', handleMouseDownCapture, true);
      window.removeEventListener('mousedown', handleWindowMouseDown, true);
    };
  }, [containerEl, overlayEnabled, layout, resolveByPointer, toggleByAnchor, pinnedId, setPinnedId, setHoverId, clearAllOverlays]);

  // 렌더/줌 변화 시 핀 하이라이트 재계산
  useEffect(() => {
    if (!pinnedId) return;
    if (!layout) return;
    const anchor = resolveById(pinnedId);
    if (!anchor) return;
    clearAllOverlays();
    const overlay = overlayMapRef.current.get(anchor.pageNumber) ?? null;
    const ctx = overlay?.getContext('2d', { willReadFrequently: true }) ?? null;
    if (ctx) drawHoverRect(ctx, { id: anchor.id, left: anchor.rect.left, top: anchor.rect.top, width: anchor.rect.width, height: anchor.rect.height } as any);
  }, [pinnedId, layout, pages, renderVersion, resolveById, clearAllOverlays, overlayMapRef]);

  // active 앵커와 모드/콘텐츠 계산
  const activeAnchor: OverlayAnchor | null = useMemo(() => {
    if (!activeId) return null;
    return resolveById(activeId);
  }, [activeId, resolveById]);

  const savedTranslationText: string = useMemo(() => {
    if (!layout || !activeAnchor) return '';
    const block = getBlockById(layout, activeAnchor.pageNumber, activeAnchor.id) as any;
    return String(block?.translated_text ?? '').trim();
  }, [layout, activeAnchor]);

  const streamKey = activeAnchor ? makeKey(fileKey, activeAnchor.id) : null;
  const streamingState = streamKey ? blockTranslations[streamKey] : undefined;
  const draftText = (streamingState?.text ?? '').trim();
  const isStreaming = streamingState?.status === 'translating';

  const mode: OverlayMode | null = useMemo(() => {
    if (!overlayEnabled || !layout || !activeAnchor) return null;
    if (translateOverlayEnabled && (isStreaming || draftText || savedTranslationText)) return 'translate';
    return 'highlight';
  }, [overlayEnabled, layout, activeAnchor, translateOverlayEnabled, isStreaming, draftText, savedTranslationText]);

  // 액션 구현 ---------------------------------------------------------------
  const handleCopy = useCallback(async () => {
    if (!layout || !activeAnchor) return;
    try {
      const text = getBlockText(layout, activeAnchor.pageNumber, activeAnchor.id);
      await navigator.clipboard.writeText(String(text ?? ''));
    } catch {}
  }, [layout, activeAnchor]);

  const handleCopyImage = useCallback(async () => {
    if (!activeAnchor) return;
    try {
      const blob = await captureBlockToBlob({ document, layout, pageNumber: activeAnchor.pageNumber, blockId: activeAnchor.id, docKey, options: { targetCssWidth: 1000, maxDpr: 1.5, paddingPx: 4 } });
      if (blob) {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
      }
    } catch {}
  }, [activeAnchor, document, layout, docKey]);

  const handleCite = useCallback(() => {
    if (!layout || !activeAnchor || typeof onAddCitation !== 'function') return;
    const citation = buildCitationFromBlock(layout, activeAnchor.pageNumber, activeAnchor.id, { sourceId: String(sourceId ?? docKey ?? ''), source: String(source ?? '') });
    if (!citation) return;
    onAddCitation(citation);
  }, [layout, activeAnchor, onAddCitation, sourceId, docKey, source]);

  const handleTranslate = useCallback(() => {
    if (!layout || !activeAnchor) return;
    if (!isUuidLike(fileKey)) return;
    const blockId = activeAnchor.id;
    const k = makeKey(fileKey, blockId);
    // 이미 진행 중이면 무시
    if (activeStreams[k]) return;
    const text = getBlockText(layout, activeAnchor.pageNumber, activeAnchor.id);
    // translating 상태로 표기 후 스트림 시작 등록
    // blockTranslations는 내부 훅이 관리(ingest로 업데이트)
    setActiveStreams((prev) => ({ ...prev, [k]: { blockId, text: String(text ?? ''), targetLang: 'ko', pageNumber: activeAnchor.pageNumber } }));
  }, [layout, activeAnchor, fileKey, activeStreams, setActiveStreams, makeKey]);

  // 외부 ingest 핸들 노출 ----------------------------------------------------
  useImperativeHandle(ref, () => ({ ingestTranslationDelta: ingestDelta, ingestTranslationFinal: ingestFinal }), [ingestDelta, ingestFinal]);

  return (
    <>
      {/* 단일 오버레이 카드(포털로 페이지 컨테이너에 렌더) */}
      {(overlayEnabled && layout && activeAnchor && mode) ? (
        <UnifiedOverlayCard
          containerEl={activeAnchor.containerEl}
          anchor={activeAnchor}
          mode={mode}
          content={{ text: draftText || savedTranslationText, isStreaming }}
          actions={{ onCopy: handleCopy, onCopyImage: handleCopyImage, onCite: handleCite, onTranslate: handleTranslate }}
        />
      ) : null}

      {/* 번역 스트림 구동기(비가시) */}
      {Object.entries(activeStreams).map(([key, v]) => (
        <BlockTranslateStream
          key={key}
          streamId={key}
          fileId={fileKey}
          blockId={v.blockId}
          text={v.text}
          targetLang={v.targetLang}
          pageNumber={v.pageNumber}
          onProgress={(text) => { const k = makeKey(fileKey, v.blockId); ingestDelta({ blockId: v.blockId, text }); if (!activeStreams[k]) { /* no-op */ } }}
          onComplete={(finalText) => { const k = makeKey(fileKey, v.blockId); ingestFinal({ blockId: v.blockId, text: finalText }); setActiveStreams((prev) => { const { [k]: _, ...rest } = prev; return rest; }); }}
          onError={(_err) => { const k = makeKey(fileKey, v.blockId); setActiveStreams((prev) => { const { [k]: _, ...rest } = prev; return rest; }); }}
        />
      ))}
    </>
  );
});

export default PDFOverlayNew;



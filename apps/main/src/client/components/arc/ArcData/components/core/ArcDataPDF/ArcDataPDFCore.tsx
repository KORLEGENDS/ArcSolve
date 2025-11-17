/**
 * ArcDataPDFCore
 * - PDF 렌더/가상화/스크롤/텍스트 레이어를 담당하는 코어 컴포넌트
 * - DOM/비즈니스 의존 오버레이(UI/번역/인용 등)는 포함하지 않음
 */

'use client';

import { pdfManager } from '@/client/components/arc/ArcData/managers/ArcDataPDFManager';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import styles from './ArcDataPDFViewer.module.css';

export interface PageCanvas {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  container: HTMLDivElement;
}

interface ArcDataPDFCoreProps {
  document: PDFDocumentProxy;
  docKey?: string;
  zoom: number; // 100 = 100%
  textLayerEnabled?: boolean;
  onVisiblePageChange?: (pageNumber: number) => void;
  className?: string;
  onCoreEnvChange?: (env: { containerEl: HTMLDivElement | null; pages: PageCanvas[]; renderVersion: number; zoomStable: boolean; visibleWindow: { center: number; start: number; end: number } }) => void;
}

export interface ArcDataPDFCoreHandle {
  scrollToPage: (pageNumber: number) => void;
  getContainerEl: () => HTMLDivElement | null;
  getPages: () => PageCanvas[];
}

const ArcDataPDFCore = React.forwardRef<ArcDataPDFCoreHandle, ArcDataPDFCoreProps>(({ document, docKey, zoom, textLayerEnabled = true, onVisiblePageChange, className, onCoreEnvChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<PageCanvas[]>([]);
  const renderVersionRef = useRef(0);
  const [isRendering, setIsRendering] = useState(false);
  const scrollRafRef = useRef<number | null>(null);
  const bufferPagesRef = useRef(2);
  const pageStatesRef = useRef<Map<number, { quality: 'none' | 'low' | 'high'; rendering: boolean }>>(new Map());
  const renderQueueRef = useRef<Array<{ page: number; quality: 'low' | 'high' }>>([]);
  const schedulerActiveRef = useRef(false);
  const zoomStableRef = useRef(false);
  const zoomStableTimerRef = useRef<number | null>(null);
  const lastVisiblePageRef = useRef(1);
  const restoreTargetPageRef = useRef<number | null>(null);

  const computeCenterPage = useCallback((): number => {
    if (!containerRef.current || pagesRef.current.length === 0) return 1;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const viewportTop = containerRect.top;
    const viewportCenter = (viewportTop + containerRect.bottom) / 2;
    let bestPage = 1; let minDistance = Infinity;
    for (const { pageNumber, container: pageContainer } of pagesRef.current) {
      const pageRect = pageContainer.getBoundingClientRect();
      const pageCenter = (pageRect.top + pageRect.bottom) / 2;
      const distance = Math.abs(pageCenter - viewportCenter);
      if (distance < minDistance) { minDistance = distance; bestPage = pageNumber; }
      if (distance < 50) break;
    }
    return bestPage;
  }, []);

  const computeVisibleWindow = useCallback((): { center: number; start: number; end: number } => {
    const center = computeCenterPage();
    const buffer = bufferPagesRef.current;
    const start = Math.max(1, center - buffer);
    const end = Math.min(document.numPages, center + buffer);
    return { center, start, end };
  }, [computeCenterPage, document.numPages]);

  const emitCoreEnvChange = useCallback((): void => {
    onCoreEnvChange?.({
      containerEl: containerRef.current,
      pages: pagesRef.current,
      renderVersion: renderVersionRef.current,
      zoomStable: zoomStableRef.current,
      visibleWindow: computeVisibleWindow(),
    });
  }, [onCoreEnvChange, computeVisibleWindow]);

  // 메트릭 프리패스 제거: 컨테이너 준비 시 뷰포트로 충분히 계산됨

  // 컨테이너/플레이스홀더 선생성 (오버레이는 Overlay에서 관리)
  const preparePageContainers = useCallback(async (scale: number): Promise<void> => {
    if (!containerRef.current) return;
    const root = containerRef.current;
    root.innerHTML = '';
    pagesRef.current = [];
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i);
      const vp = await page.getViewport({ scale });

      const pageContainer = window.document.createElement('div');
      pageContainer.className = styles.pageContainer;
      pageContainer.dataset.pageNumber = String(i);
      pageContainer.dataset.role = 'pdf-page';
      pageContainer.style.position = 'relative';
      pageContainer.style.width = `${Math.floor(vp.width)}px`;
      pageContainer.style.height = `${Math.floor(vp.height)}px`;

      const placeholder = window.document.createElement('canvas');
      placeholder.className = styles.pageCanvas;
      placeholder.dataset.role = 'pdf-canvas';
      placeholder.width = 1; placeholder.height = 1;
      placeholder.style.width = `${Math.floor(vp.width)}px`;
      placeholder.style.height = `${Math.floor(vp.height)}px`;
      pageContainer.appendChild(placeholder);

      root.appendChild(pageContainer);
      pagesRef.current.push({ pageNumber: i, canvas: placeholder, container: pageContainer });
      pageStatesRef.current.set(i, { quality: 'none', rendering: false });
    }
  }, [document]);

  const scrollToPage = useCallback((pageNumber: number): void => {
    const pageCanvas = pagesRef.current.find((p) => p.pageNumber === pageNumber);
    if (pageCanvas?.container) {
      pageCanvas.container.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }, []);

  // 세션 가드 전체 렌더
  const renderAllPages = useCallback(async (): Promise<void> => {
    if (!containerRef.current) return;
    const currentVersion = ++renderVersionRef.current;
    const prefixBase = pdfManager.getEventPrefix(docKey, document);
    pdfManager.cancelDocumentRenders(prefixBase);

    setIsRendering(true);

    // 기존 텍스트/어노테이션 레이어 정리는 컨테이너 초기화로 대체
    containerRef.current.innerHTML = '';
    pagesRef.current = [];

    const scale = zoom / 100;
    await preparePageContainers(scale);
    emitCoreEnvChange();

    try {
      if (renderVersionRef.current !== currentVersion) return;
      const target = restoreTargetPageRef.current;
      if (typeof target === 'number' && !Number.isNaN(target)) {
        const clamped = Math.min(Math.max(target, 1), document.numPages);
        scrollToPage(clamped);
        restoreTargetPageRef.current = null;
      }
      ensureVisibleWindow(currentVersion);
      if (renderVersionRef.current === currentVersion) setIsRendering(false);
    } catch (error) {
      if (renderVersionRef.current === currentVersion) setIsRendering(false);
      // onError는 코어에서 다루지 않음
    }
  }, [document, zoom, docKey, preparePageContainers, scrollToPage]);

  // computeCenterPage moved above to share with visibleWindow computation

  const processQueue = useCallback(async (currentVersion: number): Promise<void> => {
    if (schedulerActiveRef.current) return;
    schedulerActiveRef.current = true;
    try {
      while (renderQueueRef.current.length > 0) {
        // 버전 불일치 시 즉시 중단하여 불필요한 작업 방지
        if (renderVersionRef.current !== currentVersion) break;
        const task = renderQueueRef.current.shift()!;
        const entry = pagesRef.current.find(p => p.pageNumber === task.page);
        if (!entry) continue;
        const st0 = pageStatesRef.current.get(task.page) ?? { quality: 'none', rendering: false };
        if (st0.rendering) continue;
        pageStatesRef.current.set(task.page, { ...st0, rendering: true });

        const maxDpr = task.quality === 'low' ? 1.25 : 2.0;
        try {
          const offscreen = await pdfManager.renderToCanvas({ docKey, document, pageNumber: task.page, scale: zoom / 100, maxDpr });
          if (renderVersionRef.current !== currentVersion) {
            // 렌더 도중 버전 변경되면 상태를 복구하고 루프 종료
            const stPrev = pageStatesRef.current.get(task.page) ?? { quality: 'none', rendering: true };
            pageStatesRef.current.set(task.page, { ...stPrev, rendering: false });
            break;
          }

          offscreen.className = styles.pageCanvas;
          offscreen.dataset.role = 'pdf-canvas';
          entry.canvas.replaceWith(offscreen);
          entry.canvas = offscreen;
          emitCoreEnvChange();

          // 텍스트/어노테이션 레이어는 MVP에서는 생성하지 않음

          pageStatesRef.current.set(task.page, { quality: task.quality, rendering: false });
        } catch {
          const st1 = pageStatesRef.current.get(task.page) ?? { quality: 'none', rendering: false };
          pageStatesRef.current.set(task.page, { ...st1, rendering: false });
        }
      }
    } finally {
      schedulerActiveRef.current = false;
    }
  }, [document, zoom, docKey]);

  const ensureVisibleWindow = useCallback((currentVersion: number): void => {
    if (pagesRef.current.length === 0) return;
    const center = computeCenterPage();
    const buffer = bufferPagesRef.current;
    const start = Math.max(1, center - buffer);
    const end = Math.min(document.numPages, center + buffer);

    // 0) prefix for precise cancellation
    const prefix = pdfManager.getEventPrefix(docKey, document);

    // 1) 현재 가시 범위 밖의 캔버스를 저해상도 플레이스홀더로 교체하고, 진행 중 렌더를 취소
    for (const entry of pagesRef.current) {
      const n = entry.pageNumber;
      if (n < start || n > end) {
        if (!(entry.canvas.width === 1 && entry.canvas.height === 1)) {
          const placeholder = window.document.createElement('canvas');
          placeholder.className = styles.pageCanvas; placeholder.dataset.role = 'pdf-canvas';
          placeholder.width = 1; placeholder.height = 1;
          const w = entry.container.clientWidth; const h = entry.container.clientHeight;
          placeholder.style.width = `${w}px`; placeholder.style.height = `${h}px`;
          entry.canvas.replaceWith(placeholder); entry.canvas = placeholder;
        }
        const st = pageStatesRef.current.get(n) ?? { quality: 'none', rendering: false };
        if (st.rendering) {
          const eventId = `${prefix}:${n}`;
          pdfManager.cancelRender(eventId);
        }
        pageStatesRef.current.set(n, { quality: 'none', rendering: false });
      }
    }

    // 2) Build priority order for visible pages: center -> neighbors
    const order: number[] = [center];
    for (let d = 1; center + d <= end || center - d >= start; d++) {
      if (center + d <= end) order.push(center + d);
      if (center - d >= start) order.push(center - d);
    }

    // 3) Purge queue of tasks outside visible window and dedupe
    const filtered = renderQueueRef.current.filter(t => t.page >= start && t.page <= end);
    const hasKey = (arr: Array<{ page: number; quality: 'low' | 'high' }>, p: number, q: 'low' | 'high') => arr.some(x => x.page === p && x.quality === q);

    // 4) Compose new queue with center-first low quality tasks at front, then existing filtered tasks, then high upgrades
    const front: Array<{ page: number; quality: 'low' | 'high' }> = [];
    const tail: Array<{ page: number; quality: 'low' | 'high' }> = [...filtered];

    for (const n of order) {
      const st = pageStatesRef.current.get(n) ?? { quality: 'none', rendering: false };
      if (!st.rendering && st.quality === 'none') {
        if (!hasKey(front, n, 'low') && !hasKey(tail, n, 'low')) front.push({ page: n, quality: 'low' });
      } else if (!st.rendering && st.quality === 'low' && zoomStableRef.current) {
        if (!hasKey(front, n, 'high') && !hasKey(tail, n, 'high')) tail.push({ page: n, quality: 'high' });
      }
    }

    renderQueueRef.current = [...front, ...tail];
    void processQueue(currentVersion);
  }, [document, docKey, computeCenterPage, processQueue]);

  const detectVisiblePage = useCallback((): void => {
    if (!containerRef.current || pagesRef.current.length === 0) return;
    const bestPage = computeCenterPage();
    lastVisiblePageRef.current = bestPage;
    onVisiblePageChange?.(bestPage);
  }, [onVisiblePageChange, computeCenterPage]);

  const handleScroll = useCallback((): void => {
    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      detectVisiblePage();
      ensureVisibleWindow(renderVersionRef.current);
      scrollRafRef.current = null;
    });
  }, [detectVisiblePage, ensureVisibleWindow]);

  useEffect(() => {
    zoomStableRef.current = false;
    if (zoomStableTimerRef.current) window.clearTimeout(zoomStableTimerRef.current);
    restoreTargetPageRef.current = lastVisiblePageRef.current;
    void renderAllPages();
    zoomStableTimerRef.current = window.setTimeout(() => {
      zoomStableRef.current = true;
      ensureVisibleWindow(renderVersionRef.current);
      emitCoreEnvChange();
    }, 80);
  }, [renderAllPages, zoom, ensureVisibleWindow, emitCoreEnvChange]);

  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    container.addEventListener('scroll', handleScroll);
    return (): void => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollRafRef.current !== null) { cancelAnimationFrame(scrollRafRef.current); scrollRafRef.current = null; }
    };
  }, [handleScroll]);

  // textLayerEnabled 관련 로직은 MVP에서는 사용하지 않으므로 제거
  useEffect(() => {
    return (): void => {
      const prefix = pdfManager.getEventPrefix(docKey, document);
      pdfManager.cancelDocumentRenders(prefix);
    };
  }, [docKey, document]);

  useEffect(() => {
    if (!isRendering && pagesRef.current.length > 0) detectVisiblePage();
  }, [isRendering, detectVisiblePage]);

  useImperativeHandle(ref, () => ({
    scrollToPage,
    getContainerEl: () => containerRef.current,
    getPages: () => pagesRef.current,
  }), [scrollToPage]);

  return (
    <div ref={containerRef} className={`${styles.container} ${className ?? ''} ${isRendering ? styles.rendering : ''}`} data-role="pdf-container" />
  );
});

ArcDataPDFCore.displayName = 'ArcDataPDFCore';

export default ArcDataPDFCore;


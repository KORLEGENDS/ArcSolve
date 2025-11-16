/**
 * 뷰 설정 훅 (PDF/이미지 공용)
 * - 줌/사이드바/너비맞춤/기준폭측정/리사이즈 대응을 캡슐화
 * - 파일명에 맞춰 PDF 전용 훅처럼 사용하지만, 파라미터 구조는 이미지 등으로 확장 가능하도록 유지합니다.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { useCallback, useEffect, useRef, useState } from 'react';

export const ZOOM_LEVELS = {
  MIN: 25, // 25%
  MAX: 500, // 500%
  DEFAULT: 100, // 100%
  STEP: 25, // 25% 단위
} as const;

/**
 * PDF 뷰 설정 훅 파라미터
 * - 현재는 ArcData PDF 전용으로 사용되지만, 이미지 뷰어 등으로 확장 가능하도록 제너릭 형태를 유지합니다.
 */
export interface UsePDFSettingParams {
  isPDF: boolean;
  pdfDocument: PDFDocumentProxy | null;
  imageNaturalWidth: number | null;
  imageNaturalHeight?: number | null;
  /** 이미지 맞춤 기준: width(기본) 또는 longer-edge */
  fitMode?: 'width' | 'longer-edge';
}

/**
 * PDF 뷰 설정 훅 반환 타입
 * - 외부 컴포넌트는 이 인터페이스에만 의존하도록 고정합니다.
 */
export interface UsePDFSettingReturn {
  // 상태
  zoomLevel: number;
  isSidebarOpen: boolean;
  isFitWidth: boolean;
  pdfBaseWidth: number | null;

  // refs
  viewerContentRef: React.RefObject<HTMLDivElement | null>;

  // 액션
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  toggleSidebar: () => void;
  toggleFitWidth: () => void;
  recomputeFitWidth: () => void;
  /** 한 번만 현재 컨테이너 너비 기준으로 맞춤 (isFitWidth 상태는 변경하지 않음) */
  fitWidthOnce: () => void;
}

/**
 * PDF 뷰 설정 훅
 * - 파일명(`usePDFSetting.ts`)에 맞춘 기본 이름은 `usePDFSetting`입니다.
 * - 기존 코드 및 문서 호환을 위해 `useViewerSetting` 이름으로도 export 합니다.
 */
export function usePDFSetting({
  isPDF,
  pdfDocument,
  imageNaturalWidth,
  imageNaturalHeight = null,
  fitMode = 'width',
}: UsePDFSettingParams): UsePDFSettingReturn {
  // 상태
  const [zoomLevel, setZoomLevel] = useState<number>(ZOOM_LEVELS.DEFAULT);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFitWidth, setIsFitWidth] = useState(false);
  const [pdfBaseWidth, setPdfBaseWidth] = useState<number | null>(null);

  // refs
  const viewerContentRef = useRef<HTMLDivElement | null>(null);

  // 줌 액션
  const handleZoomIn = useCallback(() => {
    setIsFitWidth(false); // 수동 줌 조절 시 자동 맞춤 해제
    setZoomLevel((prev) => Math.min(prev + ZOOM_LEVELS.STEP, ZOOM_LEVELS.MAX));
  }, []);

  const handleZoomOut = useCallback(() => {
    setIsFitWidth(false); // 수동 줌 조절 시 자동 맞춤 해제
    setZoomLevel((prev) => Math.max(prev - ZOOM_LEVELS.STEP, ZOOM_LEVELS.MIN));
  }, []);

  const handleZoomReset = useCallback(() => {
    setIsFitWidth(false);
    setZoomLevel(ZOOM_LEVELS.DEFAULT);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((v) => !v);
  }, []);

  // 너비 맞춤 스케일 재계산 및 적용
  const recomputeFitWidth = useCallback(() => {
    if (!isFitWidth) return;
    const availableWidth = viewerContentRef.current?.clientWidth ?? 0;
    const availableHeight = viewerContentRef.current?.clientHeight ?? 0;
    if (availableWidth <= 0) return;

    let contentBaseWidth = 0;
    let contentBaseHeight = 0;
    if (isPDF) {
      contentBaseWidth = pdfBaseWidth ?? 0;
    } else {
      contentBaseWidth = imageNaturalWidth ?? 1024;
      contentBaseHeight = imageNaturalHeight ?? 768;
    }

    if (contentBaseWidth <= 0) return;
    const scaleW = availableWidth > 0 ? availableWidth / contentBaseWidth : 1;
    const scaleH = availableHeight > 0 && contentBaseHeight > 0 ? availableHeight / contentBaseHeight : scaleW;
    const baseScale = fitMode === 'longer-edge' ? Math.max(scaleW, scaleH) : scaleW;
    const rawScale = baseScale * 100;
    const clamped = Math.max(ZOOM_LEVELS.MIN, Math.min(rawScale, ZOOM_LEVELS.MAX));
    setZoomLevel(Math.round(clamped));
  }, [isFitWidth, isPDF, pdfBaseWidth, imageNaturalWidth, imageNaturalHeight, fitMode]);

  const toggleFitWidth = useCallback(() => {
    setIsFitWidth((next) => {
      const v = !next;
      if (v) {
        // requestAnimationFrame으로 다음 프레임에서 실행
        requestAnimationFrame(() => recomputeFitWidth());
      }
      return v;
    });
  }, [recomputeFitWidth]);

  // 현재 컨테이너 크기를 기준으로 "한 번만" 너비 맞춤 수행 (isFitWidth 상태는 변경하지 않음)
  const fitWidthOnce = useCallback(() => {
    const container = viewerContentRef.current;
    if (!container) return;

    const availableWidth = container.clientWidth ?? 0;
    const availableHeight = container.clientHeight ?? 0;
    if (availableWidth <= 0) return;

    const perform = async (): Promise<void> => {
      let contentBaseWidth = 0;
      let contentBaseHeight = 0;

      if (isPDF) {
        if (!pdfDocument) return;
        try {
          const firstPage = await pdfDocument.getPage(1);
          const viewport = firstPage.getViewport({ scale: 1 });
          contentBaseWidth = viewport.width;
        } catch {
          return;
        }
      } else {
        contentBaseWidth = imageNaturalWidth ?? 1024;
        contentBaseHeight = imageNaturalHeight ?? 768;
      }

      if (contentBaseWidth <= 0) return;
      const scaleW = availableWidth / contentBaseWidth;
      const scaleH =
        availableHeight > 0 && contentBaseHeight > 0
          ? availableHeight / contentBaseHeight
          : scaleW;
      const baseScale = fitMode === 'longer-edge' ? Math.max(scaleW, scaleH) : scaleW;
      const rawScale = baseScale * 100;
      const clamped = Math.max(ZOOM_LEVELS.MIN, Math.min(rawScale, ZOOM_LEVELS.MAX));
      setZoomLevel(Math.round(clamped));
    };

    void perform();
  }, [isPDF, pdfDocument, imageNaturalWidth, imageNaturalHeight, fitMode]);

  // 뷰 영역 크기 변화 대응 (ResizeObserver)
  useEffect(() => {
    if (!isFitWidth) return;
    const el = viewerContentRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        requestAnimationFrame(() => recomputeFitWidth());
      }, 100); // 더 긴 디바운스 적용
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (t) clearTimeout(t);
    };
  }, [isFitWidth, recomputeFitWidth]);

  // 컨테이너 ref가 설정되었을 때 초기 계산 수행 (기본적으로 켜져 있는 경우)
  useEffect(() => {
    if (!viewerContentRef.current || !isFitWidth) return;
    // 컨테이너가 준비되면 한 번 계산 수행
    requestAnimationFrame(() => recomputeFitWidth());
  }, [viewerContentRef.current, isFitWidth, recomputeFitWidth]);

  // PDF 문서의 최대 페이지 폭 측정
  useEffect(() => {
    // 초기에는 너비 맞춤이 비활성화되어 있으므로 측정을 건너뜀
    if (!isFitWidth || !pdfDocument) return;
    let cancelled = false;
    const measure = async (): Promise<void> => {
      try {
        // 초기 폭 측정 시 전체 페이지 순회 대신 첫 페이지 기준으로만 측정하여
        // 초기 다중 Range 요청과 CORS preflight를 최소화한다.
        const firstPage = await pdfDocument.getPage(1);
        if (cancelled) return;
        const viewport = firstPage.getViewport({ scale: 1 });
        const firstPageWidth = viewport.width;
        if (!cancelled) {
          setPdfBaseWidth(firstPageWidth);
          // 기본적으로 화면 맞춤이 켜져 있으므로 한 번 계산 수행
          requestAnimationFrame(() => recomputeFitWidth());
        }
      } catch {
        // ignore
      }
    };
    void measure();
    return () => {
      cancelled = true;
    };
  }, [pdfDocument, isFitWidth, recomputeFitWidth]);

  // 사이드바 토글/문서 변경/모드 전환 시 재계산
  useEffect(() => {
    if (isFitWidth) {
      recomputeFitWidth();
    }
  }, [isFitWidth, isSidebarOpen, pdfDocument, recomputeFitWidth]);

  return {
    zoomLevel,
    isSidebarOpen,
    isFitWidth,
    pdfBaseWidth,
    viewerContentRef,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    toggleSidebar,
    toggleFitWidth,
    recomputeFitWidth,
    fitWidthOnce,
  };
}

// 레거시 이름 유지: 기존 문서/코드에서 사용하던 `useViewerSetting` 별칭
export const useViewerSetting = usePDFSetting;



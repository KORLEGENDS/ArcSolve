'use client';

import * as React from 'react';

import type { OverlayLayout } from '@/share/schema/zod/file-zod/layout-zod'
import type { OverlayHoverInfo, PDFViewerHandle } from '../components/viewers/PDFViewer/PDFViewer';

export interface UseOverlayInteractionOptions {
  /** 현재 문서의 레이아웃 데이터 (페이지/블록/텍스트) */
  layout: OverlayLayout | undefined | null;
  /** PDFViewer 핸들 (이미지 캡처용)
   *  viewerRef.current.captureOverlayRegion 사용을 위해 주입
   */
  viewerRef?: React.RefObject<PDFViewerHandle | null>;
}

export interface UseOverlayInteractionResult {
  /** 마지막으로 복사된 블록 ID */
  lastCopiedBlockId: string | null;
  /** 복사 진행 중 여부 */
  copying: boolean;
  /** 방금 복사 완료 상태 (짧은 UX 피드백용) */
  justCopied: boolean;
  /** 호버 정보로 대상 블록의 텍스트를 조회 */
  getTextFromHover: (hover: OverlayHoverInfo | null | undefined) => string | null;
  /** 호버된 블록 텍스트를 클립보드로 복사 */
  copyFromHover: (hover: OverlayHoverInfo | null | undefined) => Promise<boolean>;
  /** 호버된 블록을 이미지(PNG)로 캡처 후 클립보드로 복사 (간결 버전) */
  copyImageFromHover: (
    hover: OverlayHoverInfo | null | undefined
  ) => Promise<boolean>;
  /** 이미지 복사 완료 피드백 상태 */
  justCopiedImage: boolean;
}

/**
 * 오버레이와 상호작용(복사 중심)을 담당하는 훅의 기본 뼈대
 * - 레이아웃 + 호버 정보를 이용해 블록 텍스트를 조회/복사
 */
export function useOverlayInteraction(
  options: UseOverlayInteractionOptions
): UseOverlayInteractionResult {
  const { layout, viewerRef } = options;

  const [lastCopiedBlockId, setLastCopiedBlockId] = React.useState<string | null>(null);
  const [copying, setCopying] = React.useState(false);
  const [justCopied, setJustCopied] = React.useState(false);
  const [justCopiedImage, setJustCopiedImage] = React.useState(false);

  const getTextFromHover = React.useCallback(
    (hover: OverlayHoverInfo | null | undefined): string | null => {
      if (!hover || !layout) return null;
      const pageIndex = Math.max(0, (hover.pageNumber ?? 1) - 1);
      const page = layout.pages?.[pageIndex];
      if (!page || !Array.isArray(page.blocks)) return null;
      const block = page.blocks.find((b) => b.id === hover.id);
      return block?.text ?? null;
    },
    [layout]
  );

  const copyFromHover = React.useCallback(
    async (hover: OverlayHoverInfo | null | undefined): Promise<boolean> => {
      if (copying) return false;
      const text = getTextFromHover(hover);
      if (!text) return false;
      setCopying(true);
      try {
        // navigator.clipboard는 보안 컨텍스트(HTTPS)와 사용자 제스처가 필요
        await navigator.clipboard.writeText(text);
        setLastCopiedBlockId(hover!.id);
        setJustCopied(true);
        window.setTimeout(() => setJustCopied(false), 1200);
        return true;
      } catch {
        return false;
      } finally {
        setCopying(false);
      }
    },
    [copying, getTextFromHover]
  );

  const copyImageFromHover = React.useCallback(
    async (
      hover: OverlayHoverInfo | null | undefined,
    ): Promise<boolean> => {
      if (!hover || !viewerRef?.current) return false;
      try {
        const blob = await viewerRef.current.captureOverlayRegion({
          pageNumber: hover.pageNumber,
          blockId: hover.id,
          targetCssWidth: 1000,
          maxDpr: 1.5,
          paddingPx: 4,
        });
        if (!blob) return false;
        const item = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
        setLastCopiedBlockId(hover.id);
        setJustCopiedImage(true);
        window.setTimeout(() => setJustCopiedImage(false), 1200);
        return true;
      } catch {
        return false;
      }
    },
    [viewerRef]
  );

  return {
    lastCopiedBlockId,
    copying,
    justCopied,
    getTextFromHover,
    copyFromHover,
    copyImageFromHover,
    justCopiedImage,
  };
}



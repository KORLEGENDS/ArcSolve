'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import * as React from 'react';

import { Separator } from '@/client/components/ui/separator';

import { pdfManager } from '@/client/components/arc/ArcData/managers/PDFManager';
import styles from './ArcDataSidebar.module.css';

export interface ArcDataSidebarProps {
  currentPage: number;
  totalPages: number;
  pdfDocument: PDFDocumentProxy | null;
  onPageChange: (pageNumber: number) => void;
  className?: string;
}

/**
 * ArcData PDF 사이드바 (썸네일 네비게이션 전용)
 * - 오버레이/번역 등 부가 기능 없이, 페이지 이동만 담당하는 MVP 버전
 * - TSX / CSS Modules 분리 버전
 */
export function ArcDataSidebar({
  currentPage,
  totalPages,
  pdfDocument,
  onPageChange,
  className,
}: ArcDataSidebarProps): React.ReactElement | null {
  const listRef = React.useRef<HTMLDivElement | null>(null);

  // 현재 페이지가 바뀔 때 활성 썸네일이 보이도록 스크롤 보정
  React.useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const timeoutId = window.setTimeout(() => {
      const active = container.querySelector<HTMLElement>('[data-active="1"]');
      if (!active) return;

      const containerRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();

      const overflowBottom = activeRect.bottom - containerRect.bottom;
      if (overflowBottom > 0) {
        const prefersReduced =
          window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
        container.scrollBy({
          top: overflowBottom,
          behavior: prefersReduced ? 'auto' : 'smooth',
        });
        return;
      }

      const overflowTop = activeRect.top - containerRect.top;
      if (overflowTop < 0) {
        const prefersReduced =
          window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
        container.scrollBy({
          top: overflowTop,
          behavior: prefersReduced ? 'auto' : 'smooth',
        });
      }
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [currentPage]);

  if (!pdfDocument || totalPages <= 0) return null;

  return (
    <div className={`${styles.sidebar} ${className ?? ''}`}>
      <div ref={listRef} className={styles.thumbnailList}>
        {Array.from({ length: totalPages }, (_, index) => {
          const pageNumber = index + 1;
          const isLast = index === totalPages - 1;
          return (
            <React.Fragment key={pageNumber}>
              <ThumbnailItem
                pageNumber={pageNumber}
                isActive={pageNumber === currentPage}
                pdfDocument={pdfDocument}
                onClick={() => onPageChange(pageNumber)}
              />
              {!isLast && (
                <Separator
                  orientation="horizontal"
                  lengthPercent={90}
                  className="my-1"
                  decorative
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

interface ThumbnailItemProps {
  pageNumber: number;
  isActive: boolean;
  pdfDocument: PDFDocumentProxy;
  onClick: () => void;
}

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({
  pageNumber,
  isActive,
  pdfDocument,
  onClick,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // 각 페이지의 썸네일 렌더링 (저해상도 DPR로 메모리 사용 최소화)
  React.useEffect(() => {
    const renderThumbnail = async (): Promise<void> => {
      if (!canvasRef.current) return;

      try {
        const canvas = canvasRef.current;
        const prefix = pdfManager.getEventPrefix(undefined, pdfDocument);
        const eventId = `${prefix}:thumb:${pageNumber}`;

        await pdfManager.renderPage({
          eventId,
          document: pdfDocument,
          pageNumber,
          canvas,
          scale: 0.2,
          maxDpr: 1.5,
        });
      } catch {
        // 썸네일 렌더 실패는 무시 (메인 뷰어에는 영향 없음)
      }
    };

    void renderThumbnail();

    return () => {
      // 해당 문서의 썸네일 렌더 작업만 취소
      const prefix = pdfManager.getEventPrefix(undefined, pdfDocument);
      pdfManager.cancelDocumentRenders(`${prefix}:thumb`);
    };
  }, [pdfDocument, pageNumber]);

  return (
    <button
      type="button"
      onClick={onClick}
      data-active={isActive ? '1' : '0'}
      className={`${styles.thumbnailItem} ${isActive ? styles.active : ''}`}
      aria-label={`페이지 ${pageNumber}`}
    >
      <div className={styles.thumbFrame}>
        <canvas ref={canvasRef} className={styles.thumbnailCanvas} />
      </div>
      <span className={styles.pageLabel}>{pageNumber}</span>
    </button>
  );
};

ArcDataSidebar.displayName = 'ArcDataSidebar';

export default ArcDataSidebar;



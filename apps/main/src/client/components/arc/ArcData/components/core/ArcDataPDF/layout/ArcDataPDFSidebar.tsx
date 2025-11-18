import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import * as React from 'react';

import { Separator } from '@/client/components/ui/separator';
import { ArcDataSidebar } from '../../../base/ArcDataSidebar';
import styles from './ArcDataPDFSidebar.module.css';

export interface ArcDataPDFSidebarProps {
  currentPage: number;
  totalPages: number;
  pdfDocument: PDFDocumentProxy | null;
  onPageChange: (pageNumber: number) => void;
  className?: string;
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

  // 각 페이지의 썸네일 렌더링 (pdf.js Core API 사용, 저해상도 DPR로 메모리 사용 최소화)
  React.useEffect(() => {
    let cancelled = false;

    const renderThumbnail = async (): Promise<void> => {
      if (!canvasRef.current) return;

      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;

        const viewport = page.getViewport({ scale: 0.2 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        const width = Math.max(1, Math.floor(viewport.width));
        const height = Math.max(1, Math.floor(viewport.height));
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const renderTask = page.render({
          canvasContext: context,
          viewport,
          canvas,
        });
        await renderTask.promise;
      } catch {
        // 썸네일 렌더 실패는 무시 (메인 뷰어에는 영향 없음)
      }
    };

    void renderThumbnail();

    return () => {
      cancelled = true;
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

export function ArcDataPDFSidebar({
  currentPage,
  totalPages,
  pdfDocument,
  onPageChange,
  className,
}: ArcDataPDFSidebarProps): React.ReactElement | null {
  if (!pdfDocument || totalPages <= 0) return null;

  const activeIndex = currentPage - 1;

  return (
    <ArcDataSidebar
      itemCount={totalPages}
      activeIndex={activeIndex}
      className={className}
      renderItem={({ index, isActive, isLast }) => {
        const pageNumber = index + 1;
        const handleClick = (): void => {
          onPageChange(pageNumber);
        };

        return (
          <>
            <ThumbnailItem
              pageNumber={pageNumber}
              isActive={isActive}
              pdfDocument={pdfDocument}
              onClick={handleClick}
            />
            {!isLast && (
              <Separator
                orientation="horizontal"
                lengthPercent={90}
                className="my-1"
                decorative
              />
            )}
          </>
        );
      }}
    />
  );
}

ArcDataPDFSidebar.displayName = 'ArcDataPDFSidebar';

export default ArcDataPDFSidebar;




'use client';

import * as React from 'react';

import styles from './ArcDataSidebar.module.css';

export interface ArcDataSidebarProps {
  /** 전체 아이템 수 (0이면 렌더링하지 않음) */
  itemCount: number;
  /** 현재 활성 아이템의 0 기반 인덱스 (없으면 null) */
  activeIndex: number | null;
  /**
   * 아이템 렌더 함수
   * - index: 0 기반 인덱스
   * - isActive: 현재 활성 아이템 여부
   * - isLast: 마지막 아이템 여부
   */
  renderItem: (options: {
    index: number;
    isActive: boolean;
    isLast: boolean;
  }) => React.ReactNode;
  className?: string;
}

/**
 * ArcData 공용 사이드바 레이아웃
 * - 좌측 고정 폭 사이드바와 스크롤 컨테이너를 제공합니다.
 * - 활성 아이템이 보이도록 자동 스크롤 보정을 수행합니다.
 * - 실제 아이템 내용/동작은 renderItem에서 정의합니다.
 */
export function ArcDataSidebar({
  itemCount,
  activeIndex,
  renderItem,
  className,
}: ArcDataSidebarProps): React.ReactElement | null {
  const listRef = React.useRef<HTMLDivElement | null>(null);

  // 활성 아이템이 바뀔 때 해당 아이템이 보이도록 스크롤 보정
  React.useEffect(() => {
    if (activeIndex == null || activeIndex < 0) return;

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
  }, [activeIndex]);

  if (itemCount <= 0) return null;

  return (
    <div className={`${styles.sidebar} ${className ?? ''}`}>
      <div ref={listRef} className={styles.thumbnailList}>
        {Array.from({ length: itemCount }, (_, index) => {
          const isActive = activeIndex === index;
          const isLast = index === itemCount - 1;
          return (
            <div
              key={index}
              data-active={isActive ? '1' : '0'}
              className={styles.itemWrapper}
            >
              {renderItem({ index, isActive, isLast })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

ArcDataSidebar.displayName = 'ArcDataSidebar';

export default ArcDataSidebar;



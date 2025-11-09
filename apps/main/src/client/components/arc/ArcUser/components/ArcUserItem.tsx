'use client';

import * as React from 'react';

import { cn } from '@/client/components/ui/utils';

export interface ArcUserItemProps {
  /**
   * 아이템 제목
   */
  title: string;
  /**
   * 아이템 설명 (연한 글씨로 표시)
   */
  description?: string;
  /**
   * 우측 끝에 표시할 아이콘
   */
  icon?: React.ReactNode;
  /**
   * 추가 클래스명
   */
  className?: string;
  /**
   * 클릭 핸들러
   */
  onClick?: () => void;
}

export function ArcUserItem({
  title,
  description,
  icon,
  className,
  onClick,
}: ArcUserItemProps) {
  return (
    <div
      className={cn(
        'w-full grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-1',
        'text-left rounded-md',
        onClick && 'cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors',
        className
      )}
      onClick={onClick}
    >
      {/* 좌측 열: 위아래 2행 구조 */}
      <div className="flex flex-col gap-0.5 min-w-0">
        {/* 위쪽 행: 제목 */}
        <div className="text-sm font-medium truncate">{title}</div>
        {/* 아래쪽 행: 간략한 설명 (연한 글씨) */}
        {description && (
          <div className="text-xs text-muted-foreground truncate">
            {description}
          </div>
        )}
      </div>
      {/* 우측 끝: 아이콘 (주입 가능) */}
      {icon && (
        <div className="shrink-0">
          {icon}
        </div>
      )}
    </div>
  );
}


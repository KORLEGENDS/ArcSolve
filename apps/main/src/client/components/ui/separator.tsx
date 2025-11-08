'use client';

import * as SeparatorPrimitive from '@radix-ui/react-separator';
import * as React from 'react';

import { cn } from '@/client/components/ui/utils';

type SeparatorProps = React.ComponentProps<typeof SeparatorPrimitive.Root> & {
  /**
   * 구분선의 길이를 % 단위로 지정 (주축 기준)
   * - horizontal: width 퍼센트
   * - vertical: height 퍼센트
   * 기본값: 100
   */
  lengthPercent?: number;
};

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  lengthPercent,
  style,
  ...props
}: SeparatorProps) {
  const isVertical = orientation === 'vertical';
  const percent = lengthPercent ?? 100;

  // 주축 기준 길이 지정: 가로=width, 세로=height (기본 100%)
  const lengthStyle: React.CSSProperties = isVertical
    ? { height: `${percent}%` }
    : { width: `${percent}%` };

  return (
    <div
      data-slot='separator-wrapper'
      className={cn(
        // 가용 가능한 최대 너비/높이 확보
        'w-full flex items-center justify-center',
        isVertical && 'h-full flex-col'
      )}
      // wrapper 자체는 별도 스타일 없음
    >
      <SeparatorPrimitive.Root
        data-slot='separator'
        role='separator'
        decorative={decorative}
        orientation={orientation}
        className={cn(
          // 색상/두께
          'shrink-0 bg-[var(--color-border)]',
          // 가로: 높이 1px
          'data-[orientation=horizontal]:h-px',
          // 세로: 두께 1px
          'data-[orientation=vertical]:w-px',
          className
        )}
        style={{ ...lengthStyle, ...style }}
        {...props}
      />
    </div>
  );
}

export { Separator };

'use client';

import { cn } from '@/client/components/ui/utils';
import * as React from 'react';

export interface CircularProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** 진행률 (0~100). 값이 없으면 indeterminate 모드로 회전 애니메이션 표시 */
  value?: number;
  /** 크기 프리셋 */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** 선 두께(px) - 프리셋 대비 미세 조정 */
  strokeWidth?: number;
  /** 진행률 숫자 라벨 표시 여부 */
  showLabel?: boolean;
}

/**
 * CircularProgress (shadcn 스타일)
 * - determinate: 원형 링 진행률 표시
 * - indeterminate: 값이 없을 때 회전 스피너로 표시
 * - 색상: currentColor 사용 (text-*로 제어)
 */
export const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
  (
    {
      className,
      value,
      size = 'md',
      strokeWidth,
      showLabel = false,
      ...rest
    },
    ref
  ) => {
    const clamped = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : undefined;

    // 크기 프리셋: wrapper 크기, strokeWidth 기본값
    const sizeClass: Record<NonNullable<CircularProgressProps['size']>, string> = {
      xs: 'h-4 w-4',
      sm: 'h-6 w-6',
      md: 'h-8 w-8',
      lg: 'h-10 w-10',
    };
    const defaultStrokeWidth: Record<NonNullable<CircularProgressProps['size']>, number> = {
      xs: 3,
      sm: 3,
      md: 4,
      lg: 4,
    };
    const sw = strokeWidth ?? defaultStrokeWidth[size];

    // SVG는 100x100 뷰박스 사용. 반지름은 stroke를 고려해 50 - sw/2
    const radius = 50 - sw / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset =
      typeof clamped === 'number' ? circumference * (1 - clamped / 100) : 0;

    const isIndeterminate = typeof clamped !== 'number';

    return (
      <div
        ref={ref}
        data-slot='circular-progress'
        role='progressbar'
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={typeof clamped === 'number' ? clamped : undefined}
        className={cn('inline-flex items-center justify-center', sizeClass[size], className)}
        {...rest}
      >
        <div
          className={cn(
            'relative',
            // currentColor 기반으로 트랙/인디케이터 색상 제어
            // 예) text-primary 로 전달 시 인디케이터가 primary 컬러로 렌더링
            isIndeterminate && 'animate-spin'
          )}
          // 회전 기준은 가운데
          style={{ transformOrigin: 'center' }}
        >
          <svg
            viewBox='0 0 100 100'
            className={cn('block', sizeClass[size])}
            aria-hidden='true'
          >
            {/* 트랙 (연한 색) - currentColor 기반, 불투명도만 적용 */}
            <circle
              cx='50'
              cy='50'
              r={radius}
              fill='none'
              className='opacity-20'
              stroke='currentColor'
              strokeWidth={sw}
            />

            {/* 인디케이터 */}
            <circle
              cx='50'
              cy='50'
              r={radius}
              fill='none'
              className='transition-[stroke-dashoffset] duration-150 ease-out'
              stroke='currentColor'
              strokeWidth={sw}
              strokeLinecap='round'
              strokeDasharray={circumference}
              strokeDashoffset={isIndeterminate ? circumference * 0.75 : dashOffset}
              // 12시 방향 시작을 위해 -90도 회전
              transform='rotate(-90 50 50)'
            />
          </svg>

          {showLabel && typeof clamped === 'number' && (
            <span
              className={cn(
                'absolute inset-0 flex select-none items-center justify-center text-[10px] font-medium text-foreground'
              )}
            >
              {Math.round(clamped)}%
            </span>
          )}
        </div>
      </div>
    );
  }
);

CircularProgress.displayName = 'CircularProgress';

export default CircularProgress;



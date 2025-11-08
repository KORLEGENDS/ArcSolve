import { clsx } from 'clsx';
import * as React from 'react';

/**
 * Loading 컴포넌트 Props
 */
export interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 로딩 인디케이터 크기 */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** 로딩 텍스트 */
  text?: string;
  /** 로딩 애니메이션 타입 */
  type?: 'spinner' | 'dots' | 'pulse' | 'bars';
  /** 로딩 변형 */
  variant?: 'default' | 'subtle' | 'glass';
  /** 배경 표시 여부 */
  withBackground?: boolean;
  /** 텍스트 크기 (별도 지정 가능) */
  textSize?: 'sm' | 'md' | 'lg';
  /** 인라인 배치 (텍스트 옆에 자연스럽게 배치) */
  inline?: boolean;
  /** 래퍼 없이 인디케이터만 렌더 (최소 크기/간격) */
  indicatorOnly?: boolean;
}

/**
 * 확장된 Loading 컴포넌트
 * - 다양한 애니메이션 타입 지원 (spinner, dots, pulse, bars)
 * - Gray/Neutral 색상 기반 디자인
 */
const Loading = React.memo(
  React.forwardRef<HTMLDivElement, LoadingProps>(
    (
      {
        size = 'md',
        text,
        type = 'spinner',
        variant = 'default',
        withBackground = false,
        textSize,
        className,
        inline = false,
        indicatorOnly = false,
        ...restProps
      },
      ref
    ) => {
      // 컨테이너 스타일
      const containerClassName = clsx(
        inline
          ? 'inline-flex flex-row items-center gap-1'
          : 'flex flex-col items-center justify-center gap-2',
        withBackground && !indicatorOnly && 'rounded-lg p-6 shadow-sm',
        className
      );

      // 래퍼 사이즈별 스타일
      const wrapperSizeClasses: Record<
        NonNullable<LoadingProps['size']>,
        string
      > = {
        xs: 'w-4 h-4',
        sm: 'w-10 h-10',
        md: 'w-16 h-16',
        lg: 'w-[88px] h-[88px]',
      };

      // 래퍼 변형별 스타일
      const wrapperVariantClasses = {
        default: '',
        subtle: '',
        glass: 'backdrop-blur-sm',
      };

      const wrapperClassName = clsx(
        'relative flex items-center justify-center rounded-full',
        wrapperSizeClasses[size],
        wrapperVariantClasses[variant],
        variant !== 'glass' && 'shadow-inner'
      );

      // 스피너 사이즈별 스타일
      const spinnerSizeClasses: Record<
        NonNullable<LoadingProps['size']>,
        string
      > = {
        xs: 'h-3 w-3 border',
        sm: 'h-6 w-6 border-2',
        md: 'h-10 w-10 border-[3px]',
        lg: 'h-14 w-14 border-4',
      };

      // 도트 사이즈별 스타일
      const dotSizeClasses: Record<
        NonNullable<LoadingProps['size']>,
        string
      > = {
        xs: 'w-1 h-1',
        sm: 'w-1.5 h-1.5',
        md: 'w-2 h-2',
        lg: 'w-2.5 h-2.5',
      };

      // 펄스 사이즈별 스타일
      const pulseSizeClasses: Record<
        NonNullable<LoadingProps['size']>,
        string
      > = {
        xs: 'w-3 h-3',
        sm: 'w-6 h-6',
        md: 'w-10 h-10',
        lg: 'w-14 h-14',
      };

      // 바 사이즈별 스타일
      const barSizeClasses: Record<
        NonNullable<LoadingProps['size']>,
        string
      > = {
        xs: 'w-[2px] h-3',
        sm: 'w-[3px] h-4',
        md: 'w-1 h-6',
        lg: 'w-[5px] h-8',
      };

      // 텍스트 사이즈별 스타일
      const textSizeClasses: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
        xs: 'text-[10px]',
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
      };

      const textClassName = clsx(
        'mt-2 text-center font-normal text-neutral-600',
        textSizeClasses[textSize ?? size]
      );

      // 타입별 애니메이션 렌더링 함수
      const renderAnimation = (): React.ReactNode => {
        switch (type) {
          case 'spinner':
            return (
              <div
                className={clsx(
                  'inline-flex animate-spin items-center justify-center rounded-full border-neutral-200 border-t-neutral-600 border-r-neutral-500',
                  spinnerSizeClasses[size]
                )}
              />
            );

          case 'dots':
            return (
              <div className='flex items-center justify-center gap-1'>
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className={clsx(
                      'animate-pulse rounded-full bg-neutral-600',
                      dotSizeClasses[size]
                    )}
                    style={{
                      animationDelay: `${index * 150}ms`,
                    }}
                  />
                ))}
              </div>
            );

          case 'pulse':
            return (
              <div
                className={clsx(
                  'animate-pulse rounded-full bg-neutral-600',
                  pulseSizeClasses[size]
                )}
              />
            );

          case 'bars':
            return (
              <div className='flex items-center justify-center gap-1'>
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className={clsx(
                      'origin-center animate-pulse rounded-[2px] bg-neutral-600',
                      barSizeClasses[size]
                    )}
                    style={{
                      animationDelay: `${index * 150}ms`,
                      animationDuration: '1.2s',
                    }}
                  />
                ))}
              </div>
            );

          default:
            return (
              <div
                className={clsx(
                  'animate-spin rounded-full border-neutral-200 border-t-neutral-600',
                  spinnerSizeClasses[size]
                )}
              />
            );
        }
      };

      return (
        <div
          ref={ref}
          className={containerClassName}
          role='status'
          aria-live='polite'
          aria-busy={true}
          aria-label={text ?? '로딩 중'}
          {...restProps}
        >
          {indicatorOnly ? (
            renderAnimation()
          ) : (
            <div className={wrapperClassName}>{renderAnimation()}</div>
          )}
          {text && (
            <span className={textClassName} aria-hidden='true'>
              {text}
            </span>
          )}
        </div>
      );
    }
  )
);

Loading.displayName = 'Loading';

export { Loading };

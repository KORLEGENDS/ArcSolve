'use client';

import type { CSSProperties } from 'react';
import { memo } from 'react';

export interface ResponsePreparingProps {
  label?: string;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export const ResponsePreparing = memo(({ label = '생각 중', color, className, style }: ResponsePreparingProps) => {
  return (
    <div
      role='status'
      aria-live='polite'
      className={`brand-wave inline-flex items-center gap-2 text-sm ${color ? '' : 'text-current'} ${className ?? ''}`}
      style={color ? { color, ...style } : style}
    >
      <span>{label}</span>
    </div>
  );
});

ResponsePreparing.displayName = 'ResponsePreparing';



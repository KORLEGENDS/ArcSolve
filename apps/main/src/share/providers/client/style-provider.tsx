'use client';

import type { ReactNode } from 'react';

interface StyleProviderProps {
  children: ReactNode;
}

export function StyleProvider({ children }: StyleProviderProps): ReactNode {
  return (
    <>
      {/* 전역 SVG gradient defs: 아이콘 stroke/fill 재사용 */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="ai-stroke" x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--ai-from)" />
            <stop offset="100%" stopColor="var(--ai-to)" />
          </linearGradient>
        </defs>
      </svg>
      {children}
    </>
  );
}


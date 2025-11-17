'use client';

import * as React from 'react';

import {
  Toolbar,
} from '@/client/components/ui/toolbar';
import { cn } from '@/client/components/ui/utils';
import styles from './ArcDataTopbar.module.css';

export interface ArcDataTopbarProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * ArcData 공용 상단 툴바 레이아웃
 * - 상단 Toolbar 컨테이너와 기본 높이만 정의합니다.
 * - 실제 PDF/이미지 등 도메인별 액션은 상위에서 children으로 구성합니다.
 */
export function ArcDataTopbar({
  className,
  children,
}: ArcDataTopbarProps): React.ReactElement {
  return (
    <Toolbar className={cn(styles.topbar, className)}>
      {children}
    </Toolbar>
  );
}

ArcDataTopbar.displayName = 'ArcDataTopbar';

export default ArcDataTopbar;



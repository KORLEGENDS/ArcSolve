'use client';

import * as React from 'react';

import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from '@/client/components/ui/toolbar';
import { cn } from '@/client/components/ui/utils';
import { iconFromToken } from '@/share/configs/icons/icon-utils';
import styles from './ArcDataTopbar.module.css';

export interface ArcDataTopbarProps {
  zoomLevel: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  isFitWidth: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** 퍼센트 텍스트 클릭 시 '일시적' 너비 맞춤 */
  onFitWidthOnce: () => void;
  onFitWidthToggle: () => void;
  className?: string;
}

/**
 * ArcData 상단 툴바 (MVP)
 * - 확대 / 축소 / 너비 맞춤만 제공
 */
export function ArcDataTopbar({
  zoomLevel,
  canZoomIn,
  canZoomOut,
  isFitWidth,
  onZoomIn,
  onZoomOut,
  onFitWidthOnce,
  onFitWidthToggle,
  className,
}: ArcDataTopbarProps): React.ReactElement {
  return (
    <Toolbar className={cn(styles.topbar, className)}>
      <ToolbarGroup>
        <ToolbarButton
          size="sm"
          onClick={onZoomOut}
          disabled={!canZoomOut}
          tooltip="축소"
          aria-label="축소"
        >
          {iconFromToken('arc.service.arcViewer.toolbar.zoom.out', { className: 'size-4' })}
        </ToolbarButton>

        {/* 현재 줌 비율: 클릭 시 컨테이너 기준으로 한 번만 너비 맞춤 수행 (isFitWidth 상태는 변경하지 않음) */}
        <button
          type="button"
          className={styles.zoomLabel}
          onClick={onFitWidthOnce}
        >
          {zoomLevel}%
        </button>

        <ToolbarButton
          size="sm"
          onClick={onZoomIn}
          disabled={!canZoomIn}
          tooltip="확대"
          aria-label="확대"
        >
          {iconFromToken('arc.service.arcViewer.toolbar.zoom.in', { className: 'size-4' })}
        </ToolbarButton>

        <ToolbarSeparator />

        <ToolbarButton
          size="sm"
          pressed={isFitWidth}
          onClick={onFitWidthToggle}
          tooltip={isFitWidth ? '너비 맞춤 해제' : '너비 맞춤'}
          aria-label="너비 맞춤"
        >
          {iconFromToken('arc.service.arcViewer.toolbar.zoom.fitWidth', { className: 'size-4' })}
        </ToolbarButton>
      </ToolbarGroup>
    </Toolbar>
  );
}

ArcDataTopbar.displayName = 'ArcDataTopbar';

export default ArcDataTopbar;



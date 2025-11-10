'use client';

import type { DragRectRenderCallback } from 'flexlayout-react';
import * as React from 'react';

export interface ArcWorkDragRectProps {
  /**
   * 드래그 사각형의 스타일 속성
   */
  style: React.CSSProperties;
}

/**
 * 드래그 사각형 렌더링 커스터마이징 컴포넌트
 * onRenderDragRect 콜백에서 사용됩니다
 */
export function ArcWorkDragRect({ style }: ArcWorkDragRectProps) {
  return (
    <div
      style={{
        ...style,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '2px dashed rgba(59, 130, 246, 0.5)',
        borderRadius: '4px',
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * 드래그 사각형 렌더링 콜백 생성 함수
 */
export function createDragRectRenderCallback(
  customRenderer?: DragRectRenderCallback
): DragRectRenderCallback {
  return (rect) => {
    // 커스텀 렌더러가 있으면 사용
    if (customRenderer) {
      return customRenderer(rect);
    }

    // 기본 ArcWorkDragRect 렌더링
    return <ArcWorkDragRect style={rect} />;
  };
}


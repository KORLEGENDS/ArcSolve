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
        position: 'absolute',
        left: typeof style.left === 'number' ? `${style.left}px` : style.left,
        top: typeof style.top === 'number' ? `${style.top}px` : style.top,
        width: typeof style.width === 'number' ? `${style.width}px` : style.width,
        height: typeof style.height === 'number' ? `${style.height}px` : style.height,
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
  return (content, node, json) => {
    // 커스텀 렌더러가 있으면 사용
    if (customRenderer) {
      return customRenderer(content, node, json);
    }

    // 기본 content를 그대로 반환 (flexlayout-react가 내부적으로 스타일을 관리)
    return content;
  };
}


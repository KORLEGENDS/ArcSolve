'use client';

import type { TabSetPlaceHolderCallback } from 'flexlayout-react';
import * as React from 'react';

export interface ArcWorkTabSetPlaceholderProps {
  /**
   * 탭셋 노드
   */
  node: Parameters<TabSetPlaceHolderCallback>[0];
}

/**
 * 빈 탭셋 플레이스홀더 커스터마이징 컴포넌트
 * onTabSetPlaceHolder 콜백에서 사용됩니다
 */
export function ArcWorkTabSetPlaceholder({ node }: ArcWorkTabSetPlaceholderProps) {
  return (
    <div className="flex items-center justify-center h-full w-full text-muted-foreground">
      <div className="text-center">
        <p className="text-sm">탭을 여기로 드래그하세요</p>
      </div>
    </div>
  );
}

/**
 * 탭셋 플레이스홀더 콜백 생성 함수
 */
export function createTabSetPlaceholderCallback(
  customRenderer?: TabSetPlaceHolderCallback
): TabSetPlaceHolderCallback {
  return (node) => {
    // 커스텀 렌더러가 있으면 사용
    if (customRenderer) {
      return customRenderer(node);
    }

    // 기본 ArcWorkTabSetPlaceholder 렌더링
    return <ArcWorkTabSetPlaceholder node={node} />;
  };
}


'use client';

import type { ShowOverflowMenuCallback } from 'flexlayout-react';
import * as React from 'react';

export interface ArcWorkOverflowMenuProps {
  /**
   * 탭셋 노드
   */
  tabSetNode: Parameters<ShowOverflowMenuCallback>[0];
  /**
   * 탭 노드들
   */
  tabs: Parameters<ShowOverflowMenuCallback>[1];
  /**
   * 메뉴를 표시할 위치
   */
  onSelectItem: Parameters<ShowOverflowMenuCallback>[2];
}

/**
 * 오버플로우 메뉴 커스터마이징 컴포넌트
 * onShowOverflowMenu 콜백에서 사용됩니다
 */
export function ArcWorkOverflowMenu({ tabSetNode, tabs, onSelectItem }: ArcWorkOverflowMenuProps) {
  // 기본 구현은 flexlayout-react가 처리하므로
  // 여기서는 커스터마이징 로직만 구현합니다

  return null;
}

/**
 * 오버플로우 메뉴 콜백 생성 함수
 */
export function createOverflowMenuCallback(
  customRenderer?: ShowOverflowMenuCallback
): ShowOverflowMenuCallback {
  return (tabSetNode, tabs, onSelectItem) => {
    // 커스텀 렌더러가 있으면 사용
    if (customRenderer) {
      customRenderer(tabSetNode, tabs, onSelectItem);
      return;
    }

    // 기본 ArcWorkOverflowMenu 로직 실행
    // 필요시 여기에 공통 커스터마이징 로직 추가
  };
}


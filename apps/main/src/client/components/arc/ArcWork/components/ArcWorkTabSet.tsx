'use client';

import type { BorderNode, ITabSetRenderValues, TabSetNode } from 'flexlayout-react';

export interface ArcWorkTabSetProps {
  /**
   * 탭셋 노드 또는 보더 노드
   */
  tabSetNode: TabSetNode | BorderNode;
  /**
   * 렌더링 값
   */
  renderValues: ITabSetRenderValues;
}

/**
 * 탭셋 렌더링 커스터마이징 컴포넌트
 * onRenderTabSet 콜백에서 사용됩니다
 */
export function ArcWorkTabSet({ tabSetNode, renderValues }: ArcWorkTabSetProps) {
  // 기본 렌더링은 flexlayout-react가 처리하므로
  // 여기서는 커스터마이징 로직만 구현합니다
  // renderValues를 수정하여 스타일이나 내용을 변경할 수 있습니다

  return null;
}

/**
 * 탭셋 렌더링 콜백 생성 함수
 */
export function createTabSetRenderCallback(
  customRenderer?: (tabSetNode: TabSetNode | BorderNode, renderValues: ITabSetRenderValues) => void
) {
  return (tabSetNode: TabSetNode | BorderNode, renderValues: ITabSetRenderValues) => {
    // 커스텀 렌더러가 있으면 먼저 실행
    if (customRenderer) {
      customRenderer(tabSetNode, renderValues);
    }

    // 기본 ArcWorkTabSet 로직 실행
    // 필요시 여기에 공통 커스터마이징 로직 추가
  };
}


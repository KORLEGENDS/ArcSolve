'use client';

import type { ITabRenderValues, TabNode } from 'flexlayout-react';
import * as React from 'react';

export interface ArcWorkTabProps {
  /**
   * 탭 노드
   */
  node: TabNode;
  /**
   * 렌더링 값
   */
  renderValues: ITabRenderValues;
}

/**
 * 탭 렌더링 커스터마이징 컴포넌트
 * onRenderTab 콜백에서 사용됩니다
 */
export function ArcWorkTab({ node, renderValues }: ArcWorkTabProps) {
  // 기본 렌더링은 flexlayout-react가 처리하므로
  // 여기서는 커스터마이징 로직만 구현합니다
  // renderValues를 수정하여 스타일이나 내용을 변경할 수 있습니다

  return null;
}

/**
 * 탭 렌더링 콜백 생성 함수
 */
export function createTabRenderCallback(
  customRenderer?: (node: TabNode, renderValues: ITabRenderValues) => void
) {
  return (node: TabNode, renderValues: ITabRenderValues) => {
    // 커스텀 렌더러가 있으면 먼저 실행
    if (customRenderer) {
      customRenderer(node, renderValues);
    }

    // 기본 ArcWorkTab 로직 실행
    // 필요시 여기에 공통 커스터마이징 로직 추가
  };
}


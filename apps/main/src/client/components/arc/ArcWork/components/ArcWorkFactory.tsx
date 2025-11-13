'use client';

import type { TabNode } from 'flexlayout-react';
import * as React from 'react';

export interface ArcWorkFactoryProps {
  /**
   * 팩토리 함수 - 탭 컴포넌트를 생성합니다
   */
  factory?: (node: TabNode) => React.ReactNode;
}

/**
 * 팩토리 함수 타입
 */
export type ArcWorkFactory = (node: TabNode) => React.ReactNode;

/**
 * 기본 팩토리 함수
 */
export function defaultArcWorkFactory(node: TabNode): React.ReactNode {
  const component = node.getComponent();

  if (component === 'placeholder') {
    return <div className="p-4">{node.getName()}</div>;
  }

  return null;
}

/**
 * 팩토리 함수 생성 함수
 */
export function createFactory(
  customFactory?: (node: TabNode) => React.ReactNode
): (node: TabNode) => React.ReactNode {
  return (node: TabNode) => {
    // 커스텀 팩토리가 있으면 먼저 시도
    if (customFactory) {
      const result = customFactory(node);
      if (result !== null && result !== undefined) {
        return result;
      }
    }

    // 기본 팩토리 실행
    return defaultArcWorkFactory(node);
  };
}


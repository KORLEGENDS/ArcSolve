'use client';

import { iconFromToken } from '@/share/configs/icons/icon-utils';
import type { ITabRenderValues, TabNode } from 'flexlayout-react';
import { useArcWorkTabDirty } from '@/client/states/stores/arcwork-tab-store';

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
 * 컴포넌트 타입에 따른 아이콘 토큰 반환
 */
function getIconToken(component: string): string {
  switch (component) {
    case 'arcnote':
      return 'arc.core.arcWork.tab.components.arcnote';
    case 'arcviewer':
      return 'arc.core.arcWork.tab.components.arcviewer';
    case 'arcchat':
      return 'arc.core.arcWork.tab.components.arcchat';
    default:
      return 'arc.core.arcWork.tab.components.default';
  }
}

/**
 * 탭 렌더링 커스터마이징 컴포넌트
 * onRenderTab 콜백에서 사용됩니다
 * 
 * 커스터마이징 가능한 모든 속성:
 * - renderValues.leading: 탭 앞쪽 아이콘/요소
 * - renderValues.content: 탭 텍스트/컨텐츠
 * - renderValues.buttons: 탭 뒤쪽 버튼 배열
 */
export function ArcWorkTab({ node, renderValues }: ArcWorkTabProps) {
  const component = node.getComponent() || 'default-panel';
  const iconToken = getIconToken(component);

  // ============================================
  // leading: 탭 앞쪽 아이콘 설정
  // ============================================
  // 기본값: 컴포넌트 타입에 따른 아이콘
  // 커스터마이징: renderValues.leading을 직접 수정하여 변경 가능
  if (!renderValues.leading) {
    renderValues.leading = (
      <span className="flexlayout__tab_leading">
        {iconFromToken(iconToken, { size: 14, className: 'flexlayout__tab_leading_icon' })}
      </span>
    );
  }

  // ============================================
  // content: 탭 텍스트/컨텐츠 설정
  // ============================================
  // 기본값: node.getName() (flexlayout-react가 자동 설정)
  // 커스터마이징: renderValues.content를 수정하여 변경 가능
  // 예: renderValues.content = `${node.getName()} *`; (dirty 표시)
  // 예: renderValues.content = <CustomComponent />; (커스텀 컴포넌트)
  // 현재는 기본값 사용 (변경 필요시 주석 해제)
  // if (isDirty) {
  //   renderValues.content = `${renderValues.content} *`;
  // }

  // ============================================
  // buttons: 탭 뒤쪽 버튼 배열 설정
  // ============================================
  // 기본값: 빈 배열 (flexlayout-react가 기본 닫기 버튼 추가)
  // 커스터마이징: renderValues.buttons.push()로 버튼 추가 가능
  // 주의: 기본 닫기 버튼은 flexlayout-react가 자동으로 추가하므로
  // 여기서 추가하는 버튼은 그 뒤에 표시됩니다
  renderValues.buttons = [
    <ArcWorkDirtyIndicator key="arcwork-dirty-indicator" tabId={node.getId()} />,
    ...(renderValues.buttons ?? []),
  ];

  return null;
}

function ArcWorkDirtyIndicator({ tabId }: { tabId: string }) {
  const isDirty = useArcWorkTabDirty(tabId);
  if (!isDirty) return null;

  return (
    <span className="flexlayout__tab_dirty_indicator" aria-hidden="true">
      {iconFromToken('arc.core.arcWork.tab.dirty', {
        className: 'flexlayout__tab_dirty_icon',
      })}
    </span>
  );
}

/**
 * 탭 렌더링 콜백 생성 함수
 */
export function createTabRenderCallback(
  customRenderer?: (node: TabNode, renderValues: ITabRenderValues) => void
) {
  return (node: TabNode, renderValues: ITabRenderValues) => {
    // 기본 ArcWorkTab 로직 먼저 실행
    ArcWorkTab({ node, renderValues });

    // 커스텀 렌더러가 있으면 실행
    if (customRenderer) {
      customRenderer(node, renderValues);
    }
  };
}


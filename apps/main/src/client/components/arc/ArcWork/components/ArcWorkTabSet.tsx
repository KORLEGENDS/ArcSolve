'use client';

import { Button } from '@/client/components/ui/button';
import { useArcWorkLayoutStore } from '@/client/states/stores/arcwork-layout-store';
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
 * 
 * 커스터마이징 가능한 모든 속성:
 * - renderValues.leading: 탭셋 앞쪽 요소 (탭 앞에 표시)
 * - renderValues.stickyButtons: 고정 버튼 배열 (탭 앞에 고정)
 * - renderValues.buttons: 탭셋 뒤쪽 버튼 배열 (탭 뒤에 표시)
 * - renderValues.overflowPosition: 오버플로우 버튼 위치 (기본값: stickyButtons 뒤)
 */
export function ArcWorkTabSet({ tabSetNode, renderValues }: ArcWorkTabSetProps) {
  // ============================================
  // leading: 탭셋 앞쪽 요소 설정
  // ============================================
  // 기본값: undefined (표시 안 함)
  // 커스터마이징: renderValues.leading을 설정하여 탭 앞에 요소 추가 가능
  // 예: renderValues.leading = <CustomHeader />;
  // 현재는 기본값 사용 (변경 필요시 주석 해제)
  // if (!renderValues.leading) {
  //   renderValues.leading = <div className="flexlayout__tabset_leading">Custom Header</div>;
  // }

  // ============================================
  // stickyButtons: 고정 버튼 배열 설정
  // ============================================
  // 기본값: 빈 배열
  // 커스터마이징: renderValues.stickyButtons.push()로 버튼 추가 가능
  // 특징: 탭 앞에 고정되어 스크롤해도 항상 보임
  // 예: "새 탭 추가" 버튼 등
  // 현재는 기본값 사용 (변경 필요시 주석 해제)
  // renderValues.stickyButtons.push(
  //   <button
  //     key="add-tab"
  //     className="flexlayout__tab_toolbar_button"
  //     title="새 탭 추가"
  //     onClick={() => {
  //       // 새 탭 추가 로직
  //     }}
  //   >
  //     <Plus size={14} />
  //   </button>
  // );

  // ============================================
  // buttons: 탭셋 뒤쪽 버튼 배열 설정
  // ============================================
  // 기본값: 빈 배열 (flexlayout-react가 기본 버튼 추가)
  // 커스터마이징: renderValues.buttons.push()로 버튼 추가 가능
  // 특징: 탭 뒤에 표시되며, 탭이 많아지면 스크롤됨
  // 예: 설정 버튼, 메뉴 버튼 등
  // 현재는 기본값 사용 (변경 필요시 주석 해제)
  // renderValues.buttons.push(
  //   <button
  //     key="settings"
  //     className="flexlayout__tab_toolbar_button"
  //     title="설정"
  //     onClick={() => {
  //       // 설정 로직
  //     }}
  //   >
  //     {iconFromToken('arc.core.arcWork.header.prefix.menu', { size: 14 })}
  //   </button>
  // );

  // ============================================
  // overflowPosition: 오버플로우 버튼 위치 설정
  // ============================================
  // 기본값: undefined (stickyButtons 뒤에 자동 배치)
  // 커스터마이징: 숫자로 설정하여 특정 위치에 배치 가능
  // 예: 0 = 맨 앞, 1 = 첫 번째 버튼 뒤, 등
  // 현재는 기본값 사용 (변경 필요시 주석 해제)
  // renderValues.overflowPosition = 0; // 맨 앞에 배치

  // ArcWork 헤더: '새 탭 추가' 버튼
  const nodeType = (tabSetNode as any).getType?.();
  const isTabSet = nodeType === 'tabset';

  if (isTabSet) {
    renderValues.stickyButtons.push(
      <Button
        key="arcwork-add-tab"
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-2xl"
        title="새 탭 추가"
        onClick={() => {
          const { open } = useArcWorkLayoutStore.getState();
          const id = `arcwork-placeholder-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;

          open({
            id,
            name: '새 탭',
            type: 'arcwork-placeholder',
            tabsetId: (tabSetNode as TabSetNode).getId(),
          });
        }}
      >
        +
      </Button>,
    );
  }

  return null;
}

/**
 * 탭셋 렌더링 콜백 생성 함수
 */
export function createTabSetRenderCallback(
  customRenderer?: (tabSetNode: TabSetNode | BorderNode, renderValues: ITabSetRenderValues) => void
) {
  return (tabSetNode: TabSetNode | BorderNode, renderValues: ITabSetRenderValues) => {
    // 기본 ArcWorkTabSet 로직 먼저 실행
    ArcWorkTabSet({ tabSetNode, renderValues });

    // 커스텀 렌더러가 있으면 실행
    if (customRenderer) {
      customRenderer(tabSetNode, renderValues);
    }
  };
}


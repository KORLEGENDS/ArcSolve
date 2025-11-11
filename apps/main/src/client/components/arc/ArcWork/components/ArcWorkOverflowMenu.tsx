'use client';

import type { BorderNode, ShowOverflowMenuCallback, TabNode, TabSetNode } from 'flexlayout-react';
import * as React from 'react';

export interface ArcWorkOverflowMenuProps {
  /**
   * 탭셋 노드 또는 보더 노드
   */
  tabSetNode: TabSetNode | BorderNode;
  /**
   * 마우스 이벤트 (메뉴를 표시할 위치 정보 포함)
   */
  mouseEvent: React.MouseEvent<HTMLElement, MouseEvent>;
  /**
   * 숨겨진 탭들의 배열 (index와 node를 포함)
   */
  items: Array<{
    index: number;
    node: TabNode;
  }>;
  /**
   * 탭 선택 시 호출되는 콜백 함수
   */
  onSelect: (item: { index: number; node: TabNode }) => void;
}

/**
 * 오버플로우 메뉴 커스터마이징 컴포넌트
 * onShowOverflowMenu 콜백에서 사용됩니다
 * 
 * 커스터마이징 가능한 모든 사항:
 * - 커스텀 메뉴 UI 렌더링 (드롭다운, 팝오버 등)
 * - 메뉴 아이템 커스터마이징 (아이콘, 텍스트, 스타일)
 * - 메뉴 위치 및 스타일 조정 (mouseEvent.clientX, clientY 사용)
 * - 추가 액션 버튼 (닫기, 이동 등)
 * - 아이템 필터링 또는 정렬
 * 
 * 주의: ShowOverflowMenuCallback은 void를 반환해야 하므로,
 * 메뉴 렌더링은 포털이나 전역 상태를 통해 처리해야 합니다.
 * 아무것도 하지 않으면 flexlayout-react의 기본 메뉴가 표시됩니다.
 */
export function ArcWorkOverflowMenu({
  tabSetNode,
  mouseEvent,
  items,
  onSelect,
}: ArcWorkOverflowMenuProps) {
  // ============================================
  // 기본 동작: 기본 메뉴 사용 (아무것도 하지 않음)
  // ============================================
  // 기본값: 아무것도 하지 않으면 flexlayout-react의 기본 메뉴가 표시됩니다
  // 커스터마이징: 커스텀 메뉴를 렌더링하려면 포털이나 전역 상태를 사용해야 합니다
  //
  // 예제: 커스텀 메뉴 렌더링 (포털 사용)
  // import { createPortal } from 'react-dom';
  // import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/client/components/ui/dropdown-menu';
  //
  // const handleSelect = (item: { index: number; node: TabNode }) => {
  //   // 탭 활성화
  //   onSelect(item);
  //   // 추가 로직 (예: 로그, 분석 등)
  // };
  //
  // // 메뉴 위치 계산
  // const menuStyle: React.CSSProperties = {
  //   position: 'fixed',
  //   left: mouseEvent.clientX,
  //   top: mouseEvent.clientY,
  //   zIndex: 1000,
  // };
  //
  // // 포털을 통해 메뉴 렌더링
  // const menuElement = (
  //   <div style={menuStyle} className="custom-overflow-menu">
  //     {items.map((item) => (
  //       <div
  //         key={item.node.getId()}
  //         onClick={() => handleSelect(item)}
  //         className="menu-item"
  //       >
  //         {item.node.getName()}
  //       </div>
  //     ))}
  //   </div>
  // );
  //
  // // 포털로 렌더링 (실제 구현은 createOverflowMenuCallback에서 처리)
  // return undefined; // void 반환

  // 현재는 기본 메뉴 사용 (아무것도 하지 않음)
  // 커스터마이징이 필요한 경우 createOverflowMenuCallback에서 처리
}

/**
 * 오버플로우 메뉴 콜백 생성 함수
 * 
 * 커스터마이징 가능한 파라미터:
 * - tabSetNode: 탭셋 또는 보더 노드 (탭셋 정보 접근)
 * - mouseEvent: 마우스 이벤트 (메뉴 위치: clientX, clientY)
 * - items: 숨겨진 탭 배열 (각 항목은 { index, node } 형태)
 * - onSelect: 탭 선택 콜백 (item을 받아서 호출)
 * 
 * @param customRenderer - 커스텀 메뉴 렌더러 (선택사항)
 * @returns ShowOverflowMenuCallback 함수
 */
export function createOverflowMenuCallback(
  customRenderer?: ShowOverflowMenuCallback
): ShowOverflowMenuCallback {
  return (tabSetNode, mouseEvent, items, onSelect) => {
    // 기본 ArcWorkOverflowMenu 로직 먼저 실행
    // (현재는 기본 동작만 수행)
    ArcWorkOverflowMenu({
      tabSetNode,
      mouseEvent,
      items,
      onSelect,
    });

    // 커스텀 렌더러가 있으면 실행
    if (customRenderer) {
      customRenderer(tabSetNode, mouseEvent, items, onSelect);
      return;
    }

    // 기본값: 아무것도 하지 않으면 flexlayout-react의 기본 메뉴 사용
    // 
    // 커스터마이징 예제:
    // if (items.length > 0) {
    //   // 커스텀 메뉴 렌더링
    //   const menuElement = document.createElement('div');
    //   menuElement.className = 'custom-overflow-menu';
    //   menuElement.style.position = 'fixed';
    //   menuElement.style.left = `${mouseEvent.clientX}px`;
    //   menuElement.style.top = `${mouseEvent.clientY}px`;
    //   menuElement.style.zIndex = '1000';
    //   
    //   items.forEach((item) => {
    //     const menuItem = document.createElement('div');
    //     menuItem.textContent = item.node.getName();
    //     menuItem.onclick = () => {
    //       onSelect(item);
    //       document.body.removeChild(menuElement);
    //     };
    //     menuElement.appendChild(menuItem);
    //   });
    //   
    //   document.body.appendChild(menuElement);
    //   
    //   // 외부 클릭 시 메뉴 닫기
    //   const closeMenu = (e: MouseEvent) => {
    //     if (!menuElement.contains(e.target as Node)) {
    //       document.body.removeChild(menuElement);
    //       document.removeEventListener('click', closeMenu);
    //     }
    //   };
    //   setTimeout(() => document.addEventListener('click', closeMenu), 0);
    // }
  };
}


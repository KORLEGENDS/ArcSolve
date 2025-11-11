'use client';

import type { IIcons } from 'flexlayout-react';
import {
  ChevronRight,
  Circle,
  ExternalLink,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  X,
  XCircle,
} from 'lucide-react';

/**
 * 기본 아이콘 설정
 * flexlayout-react의 모든 커스터마이징 가능한 아이콘을 lucide-react 아이콘으로 매핑합니다
 */
export const defaultArcWorkIcons: IIcons = {
  /**
   * 탭 닫기 아이콘
   * 개별 탭의 닫기 버튼에 사용됩니다
   */
  close: <X size={16} />,

  /**
   * 탭셋 닫기 아이콘
   * 탭셋 전체를 닫는 버튼에 사용됩니다
   */
  closeTabset: <XCircle size={16} />,

  /**
   * 팝아웃 아이콘
   * 탭을 별도 창으로 분리할 때 사용됩니다
   */
  popout: <ExternalLink size={16} />,

  /**
   * 최대화 아이콘
   * 탭셋을 최대화할 때 사용됩니다
   */
  maximize: <Maximize2 size={16} />,

  /**
   * 복원 아이콘
   * 최대화된 탭셋을 원래 크기로 복원할 때 사용됩니다
   */
  restore: <Minimize2 size={16} />,

  /**
   * 더보기/오버플로우 메뉴 아이콘
   * 숨겨진 탭들을 표시하는 메뉴 버튼에 사용됩니다
   */
  more: <MoreHorizontal size={16} />,

  /**
   * 엣지 화살표 아이콘
   * 엣지 도킹 영역을 표시할 때 사용됩니다
   */
  edgeArrow: <ChevronRight size={16} />,

  /**
   * 활성 탭셋 표시 아이콘
   * 현재 활성화된 탭셋을 표시할 때 사용됩니다
   */
  activeTabset: <Circle size={12} fill="currentColor" />,
};

/**
 * 아이콘 설정 생성 함수
 * 커스텀 아이콘을 병합하여 최종 아이콘 설정을 생성합니다
 */
export function createIconsConfig(customIcons?: Partial<IIcons>): IIcons {
  return {
    ...defaultArcWorkIcons,
    ...customIcons,
  };
}


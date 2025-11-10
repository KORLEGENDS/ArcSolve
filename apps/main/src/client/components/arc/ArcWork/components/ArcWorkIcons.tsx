'use client';

import type { IIcons } from 'flexlayout-react';
import * as React from 'react';

/**
 * 기본 아이콘 설정
 * flexlayout-react의 기본 아이콘을 커스터마이징할 수 있습니다
 */
export const defaultArcWorkIcons: IIcons = {
  // 필요시 여기에 커스텀 아이콘 추가
  // 예: close: <CloseIcon />,
};

/**
 * 아이콘 설정 생성 함수
 */
export function createIconsConfig(customIcons?: Partial<IIcons>): IIcons {
  return {
    ...defaultArcWorkIcons,
    ...customIcons,
  };
}


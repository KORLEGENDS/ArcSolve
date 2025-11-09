'use client';

import * as React from 'react';
import s from './ArcSide.module.css';
import { Sidebar as SidebarBase, useSidebar } from './components';

function LeftSidebar({ children }: { children?: React.ReactNode }): React.ReactElement {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  return (
    <SidebarBase side='left' collapsible='icon'>
      <SidebarBase.Header>
        <div className={`${s.headerRow} ${s.left} ${isCollapsed ? s.collapsed : s.expanded}`}>
          <SidebarBase.Trigger className={s.trigger} />
        </div>
      </SidebarBase.Header>
      {children}
      <SidebarBase.Rail direction='right' />
    </SidebarBase>
  );
}

function RightSidebar({ children }: { children?: React.ReactNode }): React.ReactElement {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  return (
    <SidebarBase side='right' collapsible='icon'>
      <SidebarBase.Header>
        <div className={`${s.headerRow} ${s.right} ${isCollapsed ? s.collapsed : s.expanded}`}>
          <SidebarBase.Trigger className={s.trigger} />
        </div>
      </SidebarBase.Header>
      {children}
      <SidebarBase.Rail direction='left' />
    </SidebarBase>
  );
}

// 네임스페이스 패턴 적용: Sidebar.Left, Sidebar.Right로 사용 가능
// Sidebar에 Left와 Right 속성 추가
Object.assign(SidebarBase, {
  Left: LeftSidebar,
  Right: RightSidebar,
});

// 타입 확장된 Sidebar를 export
export const Sidebar = SidebarBase as typeof SidebarBase & {
  Left: typeof LeftSidebar;
  Right: typeof RightSidebar;
};

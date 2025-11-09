'use client';

import * as React from 'react';
import s from './ArcSide.module.css';
import { Sidebar as SidebarBase, SidebarProvider, useSidebar } from './components/core';

function LeftSidebar({
  expanded,
  collapsed,
  header,
}: {
  expanded: React.ReactNode;
  collapsed?: React.ReactNode;
  header?: React.ReactNode;
}): React.ReactElement {
  const sidebarState = useSidebar();
  const isCollapsed = sidebarState.state === 'collapsed';

  return (
    <SidebarBase side='left'>
      <SidebarBase.Header>
        <div className={`${s.headerRow} ${s.left} ${!isCollapsed ? s.open : ''}`}>
          <div className={s.headerTrigger}>
          <SidebarBase.Trigger className={s.trigger} />
          </div>
          {header && !isCollapsed && <div className={s.headerContent}>{header}</div>}
        </div>
      </SidebarBase.Header>
      <SidebarBase.Content>
        {isCollapsed ? (collapsed ?? null) : expanded}
      </SidebarBase.Content>
      <SidebarBase.Rail direction='right' />
    </SidebarBase>
  );
}

function RightSidebar({
  expanded,
  collapsed,
  header,
}: {
  expanded: React.ReactNode;
  collapsed?: React.ReactNode;
  header?: React.ReactNode;
}): React.ReactElement {
  const sidebarState = useSidebar();
  const isCollapsed = sidebarState.state === 'collapsed';

  return (
    <SidebarBase side='right'>
      <SidebarBase.Header>
        <div className={`${s.headerRow} ${s.right} ${!isCollapsed ? s.open : ''}`}>
          {header && !isCollapsed && <div className={s.headerContent}>{header}</div>}
          <div className={s.headerTrigger}>
          <SidebarBase.Trigger className={s.trigger} />
          </div>
        </div>
      </SidebarBase.Header>
      <SidebarBase.Content>
        {isCollapsed ? (collapsed ?? null) : expanded}
      </SidebarBase.Content>
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

// SidebarWrapper: 서버 컴포넌트에서 사용하기 위한 래퍼 컴포넌트
interface SidebarWrapperProps {
  side: 'left' | 'right';
  expanded: React.ReactNode;
  collapsed?: React.ReactNode;
  header?: React.ReactNode;
  defaultOpen?: boolean;
  defaultWidth?: string;
  cookieKeyPrefix: string;
}

export function SidebarWrapper({
  side,
  expanded,
  collapsed,
  header,
  defaultOpen,
  defaultWidth,
  cookieKeyPrefix,
}: SidebarWrapperProps): React.ReactElement {
  return (
    <SidebarProvider
      style={{ flex: '0 0 auto', width: 'auto' }}
      defaultOpen={defaultOpen}
      defaultWidth={defaultWidth}
      cookieKeyPrefix={cookieKeyPrefix}
    >
      {side === 'left' ? (
        <Sidebar.Left expanded={expanded} collapsed={collapsed} header={header} />
      ) : (
        <Sidebar.Right expanded={expanded} collapsed={collapsed} header={header} />
      )}
    </SidebarProvider>
  );
}

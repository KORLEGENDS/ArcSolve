'use client';

import { Button } from '@/client/components/ui/button';
import { FileText, Folder, FolderOpen, MoreVertical } from 'lucide-react';
import * as React from 'react';

export type ItemType = 'folder' | 'item';

export interface ArcManagerListItem {
  id: string;
  path: string;
  /**
   * 표시용 이름
   * - 서버 DocumentDTO.name을 그대로 전달합니다.
   */
  name: string;
  itemType: ItemType;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  icon?: React.ReactNode; // 일반 아이템의 경우 주입되는 아이콘
  isExpanded?: boolean; // 폴더의 확장 상태 (열림/닫힘)
  menuIcon?: React.ReactNode;
  onClick?: () => void;
  /**
   * 우측 옵션 버튼 클릭 시 호출됩니다.
   * - React 표준 MouseEvent 핸들러 시그니처를 사용합니다.
   * - bivariant callback 이므로 `() => void` 형태의 콜백도 그대로 사용할 수 있습니다.
   */
  onMenuClick?: React.MouseEventHandler<HTMLDivElement>;
  onIconClick?: () => void; // 아이콘 클릭 이벤트 (폴더 확장용)
  onDoubleClick?: () => void;
  /**
   * 기본 이름(span) 대신 커스텀 노드를 사용하고 싶을 때 사용합니다.
   * - 예: 새 폴더 인라인 생성 시 input 표시
   */
  nameNode?: React.ReactNode;
  /**
   * 우측 메뉴 버튼을 숨기고 싶을 때 사용합니다.
   */
  hideMenu?: boolean;
}

export function ArcManagerListItem(props: ArcManagerListItem) {
  const {
    name,
    path,
    itemType,
    icon,
    isExpanded,
    menuIcon,
    onClick,
    onDoubleClick,
    onIconClick,
    onMenuClick,
    nameNode,
    hideMenu,
  } = props;
  const displayIcon =
    itemType === 'folder'
      ? isExpanded
        ? <FolderOpen />
        : <Folder />
      : icon || <FileText />;
  const displayMenuIcon = menuIcon || <MoreVertical />;

  return (
    <Button
      layout="item"
      variant="ghost"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className="w-full"
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onIconClick?.();
        }}
        className={onIconClick ? 'cursor-pointer' : ''}
      >
        {displayIcon}
      </div>
      <div className="flex-1 text-left">
        {nameNode ?? <span>{name}</span>}
      </div>
      {!hideMenu && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onMenuClick?.(e);
          }}
          className="ml-auto p-1 rounded hover:bg-muted transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              // 키보드 접근성: Enter/Space 입력을 마우스 클릭과 동일하게 처리합니다.
              (e.currentTarget as HTMLDivElement).click();
            }
          }}
        >
          {displayMenuIcon}
        </div>
      )}
    </Button>
  );
}



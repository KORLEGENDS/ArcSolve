'use client';

import { Button } from '@/client/components/ui/button';
import { FileText, Folder, FolderOpen, MoreVertical } from 'lucide-react';
import * as React from 'react';

export type ItemType = 'folder' | 'item';

export interface ArcManagerListItem {
  id: string;
  path: string;
  itemType: ItemType;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  icon?: React.ReactNode; // 일반 아이템의 경우 주입되는 아이콘
  isExpanded?: boolean; // 폴더의 확장 상태 (열림/닫힘)
  menuIcon?: React.ReactNode;
  onClick?: () => void;
  onMenuClick?: () => void;
  onIconClick?: () => void; // 아이콘 클릭 이벤트 (폴더 확장용)
}

export interface ArcManagerListProps {
  items: ArcManagerListItem[];
  className?: string;
}

/**
 * path에서 파일/폴더 이름을 추출합니다.
 * 예: "/documents/folder/file.txt" -> "file.txt"
 */
function getNameFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

/**
 * itemType에 따라 아이콘을 반환합니다.
 * 폴더는 확장 상태에 따라 Folder 또는 FolderOpen 아이콘 사용
 * 일반 아이템은 주입된 아이콘 사용 (없으면 FileText 기본값)
 */
function getIconForItem(item: ArcManagerListItem): React.ReactNode {
  if (item.itemType === 'folder') {
    return item.isExpanded ? <FolderOpen /> : <Folder />;
  }
  return item.icon || <FileText />;
}

export function ArcManagerList({ items, className }: ArcManagerListProps) {
  return (
    <div className={className}>
      {items.map((item) => {
        const name = getNameFromPath(item.path);
        const icon = getIconForItem(item);
        const menuIcon = item.menuIcon || <MoreVertical />;

        return (
          <Button
            key={item.id}
            layout="item"
            variant="ghost"
            onClick={item.onClick}
            className="w-full"
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                item.onIconClick?.();
              }}
              className={item.onIconClick ? 'cursor-pointer' : ''}
            >
              {icon}
            </div>
            <span>{name}</span>
            <div
              onClick={(e) => {
                e.stopPropagation();
                item.onMenuClick?.();
              }}
              className="ml-auto p-1 rounded hover:bg-muted transition-colors cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  item.onMenuClick?.();
                }
              }}
            >
              {menuIcon}
            </div>
          </Button>
        );
      })}
    </div>
  );
}


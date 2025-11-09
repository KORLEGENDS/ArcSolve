'use client';

import { useState } from 'react';
import { ArcManagerList, type ArcManagerListItem } from '../list';

export interface ArcManagerTreeItem extends ArcManagerListItem {
  children?: ArcManagerTreeItem[];
}

export interface ArcManagerTreeProps {
  items: ArcManagerTreeItem[];
  className?: string;
}

/**
 * Tree 컴포넌트 - 폴더 확장/축소 기능이 있는 중첩 리스트
 */
export function ArcManagerTree({ items, className }: ArcManagerTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (itemId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const renderItem = (item: ArcManagerTreeItem, level: number = 0) => {
    const isExpanded = expandedFolders.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const isFolder = item.itemType === 'folder';

    // 폴더인 경우 아이콘 클릭으로 확장/축소 처리 및 확장 상태 전달
    const itemWithIconClick: ArcManagerTreeItem = {
      ...item,
      isExpanded: isFolder ? isExpanded : undefined,
      onIconClick: isFolder
        ? () => {
            toggleFolder(item.id);
          }
        : undefined,
    };

    return (
      <div key={item.id} className="w-full">
        <div
          className="flex items-center gap-2"
          style={{ paddingLeft: `${level * 1.5}rem` }}
        >
          <div className="flex-1">
            <ArcManagerList items={[itemWithIconClick]} />
          </div>
        </div>
        {isFolder && isExpanded && hasChildren && (
          <div className="">
            {item.children!.map((child) => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      {items.map((item) => renderItem(item, 0))}
    </div>
  );
}


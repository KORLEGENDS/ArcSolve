'use client';

import { useState, type CSSProperties } from 'react';
import { ArcManagerList, type ArcManagerListItem } from '../list';
import s from './ArcManagerTree.module.css';

export interface ArcManagerTreeItem extends ArcManagerListItem {
  children?: ArcManagerTreeItem[];
}

export interface ArcManagerTreeProps {
  items: ArcManagerTreeItem[];
  className?: string;
}

/**
 * ArcManagerTree - pseudo-element 기반 L자 라인 트리
 *
 * - 각 행(row)에 CSS custom property(--tree-line-left)를 심어서
 *   ::before / ::after 및 .ancestor가 들여쓰기 수준에 맞춰 L자 라인을 렌더링합니다.
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

  const renderItem = (
    item: ArcManagerTreeItem,
    level: number = 0,
    isLast: boolean = false,
    ancestorsHasNextSibling: boolean[] = []
  ) => {
    const isExpanded = expandedFolders.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const isFolder = item.itemType === 'folder';

    const itemWithIconClick: ArcManagerTreeItem = {
      ...item,
      isExpanded: isFolder ? isExpanded : undefined,
      onIconClick: isFolder
        ? () => {
            toggleFolder(item.id);
          }
        : undefined,
    };

    const indentRem = level * 1.5;
    // 세로 라인이 상위 폴더 아이콘의 중앙 아래에서 내려오도록 x 좌표를 계산합니다.
    // - 버튼 내부 좌측 padding: px-3 => 0.75rem
    // - 아이콘 너비: size-4 => 1rem ⇒ 중앙까지 0.5rem
    // ⇒ 상위 레벨 기준 아이콘 중앙 x = indentParent + 0.75rem + 0.5rem = indentParent + 1.25rem
    // 현재 level의 라인은 (level - 1) 단계의 indent 기준으로 이어져야 하므로:
    //   lineLeftRem = (level - 1) * 1.5rem + 1.25rem
    const lineLeftRem = level > 0 ? (level - 1) * 1.5 + 1.25 : 0;

    const rowStyle: CSSProperties = {
      paddingLeft: `${indentRem}rem`,
      // pseudo-element에서 사용할 라인 x 좌표
      '--tree-line-left': `${lineLeftRem}rem`,
    } as CSSProperties;

    return (
      <div key={item.id} className="w-full">
        <div
          className={`${s.row} flex items-center gap-2`}
          data-last={isLast ? 'true' : 'false'}
          data-level={level}
          style={rowStyle}
        >
          {/* 상위 레벨에서 아직 다음 형제가 남아 있는 경우, 해당 레벨의 세로 라인을 계속 그려줍니다. */}
          {ancestorsHasNextSibling.map(
            (hasNextSibling, depth) =>
              hasNextSibling && (
                <div
                  key={depth}
                  className={s.ancestor}
                  style={{
                    left: `${depth * 1.5 + 1.25}rem`,
                  }}
                  aria-hidden="true"
                />
              )
          )}
          <div className="flex-1">
            <ArcManagerList items={[itemWithIconClick]} />
          </div>
        </div>
        {isFolder && isExpanded && hasChildren && (
          <div>
            {item.children!.map((child, index) =>
              renderItem(
                child,
                level + 1,
                index === item.children!.length - 1,
                [...ancestorsHasNextSibling, !isLast]
              )
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      {items.map((item, index) => renderItem(item, 0, index === items.length - 1, []))}
    </div>
  );
}

'use client';

import { useState, type CSSProperties, type MouseEvent } from 'react';
import { ArcManagerList, type ArcManagerListItem, type ItemType } from '../list';
import s from './ArcManagerTree.module.css';

export interface ArcManagerTreeItem extends ArcManagerListItem {
  children?: ArcManagerTreeItem[];
}

export interface ArcManagerTreeProps {
  items: ArcManagerTreeItem[];
  className?: string;
  /**
   * 폴더 항목을 더블 클릭했을 때 호출됩니다.
   * - path는 해당 폴더의 ltree 경로입니다.
   */
  onFolderEnter?: (path: string) => void;
  /**
   * 행에서 드래그가 시작될 때 호출됩니다.
   * - item: 드래그 중인 트리 아이템
   * - event: 원본 드래그 이벤트
   */
  onItemDragStart?: (payload: {
    item: ArcManagerTreeItem;
    event: React.DragEvent<HTMLDivElement>;
  }) => void;
  /**
   * 특정 행 위에 드롭되었을 때 호출됩니다.
   * - target: 드롭 대상 아이템
   * - event: 원본 드롭 이벤트
   */
  onItemDropOnRow?: (payload: {
    target: { path: string; itemType: ItemType };
    event: React.DragEvent<HTMLDivElement>;
  }) => void;
  /**
   * 트리의 빈 영역 위에 드롭되었을 때 호출됩니다.
   * - event: 원본 드롭 이벤트
   */
  onItemDropOnEmpty?: (payload: {
    event: React.DragEvent<HTMLDivElement>;
  }) => void;
  /**
   * 트리 하단의 플레이스홀더 영역 위에 드롭되었을 때 호출됩니다.
   * - 일반적으로 "현재 디렉토리의 바깥(부모 디렉토리)"로 이동하는 용도로 사용합니다.
   */
  onPlaceholderDrop?: (payload: {
    event: React.DragEvent<HTMLDivElement>;
  }) => void;

  /**
   * 행에서 컨텍스트 메뉴(우클릭)가 요청되었을 때 호출됩니다.
   * - 실제 Radix ContextMenu는 상위 컴포넌트(ArcManager)에서 관리하고,
   *   이 콜백은 "어떤 아이템이 대상인지"를 알려주는 용도로만 사용합니다.
   */
  onItemContextMenu?: (payload: {
    item: ArcManagerTreeItem;
    event: MouseEvent<HTMLDivElement>;
  }) => void;

  /**
   * 각 행의 우측 옵션 버튼(메뉴 아이콘)을 클릭했을 때 호출됩니다.
   * - 우클릭과 동일하게 컨텍스트 메뉴를 열기 위한 용도로 사용합니다.
   */
  onItemMenuClick?: (payload: {
    item: ArcManagerTreeItem;
    event: MouseEvent<HTMLDivElement>;
  }) => void;
}

function getParentPath(path: string): string {
  const parts = path.split('.').filter(Boolean);
  parts.pop();
  return parts.join('.');
}

/**
 * ArcManagerTree - pseudo-element 기반 L자 라인 트리
 *
 * - 각 행(row)에 CSS custom property(--tree-line-left)를 심어서
 *   ::before / ::after 및 .ancestor가 들여쓰기 수준에 맞춰 L자 라인을 렌더링합니다.
 */
export function ArcManagerTree({
  items,
  className,
  onFolderEnter,
  onItemDragStart,
  onItemDropOnRow,
  onItemDropOnEmpty,
  onPlaceholderDrop,
  onItemContextMenu,
  onItemMenuClick,
}: ArcManagerTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isPlaceholderDragOver, setIsPlaceholderDragOver] = useState(false);
  const [dropFolderPath, setDropFolderPath] = useState<string | null>(null);

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

    const isDropFolder =
      dropFolderPath != null && isFolder && item.path === dropFolderPath;

    const isDropGroup =
      dropFolderPath != null &&
      dropFolderPath !== '' &&
      (item.path === dropFolderPath ||
        item.path.startsWith(`${dropFolderPath}.`));

    const itemWithIconClick: ArcManagerTreeItem = {
      ...item,
      isExpanded: isFolder ? isExpanded : undefined,
      onIconClick: isFolder
        ? () => {
            toggleFolder(item.id);
          }
        : undefined,
      onDoubleClick:
        isFolder && onFolderEnter
          ? () => {
              onFolderEnter(item.path);
            }
          : item.onDoubleClick,
      onMenuClick: onItemMenuClick
        ? (event) => {
            onItemMenuClick({ item, event });
          }
        : item.onMenuClick,
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
          className={`${s.row} flex items-center gap-2 ${
            isDropGroup ? 'bg-muted/40' : ''
          } ${isDropFolder ? 'ring-1 ring-primary border-primary/60' : ''}`}
          data-last={isLast ? 'true' : 'false'}
          data-level={level}
          style={rowStyle}
          draggable
          onContextMenu={(event) => {
            // 행 단위 우클릭 정보를 상위로 전달하여 공통 컨텍스트 메뉴 타겟을 설정합니다.
            onItemContextMenu?.({ item, event });
          }}
          onDragStart={(event) => {
            onItemDragStart?.({ item, event });
          }}
          onDragOver={(event) => {
            const dt = event.dataTransfer;
            if (!dt) return;
            // ArcManager에서 시작된 드래그(전용 MIME)인 경우에만 드롭/하이라이트를 허용합니다.
            const hasArcManagerMime = Array.from(dt.types || []).includes(
              'application/x-arcmanager-item'
            );
            if (!hasArcManagerMime) return;

            // 행 위로 ArcManager 항목이 드래그된 경우에만 드롭을 허용합니다.
            event.preventDefault();
            if (item.itemType === 'folder') {
              // 폴더 행 위에 있는 경우, 해당 폴더를 드롭 대상로 표시합니다.
              setDropFolderPath(item.path);
            } else {
              // 아이템 행인 경우, 아이템이 속한 폴더 전체를 드롭 대상으로 표시합니다.
              const parentPath = getParentPath(item.path);
              setDropFolderPath(parentPath || null);
            }
          }}
          onDrop={(event) => {
            // 행 자체에서 드롭을 처리하고 상위로 전파되지 않도록 막습니다.
            event.preventDefault();
            event.stopPropagation();
            setDropFolderPath(null);
            onItemDropOnRow?.({
              target: { path: item.path, itemType: item.itemType },
              event,
            });
          }}
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
    <div
      className={className}
      onDragOver={(event) => {
        const dt = event.dataTransfer;
        if (!dt) return;
        const hasArcManagerMime = Array.from(dt.types || []).includes(
          'application/x-arcmanager-item'
        );
        if (!hasArcManagerMime) return;

        // 트리 전체 영역 위에서도 ArcManager 항목에 대해서만 드롭을 허용합니다.
        event.preventDefault();
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        const current = event.currentTarget as HTMLDivElement;
        const related = event.relatedTarget as Node | null;
        // 아직 트리 영역 안에 있다면 상태를 초기화하지 않습니다.
        if (related && current.contains(related)) return;
        setDropFolderPath(null);
      }}
      onDrop={(event) => {
        // 어떤 행에도 걸리지 않은 빈 영역 드롭을 처리합니다.
        event.preventDefault();
        setDropFolderPath(null);
        onItemDropOnEmpty?.({ event });
      }}
    >
      {items.map((item, index) => renderItem(item, 0, index === items.length - 1, []))}
      {/* 디렉토리 바깥으로 이동하기 플레이스홀더 영역 */}
      <div
        className="mt-2 rounded border border-dashed border-transparent text-xs text-muted-foreground flex items-center justify-center"
        style={{
          minHeight: '300px',
          backgroundColor: isPlaceholderDragOver ? 'rgba(148,163,184,0.08)' : 'transparent',
          borderColor: isPlaceholderDragOver ? 'rgba(148,163,184,0.6)' : 'transparent',
          transition: 'background-color 0.15s ease, border-color 0.15s ease',
        }}
        onDragOver={(event) => {
          const dt = event.dataTransfer;
          if (!dt) return;
          const hasArcManagerMime = Array.from(dt.types || []).includes(
            'application/x-arcmanager-item'
          );
          if (!hasArcManagerMime) return;

          event.preventDefault();
          setIsPlaceholderDragOver(true);
          setDropFolderPath(null);
        }}
        onDragEnter={(event) => {
          const dt = event.dataTransfer;
          if (!dt) return;
          const hasArcManagerMime = Array.from(dt.types || []).includes(
            'application/x-arcmanager-item'
          );
          if (!hasArcManagerMime) return;

          event.preventDefault();
          setIsPlaceholderDragOver(true);
          setDropFolderPath(null);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsPlaceholderDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsPlaceholderDragOver(false);
           setDropFolderPath(null);
          onPlaceholderDrop?.({ event });
        }}
      >
        {isPlaceholderDragOver && <span>현재 디렉토리 최상단으로 이동하기</span>}
      </div>
    </div>
  );
}

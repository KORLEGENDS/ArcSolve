'use client';

import { ChevronDown, MoreVertical } from 'lucide-react';
import * as React from 'react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';
import { cn } from '@/client/components/ui/utils';

import { ArcUserItem } from './components/ArcUserItem';

export interface ArcUserMenuItem {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface ArcUserMenuProps {
  /**
   * 사용자 제목
   */
  title: string;
  /**
   * 사용자 설명 (연한 글씨로 표시)
   */
  description?: string;
  /**
   * 메뉴 항목 목록
   */
  menuItems?: ArcUserMenuItem[];
  /**
   * 메뉴 항목 선택 시 호출되는 콜백
   */
  onMenuItemSelect?: (value: string) => void;
  /**
   * 추가 클래스명
   */
  className?: string;
}

export function ArcUserMenu({
  title,
  description,
  menuItems = [],
  onMenuItemSelect,
  className,
}: ArcUserMenuProps) {
  const handleMenuItemClick = React.useCallback(
    (value: string) => {
      onMenuItemSelect?.(value);
    },
    [onMenuItemSelect]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className={cn('w-full', className)}>
          <ArcUserItem
            title={title}
            description={description}
            icon={<ChevronDown className="size-4 text-muted-foreground" />}
            onClick={() => {}}
          />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-(--radix-dropdown-menu-trigger-width) p-1">
        {menuItems.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            메뉴 항목이 없습니다
          </div>
        ) : (
          menuItems.map((item) => (
            <ArcUserItem
              key={item.value}
              title={item.label}
              description={item.description}
              icon={<MoreVertical className="size-4 text-muted-foreground" />}
              onClick={() => !item.disabled && handleMenuItemClick(item.value)}
              className={cn(
                item.disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
              )}
            />
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


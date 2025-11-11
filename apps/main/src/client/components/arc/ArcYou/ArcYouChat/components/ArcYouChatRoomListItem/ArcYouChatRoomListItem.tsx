'use client';

import { MoreVertical } from 'lucide-react';
import * as React from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';
import { cn } from '@/client/components/ui/utils';

export interface ArcYouChatRoomMenuOption {
  /**
   * 메뉴 옵션 라벨
   */
  label: string;
  /**
   * 메뉴 옵션 클릭 핸들러
   */
  onClick: () => void;
  /**
   * 구분선 표시 여부 (이 옵션 위에 구분선 표시)
   */
  separator?: boolean;
  /**
   * 비활성화 여부
   */
  disabled?: boolean;
}

export interface ArcYouChatRoomListItemProps {
  /**
   * 아이템 제목
   */
  title: string;
  /**
   * 아이템 설명 (연한 글씨로 표시)
   */
  description?: string;
  /**
   * 우측 끝에 표시할 아이콘
   */
  icon?: React.ReactNode;
  /**
   * 추가 클래스명
   */
  className?: string;
  /**
   * 클릭 핸들러
   */
  onClick?: () => void;
  /**
   * 메뉴 옵션 목록 (호버 시 ... 아이콘이 표시되고 클릭하면 옵션이 보임)
   */
  menuOptions?: ArcYouChatRoomMenuOption[];
}

export function ArcYouChatRoomListItem({
  title,
  description,
  icon,
  className,
  onClick,
  menuOptions,
}: ArcYouChatRoomListItemProps) {
  return (
    <div
      className={cn(
        'w-full grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-1 group',
        'text-left rounded-md',
        onClick && 'cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors',
        className
      )}
      onClick={onClick}
    >
      {/* 좌측 열: 위아래 2행 구조 */}
      <div className="flex flex-col gap-0.5 min-w-0">
        {/* 위쪽 행: 제목 */}
        <div className="text-sm font-medium truncate">{title}</div>
        {/* 아래쪽 행: 간략한 설명 (연한 글씨) */}
        {description && (
          <div className="text-xs text-muted-foreground truncate">
            {description}
          </div>
        )}
      </div>
      {/* 우측 끝: 아이콘 또는 메뉴 */}
      <div className="shrink-0 flex items-center gap-1">
        {icon && <div>{icon}</div>}
        {menuOptions && menuOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'p-1 rounded-md transition-colors',
                  'opacity-0 group-hover:opacity-100',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus:opacity-100 focus:outline-none'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <MoreVertical className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-32">
              {menuOptions.map((option, index) => (
                <React.Fragment key={index}>
                  {option.separator && index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!option.disabled) {
                        option.onClick();
                      }
                    }}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}


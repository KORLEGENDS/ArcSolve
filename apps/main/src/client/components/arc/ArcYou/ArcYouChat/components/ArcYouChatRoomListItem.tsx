'use client';

import { MoreVertical } from 'lucide-react';
import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
   * 비활성화 여부
   */
  disabled?: boolean;
}

export interface ArcYouChatRoomListItemProps {
  /**
   * 채팅방 고유 ID
   */
  id: string;
  /**
   * 채팅방 이름
   */
  name: string;
  /**
   * 마지막 메시지 내용
   */
  lastMessage?: string | null;
  /**
   * 프로필 이미지 URL (채팅방 아바타용)
   */
  imageUrl?: string | null;
  /**
   * 생성일시
   */
  createdAt?: string | null;
  /**
   * 수정일시
   */
  updatedAt?: string | null;
  /**
   * 삭제일시
   */
  deletedAt?: string | null;
  /**
   * 현재 사용자 기준 읽지 않은 메시지 수
   */
  unreadCount?: number;
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

/**
 * 이름에서 첫 글자를 추출하는 헬퍼 함수
 */
function getInitials(name?: string): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  
  // 한글, 영문, 숫자 등 첫 글자 추출
  const firstChar = trimmed[0];
  // 한글인 경우 첫 글자만, 영문인 경우 첫 글자만 반환
  return firstChar.toUpperCase();
}

export function ArcYouChatRoomListItem({
  id,
  name,
  lastMessage,
  imageUrl,
  createdAt,
  updatedAt,
  deletedAt,
  icon,
  className,
  onClick,
  menuOptions,
  unreadCount,
}: ArcYouChatRoomListItemProps) {
  const hasIcon = !!icon || (menuOptions && menuOptions.length > 0);
  const effectiveUnread = typeof unreadCount === 'number' ? unreadCount : 0;
  const hasUnread = effectiveUnread > 0;
  const unreadLabel = effectiveUnread > 300 ? '300+' : String(effectiveUnread);

  return (
    <div
      className={cn(
        'w-full grid items-center gap-3 p-1 group',
        'text-left rounded-md',
        onClick && 'cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors',
        // 아바타와 아이콘 유무에 따라 grid 구조 조정
        hasIcon
          ? 'grid-cols-[auto_1fr_auto]'
          : 'grid-cols-[auto_1fr]',
        className
      )}
      onClick={onClick}
    >
      {/* 좌측: 아바타 + unread 뱃지 (우측 상단 오버레이) */}
      <div className="shrink-0 relative">
        <Avatar className="size-8">
          {imageUrl && (
            <AvatarImage src={imageUrl} alt={name} />
          )}
          <AvatarFallback className="text-xs font-medium">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        {hasUnread && (
          <span className="absolute -top-1 -right-1 z-10 inline-flex items-center justify-center rounded-full bg-accent text-foreground text-[0.65rem] leading-none px-1.5 py-0.5 shadow-sm">
            {unreadLabel}
          </span>
        )}
      </div>

      {/* 중앙: 위아래 2행 구조 */}
      <div className="flex flex-col gap-0.5 min-w-0">
        {/* 위쪽 행: 채팅방 이름 */}
        <div className="text-sm font-medium truncate">{name}</div>
        {/* 아래쪽 행: 마지막 메시지 내용 (연한 글씨) */}
        {lastMessage && (
          <div className="text-xs text-muted-foreground truncate">
            {lastMessage}
          </div>
        )}
      </div>

      {/* 우측 끝: 아이콘 또는 메뉴 */}
      {hasIcon && (
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
                  <DropdownMenuItem
                    key={index}
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
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}


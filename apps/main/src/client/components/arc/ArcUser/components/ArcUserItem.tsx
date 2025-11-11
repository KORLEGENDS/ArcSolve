'use client';

import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar';
import { cn } from '@/client/components/ui/utils';

export interface ArcUserItemProfile {
  /**
   * 프로필 이미지 URL
   */
  imageUrl?: string;
  /**
   * 사용자 이름 (이미지가 없을 때 첫 글자 표시용)
   */
  name?: string;
}

export interface ArcUserItemProps {
  /**
   * 아이템 제목
   */
  title: string;
  /**
   * 아이템 설명 (연한 글씨로 표시)
   */
  description?: string;
  /**
   * 프로필 정보 (이미지 URL 또는 이름)
   */
  profile?: ArcUserItemProfile;
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

export function ArcUserItem({
  title,
  description,
  profile,
  icon,
  className,
  onClick,
}: ArcUserItemProps) {
  const hasProfile = !!profile;
  const hasIcon = !!icon;

  return (
    <div
      className={cn(
        'w-full grid items-center gap-3 px-3 py-1',
        'text-left rounded-md',
        onClick && 'cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors',
        // 아바타와 아이콘 유무에 따라 grid 구조 조정
        hasProfile && hasIcon
          ? 'grid-cols-[auto_1fr_auto]'
          : hasProfile
            ? 'grid-cols-[auto_1fr]'
            : hasIcon
              ? 'grid-cols-[1fr_auto]'
              : 'grid-cols-[1fr]',
        className
      )}
      onClick={onClick}
    >
      {/* 좌측: 아바타 (profile이 있을 때만 표시) */}
      {hasProfile && (
        <div className="shrink-0">
          <Avatar className="size-8">
            {profile.imageUrl && (
              <AvatarImage src={profile.imageUrl} alt={profile.name || title} />
            )}
            <AvatarFallback className="text-xs font-medium">
              {getInitials(profile.name || title)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* 중앙: 위아래 2행 구조 */}
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

      {/* 우측 끝: 아이콘 (주입 가능) */}
      {hasIcon && (
        <div className="shrink-0">
          {icon}
        </div>
      )}
    </div>
  );
}


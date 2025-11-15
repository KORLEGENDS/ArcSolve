'use client';

import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar';
import { Button } from '@/client/components/ui/button';
import { cn } from '@/client/components/ui/utils';

export interface ArcYouRelationItemProfile {
  /**
   * 프로필 이미지 URL
   */
  imageUrl?: string;
  /**
   * 사용자 이름 (이미지가 없을 때 첫 글자 표시용)
   */
  name?: string;
}

export interface ArcYouRelationItemProps {
  /**
   * 대상 사용자 ID
   */
  userId: string;
  /**
   * 사용자 이름
   */
  name: string;
  /**
   * 사용자 이메일 (연한 글씨로 표시, 선택사항)
   */
  email?: string;
  /**
   * 프로필 정보 (이미지 URL 또는 이름)
   */
  profile?: ArcYouRelationItemProfile;
  /**
   * 관계 상태 ('pending' | 'accepted' | 'blocked' | 'rejected')
   */
  status?: 'pending' | 'accepted' | 'blocked' | 'rejected';
  /**
   * 수락 버튼 클릭 핸들러 (status가 'pending'일 때만 표시)
   */
  onAccept?: () => void;
  /**
   * 거절 버튼 클릭 핸들러 (status가 'pending'일 때만 표시)
   */
  onReject?: () => void;
  /**
   * 추가 클래스명
   */
  className?: string;
  /**
   * 클릭 핸들러 (전체 아이템 클릭 시)
   */
  onClick?: () => void;
  /**
   * 수락 버튼 비활성화 여부
   */
  acceptDisabled?: boolean;
  /**
   * 거절 버튼 비활성화 여부
   */
  rejectDisabled?: boolean;
  /**
   * 취소 버튼 클릭 핸들러 (pending 상태에서 보낸 요청일 때 표시)
   */
  onCancel?: () => void;
  /**
   * 취소 버튼 비활성화 여부
   */
  cancelDisabled?: boolean;
  /**
   * 대화 버튼 클릭 핸들러 (accepted 상태일 때 표시)
   */
  onChat?: () => void;
  /**
   * 삭제 버튼 클릭 핸들러 (accepted 상태일 때 표시)
   */
  onDelete?: () => void;
  /**
   * 대화 버튼 비활성화 여부
   */
  chatDisabled?: boolean;
  /**
   * 삭제 버튼 비활성화 여부
   */
  deleteDisabled?: boolean;
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

export function ArcYouRelationItem({
  userId,
  name,
  email,
  profile,
  status = 'pending',
  onAccept,
  onReject,
  className,
  onClick,
  acceptDisabled = false,
  rejectDisabled = false,
  onCancel,
  cancelDisabled = false,
  onChat,
  onDelete,
  chatDisabled = false,
  deleteDisabled = false,
}: ArcYouRelationItemProps) {
  const isPending = status === 'pending';
  const isAccepted = status === 'accepted';

  const showPendingReceivedActions =
    isPending && (!!onAccept || !!onReject); // 받은 요청: 수락/거절
  const showPendingSentActions = isPending && !!onCancel; // 보낸 요청: 취소
  const showAcceptedActions = isAccepted && (!!onChat || !!onDelete);
  const showActions =
    showPendingReceivedActions || showPendingSentActions || showAcceptedActions;

  const handleAccept = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAccept?.();
    },
    [onAccept]
  );

  const handleReject = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onReject?.();
    },
    [onReject]
  );

  const handleCancel = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCancel?.();
    },
    [onCancel]
  );

  const handleChat = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChat?.();
    },
    [onChat]
  );

  const handleDelete = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.();
    },
    [onDelete]
  );

  return (
    <div
      className={cn(
        'w-full grid items-center gap-3 px-3 py-1',
        'text-left rounded-md',
        onClick && 'cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors',
        // 프로필과 액션 버튼 유무에 따라 grid 구조 조정
        profile && showActions
          ? 'grid-cols-[auto_1fr_auto]'
          : profile
            ? 'grid-cols-[auto_1fr]'
            : showActions
              ? 'grid-cols-[1fr_auto]'
              : 'grid-cols-[1fr]',
        className
      )}
      onClick={onClick}
    >
      {/* 좌측: 프로필 아바타 */}
      {profile && (
        <div className="shrink-0">
          <Avatar className="size-8">
            {profile.imageUrl && (
              <AvatarImage src={profile.imageUrl} alt={profile.name || name} />
            )}
            <AvatarFallback className="text-xs font-medium">
              {getInitials(profile.name || name)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* 중앙: 이름 및 이메일 */}
      <div className="flex flex-col gap-0.5 min-w-0">
        {/* 위쪽 행: 이름 */}
        <div className="text-sm font-medium truncate">{name}</div>
        {/* 아래쪽 행: 이메일 (연한 글씨) */}
        {email && (
          <div className="text-xs text-muted-foreground truncate">
            {email}
          </div>
        )}
      </div>

      {/* 우측 끝: 액션 버튼 */}
      {showActions && (
        <div className="shrink-0 flex items-center gap-1.5">
          {/* pending 상태: 받은 요청 - 수락/거절 버튼 */}
          {showPendingReceivedActions && (
            <>
              {onAccept && (
                <Button
                  variant="brand"
                  size="sm"
                  onClick={handleAccept}
                  disabled={acceptDisabled}
                >
                  수락
                </Button>
              )}
              {onReject && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReject}
                  disabled={rejectDisabled}
                >
                  거절
                </Button>
              )}
            </>
          )}
          {/* pending 상태: 보낸 요청 - 취소 버튼 */}
          {showPendingSentActions && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={cancelDisabled}
            >
              취소
            </Button>
          )}
          {/* accepted 상태: 대화/삭제 버튼 */}
          {showAcceptedActions && (
            <>
              {onChat && (
                <Button
                  variant="brand"
                  size="sm"
                  onClick={handleChat}
                  disabled={chatDisabled}
                >
                  대화
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteDisabled}
                >
                  삭제
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}


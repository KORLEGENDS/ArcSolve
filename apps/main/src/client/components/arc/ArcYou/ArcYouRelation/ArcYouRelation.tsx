'use client';

import * as React from 'react';

import { cn } from '@/client/components/ui/utils';
import type { ArcyouChatRelation } from '@/share/schema/drizzles/arcyou-chat-relation-drizzle';

import { ArcYouRelationAdd } from './components/ArcYouRelationAdd';
import type { ArcYouRelationItemProps } from './components/ArcYouRelationItem';
import { ArcYouRelationList } from './components/ArcYouRelationList';

/**
 * 관계 데이터와 대상 사용자 정보를 결합한 타입
 */
export interface RelationshipWithTargetUser extends ArcyouChatRelation {
  /**
   * 대상 사용자 정보
   */
  targetUser: {
    id: string;
    name: string;
    email: string;
    imageUrl?: string | null;
  };
  /**
   * 현재 사용자가 요청을 받은 경우 true
   * pending 상태에서 수락/거부 버튼을 표시할지 결정하는 데 사용
   */
  isReceivedRequest?: boolean;
}

export interface ArcYouRelationProps {
  /**
   * 관계 데이터 배열 (대상 사용자 정보 포함)
   */
  relationships: RelationshipWithTargetUser[];
  /**
   * 수락 핸들러
   */
  onAccept?: (relationship: RelationshipWithTargetUser) => void;
  /**
   * 거절 핸들러
   */
  onReject?: (relationship: RelationshipWithTargetUser) => void;
  /**
   * 취소 핸들러 (pending 상태에서 보낸 요청일 때)
   */
  onCancel?: (relationship: RelationshipWithTargetUser) => void;
  /**
   * 대화 핸들러 (accepted 상태일 때)
   */
  onChat?: (relationship: RelationshipWithTargetUser) => void;
  /**
   * 삭제 핸들러 (accepted 상태일 때)
   */
  onDelete?: (relationship: RelationshipWithTargetUser) => void;
  /**
   * 아이템 클릭 핸들러
   */
  onItemClick?: (relationship: RelationshipWithTargetUser) => void;
  /**
   * 친구 추가 이메일 입력값
   */
  addEmail?: string;
  /**
   * 친구 추가 이메일 변경 핸들러
   */
  onAddEmailChange?: (email: string) => void;
  /**
   * 친구 추가 핸들러
   */
  onAdd?: (email: string) => void;
  /**
   * 추가 클래스명
   */
  className?: string;
  /**
   * 위쪽 리스트 (pending) 추가 클래스명
   */
  pendingListClassName?: string;
  /**
   * 아래쪽 리스트 (일반 친구) 추가 클래스명
   */
  friendsListClassName?: string;
  /**
   * 위쪽 리스트 빈 메시지
   */
  pendingEmptyMessage?: string;
  /**
   * 아래쪽 리스트 빈 메시지
   */
  friendsEmptyMessage?: string;
}

/**
 * 관계 배열을 상태별로 분리하는 유틸 함수
 * - pending: 친구 요청 목록 (위쪽 리스트)
 * - accepted: 친구 목록 (아래쪽 리스트)
 * - 그 외(status)는 현재는 무시
 */
function splitRelationshipsByStatus(
  relationships: RelationshipWithTargetUser[]
): {
  pending: RelationshipWithTargetUser[];
  accepted: RelationshipWithTargetUser[];
} {
  console.log('[ArcYouRelation.splitRelationshipsByStatus] 입력 relationships 수:', relationships.length);
  console.log('[ArcYouRelation.splitRelationshipsByStatus] 입력 relationships 상세:', relationships.map((rel) => ({
    userId: rel.userId,
    targetUserId: rel.targetUserId,
    status: rel.status,
    isReceivedRequest: rel.isReceivedRequest,
    targetUserEmail: rel.targetUser.email,
  })));

  const pending: RelationshipWithTargetUser[] = [];
  const accepted: RelationshipWithTargetUser[] = [];

  relationships.forEach((relationship) => {
    if (relationship.status === 'pending') {
      pending.push(relationship);
    } else if (relationship.status === 'accepted') {
      accepted.push(relationship);
    }
    // 그 외(status === 'rejected' | 'blocked' 등)는 현재는 무시
  });

  console.log('[ArcYouRelation.splitRelationshipsByStatus] 분리 결과:', {
    pending: pending.length,
    accepted: accepted.length,
  });

  return { pending, accepted };
}

/**
 * 관계 데이터를 ArcYouRelationItemProps로 변환하는 헬퍼 함수
 * pending 상태에서 받은 요청만 수락/거부 버튼 표시
 */
function relationshipToItemProps(
  relationship: RelationshipWithTargetUser,
  onAccept?: (relationship: RelationshipWithTargetUser) => void,
  onReject?: (relationship: RelationshipWithTargetUser) => void,
  onCancel?: (relationship: RelationshipWithTargetUser) => void,
  onChat?: (relationship: RelationshipWithTargetUser) => void,
  onDelete?: (relationship: RelationshipWithTargetUser) => void,
  onItemClick?: (relationship: RelationshipWithTargetUser) => void
): ArcYouRelationItemProps {
  // pending 상태이고 받은 요청인 경우만 수락/거부 버튼 표시
  const canAcceptOrReject =
    relationship.status === 'pending' && relationship.isReceivedRequest === true;

  // pending 상태이고 보낸 요청인 경우 취소 버튼 표시
  const canCancel =
    relationship.status === 'pending' && relationship.isReceivedRequest === false;

  // accepted 상태일 때 대화/삭제 버튼 표시
  const canChatOrDelete = relationship.status === 'accepted';

  return {
    userId: relationship.targetUser.id,
    name: relationship.targetUser.name,
    email: relationship.targetUser.email,
    profile: {
      imageUrl: relationship.targetUser.imageUrl || undefined,
      name: relationship.targetUser.name,
    },
    status: relationship.status,
    onAccept: canAcceptOrReject && onAccept ? () => onAccept(relationship) : undefined,
    onReject: canAcceptOrReject && onReject ? () => onReject(relationship) : undefined,
    onCancel: canCancel && onCancel ? () => onCancel(relationship) : undefined,
    onChat: canChatOrDelete && onChat ? () => onChat(relationship) : undefined,
    onDelete: canChatOrDelete && onDelete ? () => onDelete(relationship) : undefined,
    onClick: onItemClick ? () => onItemClick(relationship) : undefined,
  };
}

export function ArcYouRelation({
  relationships,
  onAccept,
  onReject,
  onCancel,
  onChat,
  onDelete,
  onItemClick,
  addEmail = '',
  onAddEmailChange,
  onAdd,
  className,
  pendingListClassName,
  friendsListClassName,
  pendingEmptyMessage = '친구 요청이 없습니다',
  friendsEmptyMessage = '친구가 없습니다',
}: ArcYouRelationProps): React.ReactElement {
  // 핸들러 참조를 안정화하기 위해 useRef 사용
  const handlersRef = React.useRef({
    onAccept,
    onReject,
    onCancel,
    onChat,
    onDelete,
    onItemClick,
  });

  // 핸들러가 변경될 때마다 ref 업데이트
  React.useEffect(() => {
    handlersRef.current = {
      onAccept,
      onReject,
      onCancel,
      onChat,
      onDelete,
      onItemClick,
    };
  }, [onAccept, onReject, onCancel, onChat, onDelete, onItemClick]);

  // pending 상태와 accepted 상태를 분리
  const { pendingItems, friendItems } = React.useMemo(() => {
    console.log('[ArcYouRelation] useMemo 실행, relationships 수:', relationships.length);

    const { pending, accepted } = splitRelationshipsByStatus(relationships);

    // ref에서 핸들러 가져오기 (의존성 배열에서 제외)
    const { onAccept: onAcceptHandler, onReject: onRejectHandler, onCancel: onCancelHandler, onChat: onChatHandler, onDelete: onDeleteHandler, onItemClick: onItemClickHandler } = handlersRef.current;

    const pendingItems: ArcYouRelationItemProps[] = pending.map(
      (relationship) =>
        relationshipToItemProps(
          relationship,
          onAcceptHandler,
          onRejectHandler,
          onCancelHandler,
          onChatHandler,
          onDeleteHandler,
          onItemClickHandler
        )
    );

    const friendItems: ArcYouRelationItemProps[] = accepted.map(
      (relationship) =>
        relationshipToItemProps(
          relationship,
          onAcceptHandler,
          onRejectHandler,
          onCancelHandler,
          onChatHandler,
          onDeleteHandler,
          onItemClickHandler
        )
    );

    console.log('[ArcYouRelation] 변환 완료:', {
      pendingItems: pendingItems.length,
      friendItems: friendItems.length,
    });

    return {
      pendingItems: pendingItems,
      friendItems,
    };
  }, [relationships]); // 핸들러 의존성 제거

  return (
    <div className={cn('w-full flex flex-col gap-6', className)}>
      {/* 친구 추가 폼 */}
      {onAdd && onAddEmailChange && (
        <ArcYouRelationAdd
          email={addEmail}
          onEmailChange={onAddEmailChange}
          onSubmit={onAdd}
        />
      )}

      {/* 위쪽: pending 상태 리스트 */}
      {pendingItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium text-muted-foreground px-3">
            친구 요청
          </div>
          <ArcYouRelationList
            items={pendingItems}
            emptyMessage={pendingEmptyMessage}
            className={cn('space-y-1', pendingListClassName)}
          />
        </div>
      )}

      {/* 아래쪽: 일반 친구 리스트 */}
      {friendItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium text-muted-foreground px-3">
            친구 목록
          </div>
          <ArcYouRelationList
            items={friendItems}
            emptyMessage={friendsEmptyMessage}
            className={cn('space-y-1', friendsListClassName)}
          />
        </div>
      )}
    </div>
  );
}


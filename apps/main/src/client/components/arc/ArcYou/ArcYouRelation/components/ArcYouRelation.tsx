'use client';

import * as React from 'react';

import { cn } from '@/client/components/ui/utils';
import type { ArcyouChatRelationship } from '@/share/schema/drizzles/arcyou-chat-relationship-drizzle';

import type { ArcYouRelationItemProps } from './ArcYouRelationItem';
import { ArcYouRelationList } from './ArcYouRelationList';

/**
 * 관계 데이터와 대상 사용자 정보를 결합한 타입
 */
export interface RelationshipWithTargetUser extends ArcyouChatRelationship {
  /**
   * 대상 사용자 정보
   */
  targetUser: {
    id: string;
    name: string;
    email: string;
    imageUrl?: string | null;
  };
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
   * 아이템 클릭 핸들러
   */
  onItemClick?: (relationship: RelationshipWithTargetUser) => void;
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
 * 관계 데이터를 ArcYouRelationItemProps로 변환하는 헬퍼 함수
 */
function relationshipToItemProps(
  relationship: RelationshipWithTargetUser,
  onAccept?: (relationship: RelationshipWithTargetUser) => void,
  onReject?: (relationship: RelationshipWithTargetUser) => void,
  onItemClick?: (relationship: RelationshipWithTargetUser) => void
): ArcYouRelationItemProps {
  return {
    userId: relationship.targetUser.id,
    name: relationship.targetUser.name,
    email: relationship.targetUser.email,
    profile: {
      imageUrl: relationship.targetUser.imageUrl || undefined,
      name: relationship.targetUser.name,
    },
    status: relationship.status,
    onAccept: onAccept ? () => onAccept(relationship) : undefined,
    onReject: onReject ? () => onReject(relationship) : undefined,
    onClick: onItemClick ? () => onItemClick(relationship) : undefined,
  };
}

export function ArcYouRelation({
  relationships,
  onAccept,
  onReject,
  onItemClick,
  className,
  pendingListClassName,
  friendsListClassName,
  pendingEmptyMessage = '친구 요청이 없습니다',
  friendsEmptyMessage = '친구가 없습니다',
}: ArcYouRelationProps): React.ReactElement {
  // pending 상태와 그 외 상태로 분리
  const { pendingItems, friendItems } = React.useMemo(() => {
    const pending: ArcYouRelationItemProps[] = [];
    const friends: ArcYouRelationItemProps[] = [];

    relationships.forEach((relationship) => {
      const itemProps = relationshipToItemProps(
        relationship,
        onAccept,
        onReject,
        onItemClick
      );

      if (relationship.status === 'pending') {
        pending.push(itemProps);
      } else {
        friends.push(itemProps);
      }
    });

    return {
      pendingItems: pending,
      friendItems: friends,
    };
  }, [relationships, onAccept, onReject, onItemClick]);

  return (
    <div className={cn('w-full flex flex-col gap-6', className)}>
      {/* 위쪽: pending 상태 리스트 */}
      <ArcYouRelationList
        items={pendingItems}
        emptyMessage={pendingEmptyMessage}
        className={cn('space-y-1', pendingListClassName)}
      />

      {/* 아래쪽: 일반 친구 리스트 */}
      <ArcYouRelationList
        items={friendItems}
        emptyMessage={friendsEmptyMessage}
        className={cn('space-y-1', friendsListClassName)}
      />
    </div>
  );
}


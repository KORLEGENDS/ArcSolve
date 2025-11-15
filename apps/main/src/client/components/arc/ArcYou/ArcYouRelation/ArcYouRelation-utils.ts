/**
 * ArcYouRelation 관련 유틸 함수
 */

import type { RelationshipWithTargetUser } from './ArcYouRelation';
import type { ArcYouRelationItemProps } from './components/ArcYouRelationItem';

/**
 * 관계 데이터의 기본 프로필/텍스트 정보를 ArcYouRelationItemProps로 변환하는 기본 매핑 함수
 * 
 * 이 함수는 공통 필드 매핑만 담당하며, 핸들러는 호출자가 추가해야 합니다.
 * 필드가 추가되거나 변경될 때 이 함수만 수정하면 됩니다.
 */
export function relationshipToBaseItemProps(
  relationship: RelationshipWithTargetUser
): Pick<
  ArcYouRelationItemProps,
  'userId' | 'name' | 'email' | 'profile' | 'status'
> {
  return {
    userId: relationship.targetUser.id,
    name: relationship.targetUser.name,
    email: relationship.targetUser.email,
    profile: {
      imageUrl: relationship.targetUser.imageUrl || undefined,
      name: relationship.targetUser.name,
    },
    status: relationship.status,
  };
}

/**
 * 관계 데이터를 ArcYouRelationItemProps로 변환하는 헬퍼 함수 (친구 탭용)
 * 
 * 상태와 플래그를 보고 수락/거절/취소/대화/삭제 버튼을 적절히 연결합니다.
 */
export function relationshipToItemPropsWithActions(
  relationship: RelationshipWithTargetUser,
  onAccept?: (relationship: RelationshipWithTargetUser) => void,
  onReject?: (relationship: RelationshipWithTargetUser) => void,
  onCancel?: (relationship: RelationshipWithTargetUser) => void,
  onChat?: (relationship: RelationshipWithTargetUser) => void,
  onDelete?: (relationship: RelationshipWithTargetUser) => void,
  onItemClick?: (relationship: RelationshipWithTargetUser) => void
): ArcYouRelationItemProps {
  const base = relationshipToBaseItemProps(relationship);

  // pending 상태이고 받은 요청인 경우만 수락/거부 버튼 표시
  const canAcceptOrReject =
    relationship.status === 'pending' && relationship.isReceivedRequest === true;

  // pending 상태이고 보낸 요청인 경우 취소 버튼 표시
  const canCancel =
    relationship.status === 'pending' && relationship.isReceivedRequest === false;

  // accepted 상태일 때 대화/삭제 버튼 표시
  const canChatOrDelete = relationship.status === 'accepted';

  return {
    ...base,
    onAccept: canAcceptOrReject && onAccept ? () => onAccept(relationship) : undefined,
    onReject: canAcceptOrReject && onReject ? () => onReject(relationship) : undefined,
    onCancel: canCancel && onCancel ? () => onCancel(relationship) : undefined,
    onChat: canChatOrDelete && onChat ? () => onChat(relationship) : undefined,
    onDelete: canChatOrDelete && onDelete ? () => onDelete(relationship) : undefined,
    onClick: onItemClick ? () => onItemClick(relationship) : undefined,
  };
}

/**
 * 관계 데이터를 ArcYouRelationItemProps로 변환하는 헬퍼 함수 (채팅 생성용)
 * 
 * 단순히 프로필/텍스트 정보와 onClick 핸들러만 연결합니다.
 */
export function relationshipToItemPropsWithClick(
  relationship: RelationshipWithTargetUser,
  onFriendClick: (relationship: RelationshipWithTargetUser) => void
): ArcYouRelationItemProps {
  const base = relationshipToBaseItemProps(relationship);

  return {
    ...base,
    onClick: () => onFriendClick(relationship),
  };
}


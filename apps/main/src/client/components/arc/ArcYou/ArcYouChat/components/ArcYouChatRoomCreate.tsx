'use client';

import * as React from 'react';

import type { RelationshipWithTargetUser } from '@/client/components/arc/ArcYou/ArcYouRelation/ArcYouRelation';
import { relationshipToItemPropsWithClick } from '@/client/components/arc/ArcYou/ArcYouRelation/ArcYouRelation-utils';
import type { ArcYouRelationItemProps } from '@/client/components/arc/ArcYou/ArcYouRelation/components/ArcYouRelationItem';
import { ArcYouRelationList } from '@/client/components/arc/ArcYou/ArcYouRelation/components/ArcYouRelationList';
import { Badge } from '@/client/components/ui/badge';
import { Button } from '@/client/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/client/components/ui/collapsible';
import { Input } from '@/client/components/ui/input';
import { cn } from '@/client/components/ui/utils';
import { X } from 'lucide-react';

export interface ArcYouChatRoomCreateProps {
  /**
   * 채팅방 타입
   */
  type: 'direct' | 'group';
  /**
   * 검색어 입력값
   */
  searchQuery: string;
  /**
   * 검색어 변경 핸들러
   */
  onSearchQueryChange: (query: string) => void;
  /**
   * 디바운스된 검색어 (내부적으로 관리)
   */
  debouncedSearchQuery?: string;
  /**
   * 검색 결과 (친구 목록)
   */
  searchResults?: RelationshipWithTargetUser[];
  /**
   * 검색 로딩 상태
   */
  isSearching?: boolean;
  /**
   * 친구 클릭 핸들러
   * 1:1일 때는 즉시 대화방 생성, 그룹일 때는 badge 추가
   */
  onFriendClick: (relationship: RelationshipWithTargetUser) => void;
  /**
   * 선택된 친구 목록 (그룹일 때만 사용)
   */
  selectedFriends?: RelationshipWithTargetUser[];
  /**
   * 선택된 친구 제거 핸들러 (그룹일 때만 사용)
   */
  onRemoveFriend?: (relationship: RelationshipWithTargetUser) => void;
  /**
   * 그룹 채팅방 생성 핸들러 (그룹일 때만 사용)
   */
  onCreateRoom?: () => void;
  /**
   * 생성 중 로딩 상태 (그룹일 때만 사용)
   */
  isCreating?: boolean;
  /**
   * 추가 클래스명
   */
  className?: string;
}


export function ArcYouChatRoomCreate({
  type,
  searchQuery,
  onSearchQueryChange,
  debouncedSearchQuery = '',
  searchResults = [],
  isSearching = false,
  onFriendClick,
  selectedFriends = [],
  onRemoveFriend,
  onCreateRoom,
  isCreating = false,
  className,
}: ArcYouChatRoomCreateProps): React.ReactElement {
  // 검색 결과를 아이템 props로 변환
  // 선택된 친구는 검색 결과에서 제외
  const searchItems: ArcYouRelationItemProps[] = React.useMemo(() => {
    const selectedIds = new Set(selectedFriends.map((f) => f.targetUser.id));
    const filteredResults = searchResults.filter((rel) => !selectedIds.has(rel.targetUser.id));
    return filteredResults.map((rel) => relationshipToItemPropsWithClick(rel, onFriendClick));
  }, [searchResults, selectedFriends, onFriendClick]);

  return (
    <div className={cn('w-full flex flex-col gap-2', className)}>
      {/* 1행: 검색창 + 생성 버튼 */}
      <div className="w-full flex gap-2">
        {/* 좌측: 검색창 */}
        <div className="flex-1">
          <Input
            type="search"
            placeholder="친구 검색..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full"
          />
        </div>
        {/* 우측: 생성 버튼 (그룹일 때만 표시, 너비 좁게) */}
        {type === 'group' && (
          <Button
            onClick={onCreateRoom}
            disabled={selectedFriends.length === 0 || isCreating}
            variant="brand"
            size="sm"
            className="shrink-0"
          >
            {isCreating ? '생성 중...' : '생성'}
          </Button>
        )}
      </div>
      {/* 2행: 선택된 친구 목록(Badge) - 그룹일 때만 표시 */}
      {type === 'group' && (
        <Collapsible open={selectedFriends.length > 0}>
          <CollapsibleContent>
            <div className="w-full flex flex-wrap gap-2 p-2 items-center">
              {selectedFriends.map((friend) => (
                <Badge
                  key={friend.targetUser.id}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  <span className="text-xs">{friend.targetUser.name}</span>
                  {onRemoveFriend && (
                    <button
                      type="button"
                      onClick={() => onRemoveFriend(friend)}
                      className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5 transition-colors"
                      aria-label={`${friend.targetUser.name} 제거`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      {/* 검색 결과 표시 (디바운스된 검색어가 있을 때만) */}
      {debouncedSearchQuery.trim().length > 0 && (
        <div className="w-full max-h-64 overflow-y-auto">
          {isSearching ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              검색 중...
            </div>
          ) : (
            <ArcYouRelationList
              items={searchItems}
              emptyMessage="검색 결과가 없습니다"
            />
          )}
        </div>
      )}
    </div>
  );
}


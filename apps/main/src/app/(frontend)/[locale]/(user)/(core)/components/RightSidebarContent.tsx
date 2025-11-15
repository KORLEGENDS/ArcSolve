'use client';

import { ArcManager } from '@/client/components/arc/ArcManager/ArcManager';
import {
  ArcYouChatRoomCreate,
  ArcYouChatRoomList,
  type ArcYouChatRoomListItemProps,
} from '@/client/components/arc/ArcYou/ArcYouChat';
import {
  ArcYouRelation,
  type RelationshipWithTargetUser as ComponentRelationshipWithTargetUser,
} from '@/client/components/arc/ArcYou/ArcYouRelation/ArcYouRelation';
import { useArcyouChat, useRoomActivitySocket } from '@/client/states/queries/useArcyouChat';
import { useServiceEnsureOpenTab } from '@/client/states/stores/service-store';
import { useArcYou } from '@/share/api/client/useArcYou';
import type { RelationshipWithTargetUser as ApiRelationshipWithTargetUser } from '@/share/libs/react-query/query-options';
import { relationQueryOptions } from '@/share/libs/react-query/query-options';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, MessageSquare, Users } from 'lucide-react';
import * as React from 'react';

export function RightSidebarContent() {
  // 방 목록을 실시간으로 최신화하기 위한 room-activity WebSocket 연결
  useRoomActivitySocket();

  // 1:1 채팅방과 그룹 채팅방을 각각 조회
  const {
    data: directRoomsData,
    isLoading: isDirectLoading,
    error: directError,
    createRoom,
  } = useArcyouChat('direct');
  const {
    data: groupRoomsData,
    isLoading: isGroupLoading,
    error: groupError,
    createRoom: createGroupRoom,
    isCreating: isCreatingGroupRoom,
  } = useArcyouChat('group');
  const {
    data: relationshipsData,
    isLoading: isRelationsLoading,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    deleteFriendRelation,
  } = useArcYou();
  const ensureOpen = useServiceEnsureOpenTab();
  const [addEmail, setAddEmail] = React.useState('');
  const [directSearchQuery, setDirectSearchQuery] = React.useState('');
  const [groupSearchQuery, setGroupSearchQuery] = React.useState('');
  const [selectedGroupFriends, setSelectedGroupFriends] = React.useState<ComponentRelationshipWithTargetUser[]>([]);

  // 디바운스된 검색어 (0.3초)
  const [directDebouncedQuery, setDirectDebouncedQuery] = React.useState('');
  const [groupDebouncedQuery, setGroupDebouncedQuery] = React.useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDirectDebouncedQuery(directSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [directSearchQuery]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setGroupDebouncedQuery(groupSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [groupSearchQuery]);

  // 1:1 채팅 친구 검색 (디바운스된 검색어 사용)
  const {
    data: directSearchResults,
    isLoading: isDirectSearching,
  } = useQuery(relationQueryOptions.search(directDebouncedQuery));

  // 그룹 채팅 친구 검색 (디바운스된 검색어 사용)
  const {
    data: groupSearchResults,
    isLoading: isGroupSearching,
  } = useQuery(relationQueryOptions.search(groupDebouncedQuery));

  const handleSendFriendRequest = React.useCallback(
    async (email: string) => {
      try {
        await sendFriendRequest({ email });
        setAddEmail('');
      } catch (err) {
        console.error('친구 요청 실패:', err);
        // 에러는 React Query가 처리하므로 여기서는 로그만 출력
      }
    },
    [sendFriendRequest]
  );

  const handleAcceptFriendRequest = React.useCallback(
    async (relationship: ComponentRelationshipWithTargetUser) => {
      try {
        // isReceivedRequest가 true일 때만 호출되므로, targetUser.id가 요청자 ID
        await acceptFriendRequest(relationship.targetUser.id);
      } catch (err) {
        console.error('친구 요청 수락 실패:', err);
        // 에러는 React Query가 처리하므로 여기서는 로그만 출력
      }
    },
    [acceptFriendRequest]
  );

  const handleRejectFriendRequest = React.useCallback(
    async (relationship: ComponentRelationshipWithTargetUser) => {
      try {
        // isReceivedRequest가 true일 때만 호출되므로, targetUser.id가 요청자 ID
        await rejectFriendRequest(relationship.targetUser.id);
      } catch (err) {
        console.error('친구 요청 거절 실패:', err);
        // 에러는 React Query가 처리하므로 여기서는 로그만 출력
      }
    },
    [rejectFriendRequest]
  );

  const handleCancelFriendRequest = React.useCallback(
    async (relationship: ComponentRelationshipWithTargetUser) => {
      try {
        // isReceivedRequest가 false일 때만 호출되므로, targetUser.id가 대상 사용자 ID
        await cancelFriendRequest(relationship.targetUser.id);
      } catch (err) {
        console.error('친구 요청 취소 실패:', err);
        // 에러는 React Query가 처리하므로 여기서는 로그만 출력
      }
    },
    [cancelFriendRequest]
  );

  const handleChatWithFriend = React.useCallback(
    async (relationship: ComponentRelationshipWithTargetUser) => {
      try {
        const room = await createRoom({
          type: 'direct',
          name: relationship.targetUser.name,
          description: null,
          targetUserId: relationship.targetUser.id,
        });
        // 채팅방 열기
        if (room?.id) {
          ensureOpen({ id: room.id, type: 'arcyou-chat-room', name: room.name });
        }
      } catch (err) {
        console.error('1:1 채팅방 생성 실패:', err);
        // 에러는 React Query가 처리하므로 여기서는 로그만 출력
      }
    },
    [createRoom, ensureOpen]
  );

  // 1:1 채팅 검색 결과 클릭 핸들러 (즉시 대화방 생성)
  const handleDirectFriendClick = React.useCallback(
    async (relationship: ComponentRelationshipWithTargetUser) => {
      await handleChatWithFriend(relationship);
      setDirectSearchQuery(''); // 검색어 초기화
    },
    [handleChatWithFriend]
  );

  // 그룹 채팅 검색 결과 클릭 핸들러 (badge 추가)
  const handleGroupFriendClick = React.useCallback(
    (relationship: ComponentRelationshipWithTargetUser) => {
      // 이미 선택된 친구인지 확인
      const isAlreadySelected = selectedGroupFriends.some(
        (f) => f.targetUser.id === relationship.targetUser.id
      );
      if (!isAlreadySelected) {
        setSelectedGroupFriends((prev) => [...prev, relationship]);
        setGroupSearchQuery(''); // 검색어 초기화
      }
    },
    [selectedGroupFriends]
  );

  // 그룹 채팅 선택된 친구 제거 핸들러
  const handleRemoveGroupFriend = React.useCallback(
    (relationship: ComponentRelationshipWithTargetUser) => {
      setSelectedGroupFriends((prev) =>
        prev.filter((f) => f.targetUser.id !== relationship.targetUser.id)
      );
    },
    []
  );

  // 그룹 채팅방 생성 핸들러
  const handleCreateGroupRoom = React.useCallback(
    async () => {
      if (selectedGroupFriends.length === 0) return;

      try {
        const memberIds = selectedGroupFriends.map((f) => f.targetUser.id);
        // 채팅방 이름 생성: 선택된 친구 이름들을 조합
        const roomName =
          selectedGroupFriends.length === 1
            ? selectedGroupFriends[0].targetUser.name
            : selectedGroupFriends.length === 2
              ? `${selectedGroupFriends[0].targetUser.name}, ${selectedGroupFriends[1].targetUser.name}`
              : `${selectedGroupFriends[0].targetUser.name} 외 ${selectedGroupFriends.length - 1}명`;

        const room = await createGroupRoom({
          type: 'group',
          name: roomName,
          description: null,
          memberIds,
        });

        // 생성 성공 후 처리
        if (room?.id) {
          ensureOpen({ id: room.id, type: 'arcyou-chat-room', name: room.name });
          setSelectedGroupFriends([]); // 선택된 친구 목록 초기화
          setGroupSearchQuery(''); // 검색어 초기화
        }
      } catch (err) {
        console.error('그룹 채팅방 생성 실패:', err);
        // 에러는 React Query가 처리하므로 여기서는 로그만 출력
      }
    },
    [selectedGroupFriends, createGroupRoom, ensureOpen]
  );

  // 검색 결과를 컴포넌트 타입으로 변환
  const directSearchResultsTransformed: ComponentRelationshipWithTargetUser[] = React.useMemo(() => {
    if (!directSearchResults) return [];
    return directSearchResults.map((rel: ApiRelationshipWithTargetUser) => ({
      ...rel,
      requestedAt: rel.requestedAt ? new Date(rel.requestedAt) : null,
      respondedAt: rel.respondedAt ? new Date(rel.respondedAt) : null,
      blockedAt: rel.blockedAt ? new Date(rel.blockedAt) : null,
    })) as ComponentRelationshipWithTargetUser[];
  }, [directSearchResults]);

  const groupSearchResultsTransformed: ComponentRelationshipWithTargetUser[] = React.useMemo(() => {
    if (!groupSearchResults) return [];
    return groupSearchResults.map((rel: ApiRelationshipWithTargetUser) => ({
      ...rel,
      requestedAt: rel.requestedAt ? new Date(rel.requestedAt) : null,
      respondedAt: rel.respondedAt ? new Date(rel.respondedAt) : null,
      blockedAt: rel.blockedAt ? new Date(rel.blockedAt) : null,
    })) as ComponentRelationshipWithTargetUser[];
  }, [groupSearchResults]);

  const handleDeleteFriend = React.useCallback(
    async (relationship: ComponentRelationshipWithTargetUser) => {
      try {
        await deleteFriendRelation(relationship.targetUser.id);
      } catch (err) {
        console.error('친구 삭제 실패:', err);
        // 에러는 React Query가 처리하므로 여기서는 로그만 출력
      }
    },
    [deleteFriendRelation]
  );

  // API 응답을 컴포넌트 타입으로 변환 (Date 필드 변환)
  const relationships: ComponentRelationshipWithTargetUser[] = React.useMemo(() => {
    if (!relationshipsData) {
      return [];
    }

    if (!Array.isArray(relationshipsData)) {
      console.error('[RightSidebarContent] relationshipsData가 배열이 아님:', relationshipsData);
      return [];
    }

    return relationshipsData.map((rel: ApiRelationshipWithTargetUser) => ({
      ...rel,
      requestedAt: rel.requestedAt ? new Date(rel.requestedAt) : null,
      respondedAt: rel.respondedAt ? new Date(rel.respondedAt) : null,
      blockedAt: rel.blockedAt ? new Date(rel.blockedAt) : null,
    })) as ComponentRelationshipWithTargetUser[];
  }, [relationshipsData]);

  // 1:1 채팅방 데이터를 컴포넌트 props 형식으로 변환
  const directRooms: ArcYouChatRoomListItemProps[] = React.useMemo(() => {
    if (!directRoomsData) return [];

    return directRoomsData.map((room) => ({
      id: room.id,
      name: room.name,
      description: room.description || undefined,
      lastMessageId: room.lastMessageId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      deletedAt: null, // API 응답에 없지만 타입 호환성을 위해 null 설정
      onClick: () => {
        console.log(`채팅방 선택: ${room.name} (${room.id})`);
        // TODO: 채팅방 선택 로직 구현
      },
      menuOptions: [
        {
          label: '대화방 정보',
          onClick: () => {
            console.log(`대화방 정보: ${room.name} (${room.id})`);
            // TODO: 대화방 정보 모달 표시
          },
        },
        {
          label: '알림 끄기',
          onClick: () => {
            console.log(`알림 끄기: ${room.name} (${room.id})`);
            // TODO: 알림 설정 변경
          },
        },
        {
          label: '대화방 나가기',
          onClick: () => {
            console.log(`대화방 나가기: ${room.name} (${room.id})`);
            // TODO: 대화방 나가기 로직 구현
          },
          separator: true,
        },
      ],
    }));
  }, [directRoomsData]);

  // 그룹 채팅방 데이터를 컴포넌트 props 형식으로 변환
  const groupRooms: ArcYouChatRoomListItemProps[] = React.useMemo(() => {
    if (!groupRoomsData) return [];

    return groupRoomsData.map((room) => ({
      id: room.id,
      name: room.name,
      description: room.description || undefined,
      lastMessageId: room.lastMessageId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      deletedAt: null, // API 응답에 없지만 타입 호환성을 위해 null 설정
      onClick: () => {
        console.log(`채팅방 선택: ${room.name} (${room.id})`);
        // TODO: 채팅방 선택 로직 구현
      },
      menuOptions: [
        {
          label: '대화방 정보',
          onClick: () => {
            console.log(`대화방 정보: ${room.name} (${room.id})`);
            // TODO: 대화방 정보 모달 표시
          },
        },
        {
          label: '알림 끄기',
          onClick: () => {
            console.log(`알림 끄기: ${room.name} (${room.id})`);
            // TODO: 알림 설정 변경
          },
        },
        {
          label: '대화방 나가기',
          onClick: () => {
            console.log(`대화방 나가기: ${room.name} (${room.id})`);
            // TODO: 대화방 나가기 로직 구현
          },
          separator: true,
        },
      ],
    }));
  }, [groupRoomsData]);

  const tabs = React.useMemo(
    () => [
      { value: 'friends', icon: Users, label: '친구' },
      { value: 'direct', icon: MessageCircle, label: '1:1 채팅' },
      { value: 'group', icon: MessageSquare, label: '그룹 채팅' },
    ],
    []
  );

  return (
    <ArcManager className="h-full" tabs={tabs} defaultTab="direct">
      {/* 친구 탭 */}
      <ArcManager.TabPanel value="friends">
        <div className="h-full w-full overflow-y-auto py-2">
          {isRelationsLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              친구 목록을 불러오는 중...
            </div>
          ) : (
            <ArcYouRelation
              relationships={relationships}
              addEmail={addEmail}
              onAddEmailChange={setAddEmail}
              onAdd={handleSendFriendRequest}
              onAccept={handleAcceptFriendRequest}
              onReject={handleRejectFriendRequest}
              onCancel={handleCancelFriendRequest}
              onChat={handleChatWithFriend}
              onDelete={handleDeleteFriend}
            />
          )}
        </div>
      </ArcManager.TabPanel>

      {/* 1:1 채팅 탭 */}
      <ArcManager.TabPanel value="direct">
        <div className="h-full w-full flex flex-col">
          {/* 채팅방 생성 컴포넌트 */}
          <div className="px-2 py-2">
            <ArcYouChatRoomCreate
              type="direct"
              searchQuery={directSearchQuery}
              onSearchQueryChange={setDirectSearchQuery}
              debouncedSearchQuery={directDebouncedQuery}
              searchResults={directSearchResultsTransformed}
              isSearching={isDirectSearching}
              onFriendClick={handleDirectFriendClick}
            />
          </div>
          {/* 채팅방 목록 */}
          <div className="flex-1 overflow-y-auto py-2 w-full">
            {isDirectLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                1:1 채팅 목록을 불러오는 중...
              </div>
            ) : directError ? (
              <div className="flex items-center justify-center py-8 text-sm text-destructive">
                1:1 채팅 목록을 불러오는 중 오류가 발생했습니다.
              </div>
            ) : directRooms.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                참여 중인 1:1 채팅이 없습니다.
              </div>
            ) : (
              <ArcYouChatRoomList rooms={directRooms} />
            )}
          </div>
        </div>
      </ArcManager.TabPanel>

      {/* 그룹 채팅 탭 */}
      <ArcManager.TabPanel value="group">
        <div className="h-full w-full flex flex-col">
          {/* 채팅방 생성 컴포넌트 */}
          <div className="px-2 py-2">
            <ArcYouChatRoomCreate
              type="group"
              searchQuery={groupSearchQuery}
              onSearchQueryChange={setGroupSearchQuery}
              debouncedSearchQuery={groupDebouncedQuery}
              searchResults={groupSearchResultsTransformed}
              isSearching={isGroupSearching}
              onFriendClick={handleGroupFriendClick}
              selectedFriends={selectedGroupFriends}
              onRemoveFriend={handleRemoveGroupFriend}
              onCreateRoom={handleCreateGroupRoom}
              isCreating={isCreatingGroupRoom}
            />
          </div>
          {/* 채팅방 목록 */}
          <div className="flex-1 overflow-y-auto py-2 w-full">
            {isGroupLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                그룹 채팅 목록을 불러오는 중...
              </div>
            ) : groupError ? (
              <div className="flex items-center justify-center py-8 text-sm text-destructive">
                그룹 채팅 목록을 불러오는 중 오류가 발생했습니다.
              </div>
            ) : groupRooms.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                참여 중인 그룹 채팅방이 없습니다.
              </div>
            ) : (
              <ArcYouChatRoomList rooms={groupRooms} />
            )}
          </div>
        </div>
      </ArcManager.TabPanel>
    </ArcManager>
  );
}


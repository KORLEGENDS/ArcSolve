'use client';

import { ArcManager } from '@/client/components/arc/ArcManager/ArcManager';
import { useArcWorkTabCreateAdapter } from '@/client/components/arc/ArcWork/adapters/useArcWorkTabCreateAdapter';
import { useArcWorkTabNameUpdateAdapter } from '@/client/components/arc/ArcWork/adapters/useArcWorkTabNameUpdateAdapter';
import { ArcYouRelationRoomCreate, ArcYouChatRoomList } from '@/client/components/arc/ArcYou/ArcYouChat';
import { ArcYouRelation } from '@/client/components/arc/ArcYou/ArcYouRelation/ArcYouRelation';
import {
  type ArcYouRelationWithTargetUser,
  useArcYouRelation,
  useArcYouRelationSearch,
} from '@/client/states/queries/arcyou/useArcYouRelation';
import { useArcYouChatRooms, useCreateArcyouChatRoom } from '@/client/states/queries/arcyou/useArcyouChat';
import { MessageCircle, MessageSquare, Users } from 'lucide-react';
import * as React from 'react';

export function RightSidebarContent() {
  const { syncTabNameFromRemote } = useArcWorkTabNameUpdateAdapter();

  // 방 목록을 실시간으로 최신화하기 위한 room-activity WebSocket 연결
  useArcYouChatRooms({
    onRoomUpdated: React.useCallback(
      (room: { id: string; name?: string | null }) => {
        if (!room.id || !room.name) return;
        // ArcWork에서 해당 채팅방 탭이 열려 있다면 탭 제목도 함께 동기화
        syncTabNameFromRemote({
          id: room.id,
          type: 'arcyou-chat-room',
          newName: room.name,
        });
      },
      [syncTabNameFromRemote]
    ),
  });

  // 1:1 채팅방과 그룹 채팅방을 각각 조회
  const { createRoom: createDirectRoom } = useCreateArcyouChatRoom();
  const {
    createRoom: createGroupRoom,
    isCreating: isCreatingGroupRoom,
  } = useCreateArcyouChatRoom();
  const {
    relationships,
    isLoading: isRelationsLoading,
    sendFriendRequest,
    handlers: relationHandlers,
  } = useArcYouRelation();
  const { ensureOpenTab } = useArcWorkTabCreateAdapter();
  const [addEmail, setAddEmail] = React.useState('');
  const [directSearchQuery, setDirectSearchQuery] = React.useState('');
  const [groupSearchQuery, setGroupSearchQuery] = React.useState('');
  const [selectedGroupFriends, setSelectedGroupFriends] = React.useState<ArcYouRelationWithTargetUser[]>([]);

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
    results: directSearchResults,
    isLoading: isDirectSearching,
  } = useArcYouRelationSearch(directDebouncedQuery);

  // 그룹 채팅 친구 검색 (디바운스된 검색어 사용)
  const {
    results: groupSearchResults,
    isLoading: isGroupSearching,
  } = useArcYouRelationSearch(groupDebouncedQuery);

  const handleSendFriendRequest = React.useCallback(
    async (email: string) => {
      try {
        await sendFriendRequest(email);
        setAddEmail('');
      } catch (err) {
        console.error('친구 요청 실패:', err);
        // 에러는 React Query가 처리하므로 여기서는 로그만 출력
      }
    },
    [sendFriendRequest]
  );

  const handleAcceptFriendRequest = React.useCallback(
    async (relationship: ArcYouRelationWithTargetUser) => {
      try {
        await relationHandlers.accept(relationship);
      } catch (err) {
        console.error('친구 요청 수락 실패:', err);
      }
    },
    [relationHandlers]
  );

  const handleRejectFriendRequest = React.useCallback(
    async (relationship: ArcYouRelationWithTargetUser) => {
      try {
        await relationHandlers.reject(relationship);
      } catch (err) {
        console.error('친구 요청 거절 실패:', err);
      }
    },
    [relationHandlers]
  );

  const handleCancelFriendRequest = React.useCallback(
    async (relationship: ArcYouRelationWithTargetUser) => {
      try {
        await relationHandlers.cancel(relationship);
      } catch (err) {
        console.error('친구 요청 취소 실패:', err);
      }
    },
    [relationHandlers]
  );

  const handleChatWithFriend = React.useCallback(
    async (relationship: ArcYouRelationWithTargetUser) => {
      try {
        const room = await createDirectRoom({
          type: 'direct',
          name: relationship.targetUser.name,
          targetUserId: relationship.targetUser.id,
        });
        // 채팅방 열기
        if (room?.id) {
          ensureOpenTab({ id: room.id, type: 'arcyou-chat-room', name: room.name });
        }
      } catch (err) {
        console.error('1:1 채팅방 생성 실패:', err);
        // 에러는 React Query가 처리하므로 여기서는 로그만 출력
      }
    },
    [createDirectRoom, ensureOpenTab]
  );

  // 1:1 채팅 검색 결과 클릭 핸들러 (즉시 대화방 생성)
  const handleDirectFriendClick = React.useCallback(
    async (relationship: ArcYouRelationWithTargetUser) => {
      await handleChatWithFriend(relationship);
      setDirectSearchQuery(''); // 검색어 초기화
    },
    [handleChatWithFriend]
  );

  // 그룹 채팅 검색 결과 클릭 핸들러 (badge 추가)
  const handleGroupFriendClick = React.useCallback(
    (relationship: ArcYouRelationWithTargetUser) => {
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
    (relationship: ArcYouRelationWithTargetUser) => {
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
          memberIds,
        });

        // 생성 성공 후 처리
        if (room?.id) {
          ensureOpenTab({ id: room.id, type: 'arcyou-chat-room', name: room.name });
          setSelectedGroupFriends([]); // 선택된 친구 목록 초기화
          setGroupSearchQuery(''); // 검색어 초기화
        }
      } catch (err) {
        console.error('그룹 채팅방 생성 실패:', err);
        // 에러는 React Query가 처리하므로 여기서는 로그만 출력
      }
    },
    [selectedGroupFriends, createGroupRoom, ensureOpenTab]
  );

  const handleDeleteFriend = React.useCallback(
    async (relationship: ArcYouRelationWithTargetUser) => {
      try {
        await relationHandlers.delete(relationship);
      } catch (err) {
        console.error('친구 삭제 실패:', err);
        // 에러는 React Query가 처리하므로 여기서는 로그만 출력
      }
    },
    [relationHandlers]
  );

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
            <ArcYouRelationRoomCreate
              type="direct"
              searchQuery={directSearchQuery}
              onSearchQueryChange={setDirectSearchQuery}
              debouncedSearchQuery={directDebouncedQuery}
              searchResults={directSearchResults}
              isSearching={isDirectSearching}
              onFriendClick={handleDirectFriendClick}
            />
          </div>
          {/* 채팅방 목록 */}
          <div className="flex-1 overflow-y-auto py-2 w-full">
            <ArcYouChatRoomList type="direct" />
          </div>
        </div>
      </ArcManager.TabPanel>

      {/* 그룹 채팅 탭 */}
      <ArcManager.TabPanel value="group">
        <div className="h-full w-full flex flex-col">
          {/* 채팅방 생성 컴포넌트 */}
          <div className="px-2 py-2">
            <ArcYouRelationRoomCreate
              type="group"
              searchQuery={groupSearchQuery}
              onSearchQueryChange={setGroupSearchQuery}
              debouncedSearchQuery={groupDebouncedQuery}
              searchResults={groupSearchResults}
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
            <ArcYouChatRoomList type="group" />
          </div>
        </div>
      </ArcManager.TabPanel>
    </ArcManager>
  );
}


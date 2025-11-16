/**
 * 채팅방 관련 Query Options
 */

import { TIMEOUT } from '@/share/configs/constants/time-constants';
import { queryOptions } from '@tanstack/react-query';
import {
    createApiMutation,
    createApiQueryOptions
} from '../query-builder';
import { queryKeys } from '../query-keys';

/**
 * 채팅방 관련 타입 정의
 */
export type ArcyouChatRoom = {
  id: string;
  name: string;
  type: 'direct' | 'group';
  imageUrl: string | null;
  lastMessage: { content: string | null } | null;
  role: 'owner' | 'manager' | 'participant';
  lastReadMessageId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ChatRoomsListResponse = {
  rooms: ArcyouChatRoom[];
};

export type ChatRoomMember = {
  userId: string;
  role: 'owner' | 'manager' | 'participant';
  lastReadMessageId: string | null;
  name: string;
  email: string;
  imageUrl: string | null;
};

export type ChatRoomMembersResponse = {
  members: ChatRoomMember[];
};

/**
 * 채팅방 생성 뮤테이션 변수 타입
 */
export interface CreateChatRoomMutationVariables {
  type: 'direct' | 'group';
  name: string;
  targetUserId?: string; // direct 타입일 때 필수
  memberIds?: string[]; // group 타입일 때 필수 (최소 1명)
}

export type CreateChatRoomResponse = {
  room: ArcyouChatRoom;
};

/**
 * 채팅방 이름 수정 뮤테이션 변수 타입
 */
export interface RenameChatRoomMutationVariables {
  roomId: string;
  name: string;
}

export type RenameChatRoomResponse = {
  room: ArcyouChatRoom;
};

/**
 * 채팅방 관련 Query Options
 */
export const chatRoomQueryOptions = {
  /**
   * 사용자의 채팅방 목록 조회
   * @param type 채팅방 타입 필터 (선택사항)
   */
  list: (type?: 'direct' | 'group') => {
    const url = type
      ? `/api/arcyou/chat/rooms?type=${encodeURIComponent(type)}`
      : '/api/arcyou/chat/rooms';
    return queryOptions({
      queryKey: queryKeys.chatRooms.list(type),
      ...createApiQueryOptions<ChatRoomsListResponse['rooms'], ChatRoomsListResponse>(
        url,
        (data) => data.rooms,
        {
          staleTime: TIMEOUT.CACHE.SHORT, // 1분
          gcTime: TIMEOUT.CACHE.MEDIUM, // 5분
        }
      ),
    });
  },

  /**
   * 채팅방 생성 뮤테이션 옵션
   */
  create: createApiMutation<
    CreateChatRoomResponse['room'],
    CreateChatRoomResponse,
    CreateChatRoomMutationVariables
  >(
    () => '/api/arcyou/chat/rooms',
    (data) => data.room,
    {
      method: 'POST',
    }
  ),

  /**
   * 채팅방 이름 수정 뮤테이션 옵션
   */
  rename: createApiMutation<
    RenameChatRoomResponse['room'],
    RenameChatRoomResponse,
    RenameChatRoomMutationVariables
  >(
    (variables) => `/api/arcyou/chat/rooms/${variables.roomId}`,
    (data) => data.room,
    {
      method: 'PATCH',
      bodyExtractor: ({ roomId: _roomId, ...body }) => body,
    }
  ),

  /**
   * 채팅방 멤버 목록 조회
   */
  members: (roomId: string) =>
    queryOptions({
      queryKey: queryKeys.chatRooms.members(roomId),
      ...createApiQueryOptions<ChatRoomMembersResponse['members'], ChatRoomMembersResponse>(
        `/api/arcyou/chat/rooms/${roomId}/members`,
        (data) => data.members,
        {
          staleTime: TIMEOUT.CACHE.SHORT,
          gcTime: TIMEOUT.CACHE.MEDIUM,
        }
      ),
    }),
} as const;


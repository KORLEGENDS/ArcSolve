/**
 * TanStack Query v5 Query Key Factory
 * 타입 안전한 쿼리 키 생성 패턴
 */

import type { QueryClient } from '@tanstack/react-query';

/**
 * params 객체를 키 정규화를 위해 정렬/클린합니다.
 * - undefined/null/'' 제거
 * - 키 이름을 알파벳 순으로 정렬
 * - 배열은 값만 유지(순서 보전)
 */
function normalizeParams<T extends Record<string, unknown> | undefined>(
  params: T
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const entries = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '');
  const sorted = entries.sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0));
  const out: Record<string, unknown> = {};
  for (const [k, v] of sorted) {
    if (Array.isArray(v)) {
      const filtered = v.filter((x) => x !== undefined && x !== null && String(x).length > 0);
      if (filtered.length > 0) out[k] = filtered;
    } else {
      out[k] = v as unknown;
    }
  }
  return out;
}

/**
 * Query Key Factory 패턴
 * 일관된 쿼리 키 구조를 보장하고 캐시 무효화를 쉽게 만듦
 */
export const queryKeys = {
  // 사용자 관련
  users: {
    all: () => ['users'] as const,
    detail: (userId: string) =>
      [...queryKeys.users.all(), 'detail', userId] as const,
    preferences: (userId: string) =>
      [...queryKeys.users.detail(userId), 'preferences'] as const,
  },

  // (태스크 관련 키 제거됨)

  // 이벤트 관련
  events: {
    all: () => ['events'] as const,
    list: (params?: {
      projectId?: string;
      eventId?: string;
      from?: string;
      to?: string;
    }) =>
      params
        ? ([...queryKeys.events.all(), 'list', normalizeParams(params)] as const)
        : ([...queryKeys.events.all(), 'list'] as const),
    byId: (id: string) => [...queryKeys.events.all(), 'detail', id] as const,
  },

  // 채팅방 관련
  chatRooms: {
    all: () => ['chatRooms'] as const,
    list: (type?: 'direct' | 'group') =>
      type
        ? ([...queryKeys.chatRooms.all(), 'list', normalizeParams({ type })] as const)
        : ([...queryKeys.chatRooms.all(), 'list'] as const),
    byId: (roomId: string) => [...queryKeys.chatRooms.all(), 'detail', roomId] as const,
    members: (roomId: string) =>
      [...queryKeys.chatRooms.all(), 'members', roomId] as const,
  },

  // 친구 관계 관련
  relations: {
    all: () => ['relations'] as const,
    list: () => [...queryKeys.relations.all(), 'list'] as const,
    search: (query: string) =>
      query
        ? ([...queryKeys.relations.all(), 'search', normalizeParams({ q: query })] as const)
        : ([...queryKeys.relations.all(), 'search'] as const),
  },

  // 문서 관련
  documents: {
    all: () => ['documents'] as const,
    byId: (documentId: string) =>
      [...queryKeys.documents.all(), 'detail', documentId] as const,
  },
} as const;

/**
 * 쿼리 키 유틸리티 함수들
 */
export const queryKeyUtils = {
  /**
   * 특정 패턴의 모든 쿼리 무효화
   */
  invalidatePattern: (
    client: QueryClient,
    pattern: readonly string[]
  ): Promise<void> => {
    return client.invalidateQueries({ queryKey: pattern });
  },

  /**
   * 특정 사용자의 모든 관련 쿼리 무효화
   */
  invalidateUserQueries: (client: QueryClient, userId: string): void => {
    void client.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
  },

  /**
   * 특정 사용자의 preferences 쿼리 무효화
   */
  invalidateUserPreferences: (client: QueryClient, userId: string): void => {
    void client.invalidateQueries({
      queryKey: queryKeys.users.preferences(userId),
    });
  },

  /**
   * 이벤트 목록 쿼리 무효화
   */
  invalidateEventsList: (client: QueryClient): void => {
    void client.invalidateQueries({ queryKey: queryKeys.events.list() });
  },

  /**
   * 특정 이벤트 쿼리 무효화
   */
  invalidateEventById: (client: QueryClient, id: string): void => {
    void client.invalidateQueries({ queryKey: queryKeys.events.byId(id) });
  },

  /**
   * 채팅방 목록 쿼리 무효화
   */
  invalidateChatRoomsList: (client: QueryClient): void => {
    void client.invalidateQueries({ queryKey: queryKeys.chatRooms.list() });
  },

  /**
   * 특정 채팅방 쿼리 무효화
   */
  invalidateChatRoomById: (client: QueryClient, roomId: string): void => {
    void client.invalidateQueries({ queryKey: queryKeys.chatRooms.byId(roomId) });
  },

  /**
   * 친구 관계 목록 쿼리 무효화
   */
  invalidateRelationsList: (client: QueryClient): void => {
    void client.invalidateQueries({ queryKey: queryKeys.relations.list() });
  },
} as const;

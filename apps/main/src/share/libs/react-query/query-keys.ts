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
    downloadUrl: (documentId: string) =>
      [...queryKeys.documents.all(), 'download-url', documentId] as const,
    /**
     * ArcManager 문서 탭(노트/파일 도메인) 트리용 목록
     */
    listDocumentsDomain: () =>
      [...queryKeys.documents.all(), 'list', 'document'] as const,
    /**
     * ArcManager AI 탭 트리용 목록
     */
    listAi: () => [...queryKeys.documents.all(), 'list', 'ai'] as const,
    content: (documentId: string) =>
      [...queryKeys.documents.all(), 'content', documentId] as const,
  },

  // AI 관련 (document 기반 AI 세션)
  ai: {
    conversation: (documentId: string) =>
      ['ai', 'conversation', documentId] as const,
  },
} as const;

/**
 * Document 캐시 업데이트에 사용하는 최소 필드 형태
 */
type DocumentCacheItem = {
  documentId: string;
  path: string;
  name: string;
  kind: 'folder' | 'document';
  mimeType: string | null;
};

function isDocumentDomainDocument(doc: DocumentCacheItem): boolean {
  const mimeType = doc.mimeType ?? undefined;
  const isFolder = doc.kind === 'folder';

  const isNote =
    typeof mimeType === 'string' &&
    mimeType.startsWith('application/vnd.arc.note+');
  const isAiSession =
    typeof mimeType === 'string' &&
    mimeType === 'application/vnd.arc.ai-chat+json';

  const isDocumentFolder =
    isFolder &&
    (mimeType === null ||
      mimeType === 'application/vnd.arc.folder+document');

  const isFileLike =
    typeof mimeType === 'string' &&
    !isNote &&
    !isAiSession &&
    !mimeType.startsWith('application/vnd.arc.folder+');

  return isDocumentFolder || isNote || isFileLike;
}

function isAiDomainDocument(doc: DocumentCacheItem): boolean {
  const mimeType = doc.mimeType ?? undefined;
  const isFolder = doc.kind === 'folder';

  const isAiSession =
    typeof mimeType === 'string' &&
    mimeType === 'application/vnd.arc.ai-chat+json';
  const isAiFolder =
    isFolder && mimeType === 'application/vnd.arc.folder+ai';

  return isAiFolder || isAiSession;
}

function upsertDocumentInList(
  list: DocumentCacheItem[] | undefined,
  doc: DocumentCacheItem,
): DocumentCacheItem[] {
  if (!list || list.length === 0) return [doc];
  const index = list.findIndex((d) => d.documentId === doc.documentId);
  if (index === -1) return [...list, doc];
  const next = list.slice();
  next[index] = doc;
  return next;
}

function removeDocumentFromList(
  list: DocumentCacheItem[] | undefined,
  documentId: string,
): DocumentCacheItem[] | undefined {
  if (!list || list.length === 0) return list;
  const next = list.filter((d) => d.documentId !== documentId);
  return next;
}

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
   * 단일 Document에 대한 캐시를 직접 패치합니다.
   *
   * - action = 'add' | 'update'
   *   - 단일 문서 메타(byId)를 갱신하고,
   *   - 문서 도메인(listDocumentsDomain) / AI 도메인(listAi) 리스트에
   *     해당 문서를 추가 또는 교체합니다.
   *   - 서버의 /api/document kind=document|ai 필터링 규칙과 동일한 MIME 분기를 사용합니다.
   *
   * - action = 'remove'
   *   - 리스트에서 해당 documentId를 제거하고,
   *   - 단일 문서 메타 캐시(byId)를 제거합니다.
   */
  updateDocumentCache: (
    client: QueryClient,
    params:
      | {
          action: 'add' | 'update';
          document: DocumentCacheItem & Record<string, unknown>;
        }
      | {
          action: 'remove';
          documentId: string;
        },
  ): void => {
    if (params.action === 'remove') {
      const { documentId } = params;

      // 단일 메타 캐시 제거
      client.removeQueries({
        queryKey: queryKeys.documents.byId(documentId),
      });

      // 문서 도메인 리스트에서 제거
      const docListKey = queryKeys.documents.listDocumentsDomain();
      const currentDocList =
        client.getQueryData<DocumentCacheItem[]>(docListKey);
      if (currentDocList) {
        const nextDocList = removeDocumentFromList(
          currentDocList,
          documentId,
        );
        client.setQueryData<DocumentCacheItem[] | undefined>(
          docListKey,
          nextDocList,
        );
      }

      // AI 도메인 리스트에서 제거
      const aiListKey = queryKeys.documents.listAi();
      const currentAiList =
        client.getQueryData<DocumentCacheItem[]>(aiListKey);
      if (currentAiList) {
        const nextAiList = removeDocumentFromList(
          currentAiList,
          documentId,
        );
        client.setQueryData<DocumentCacheItem[] | undefined>(
          aiListKey,
          nextAiList,
        );
      }

      return;
    }

    const doc = params.document;
    const documentId = doc.documentId;

    // 단일 메타 캐시 갱신
    client.setQueryData(queryKeys.documents.byId(documentId), doc);

    // 문서 도메인(listDocumentsDomain) 리스트 패치
    const docListKey = queryKeys.documents.listDocumentsDomain();
    const currentDocList =
      client.getQueryData<DocumentCacheItem[]>(docListKey);
    if (isDocumentDomainDocument(doc)) {
      const nextDocList = upsertDocumentInList(currentDocList, doc);
      client.setQueryData<DocumentCacheItem[]>(docListKey, nextDocList);
    } else if (currentDocList) {
      // 도메인에서 벗어났다면 리스트에서 제거
      const nextDocList = removeDocumentFromList(
        currentDocList,
        documentId,
      );
      client.setQueryData<DocumentCacheItem[] | undefined>(
        docListKey,
        nextDocList,
      );
    }

    // AI 도메인(listAi) 리스트 패치
    const aiListKey = queryKeys.documents.listAi();
    const currentAiList =
      client.getQueryData<DocumentCacheItem[]>(aiListKey);
    if (isAiDomainDocument(doc)) {
      const nextAiList = upsertDocumentInList(currentAiList, doc);
      client.setQueryData<DocumentCacheItem[]>(aiListKey, nextAiList);
    } else if (currentAiList) {
      const nextAiList = removeDocumentFromList(currentAiList, documentId);
      client.setQueryData<DocumentCacheItem[] | undefined>(
        aiListKey,
        nextAiList,
      );
    }
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

'use client';

/**
 * ArcWork 문서 업로드/다운로드 전용 React Query 훅
 * - 업로드 3단계(request/presigned/confirm)와 다운로드 URL 발급을 캡슐화
 */

import { useArcWorkCloseTab } from '@/client/states/stores/arcwork-store';
import { queryKeys, queryKeyUtils } from '@/share/libs/react-query/query-keys';
import {
  documentQueryOptions,
  type DocumentContentDTO,
  type DocumentDTO,
  type DocumentMoveMutationVariables,
} from '@/share/libs/react-query/query-options';
import type { EditorContent } from '@/share/schema/zod/document-note-zod';
import type {
  DocumentDownloadUrlResponse,
  DocumentUploadConfirmRequest,
  DocumentUploadPresignRequest,
  DocumentUploadRequest,
  DocumentUploadRequestResponse,
} from '@/share/schema/zod/document-upload-zod';
import type { YoutubeDocumentCreateRequest } from '@/share/schema/zod/document-youtube-zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export interface UseDocumentUploadReturn {
  requestUpload: (input: DocumentUploadRequest) => Promise<DocumentUploadRequestResponse>;
  isRequesting: boolean;
  requestError: unknown;

  getPresignedUploadUrl: (
    input: DocumentUploadPresignRequest
  ) => Promise<{ uploadUrl: string; storageKey: string; expiresAt: string }>;
  isPresigning: boolean;
  presignError: unknown;

  confirmUpload: (input: DocumentUploadConfirmRequest) => Promise<DocumentDTO>;
  isConfirming: boolean;
  confirmError: unknown;

  /**
   * 단일 문서 캐시 무효화
   */
  invalidateDocument: (documentId: string) => Promise<void>;
}

export interface UseDocumentDownloadReturn {
  data: DocumentDownloadUrlResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<DocumentDownloadUrlResponse>;
}

export interface UseDocumentFilesReturn {
  data: DocumentDTO[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<DocumentDTO[]>;
}

export interface UseDocumentDetailReturn {
  data: DocumentDTO | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

export interface UseDocumentContentReturn {
  data: DocumentContentDTO | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

export type UpdateDocumentInput =
  | {
      mode: 'meta';
      documentId: string;
      name?: string;
    }
  | {
      mode: 'content';
      documentId: string;
      contents: unknown;
    };

export interface UseDocumentUpdateReturn {
  updateDocument: (input: UpdateDocumentInput) => Promise<void>;
  isUpdating: boolean;
  error: unknown;
}

export interface UseDocumentDeleteReturn {
  deleteDocument: (documentId: string) => Promise<void>;
  isDeleting: boolean;
  error: unknown;
}

export interface UseDocumentMoveReturn {
  move: (input: { documentId: string; parentPath: string }) => Promise<DocumentDTO>;
  isMoving: boolean;
  moveError: unknown;
}

type DocumentsListQueryKey =
  | ReturnType<typeof queryKeys.documents.listDocumentsDomain>
  | ReturnType<typeof queryKeys.documents.listAi>;

export interface UseDocumentFolderCreateReturn {
  createFolder: (input: {
    name: string;
    parentPath: string;
    domain: 'document' | 'ai';
  }) => Promise<DocumentDTO>;
  isCreating: boolean;
  createError: unknown;
}

export interface UseDocumentYoutubeCreateReturn {
  createYoutube: (input: YoutubeDocumentCreateRequest) => Promise<DocumentDTO>;
  isCreating: boolean;
  createError: unknown;
}

export interface UseDocumentCreateReturn {
  createDocument: (input: {
    kind: 'note';
    name: string;
    parentPath: string;
    contents?: EditorContent;
  }) => Promise<DocumentDTO>;
  isCreating: boolean;
  createError: unknown;
}

export function useDocumentUpload(): UseDocumentUploadReturn {
  const queryClient = useQueryClient();

  const requestMutation = useMutation(documentQueryOptions.uploadRequest);
  const presignMutation = useMutation(documentQueryOptions.uploadPresign);
  const confirmMutation = useMutation(documentQueryOptions.uploadConfirm);

  const invalidateDocument = useCallback(
    async (documentId: string) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.documents.byId(documentId),
      });
    },
    [queryClient],
  );

  return {
    requestUpload: requestMutation.mutateAsync,
    isRequesting: requestMutation.isPending,
    requestError: requestMutation.error,

    getPresignedUploadUrl: presignMutation.mutateAsync,
    isPresigning: presignMutation.isPending,
    presignError: presignMutation.error,

    confirmUpload: confirmMutation.mutateAsync,
    isConfirming: confirmMutation.isPending,
    confirmError: confirmMutation.error,

    invalidateDocument,
  };
}

/**
 * 문서 생성 훅
 * - 현재는 "노트(document.kind = 'document', note 계열 mimeType)"만 생성합니다.
 * - API 요청 스키마의 kind 필드는 디스크리미네이터로서 항상 'note'이며, DB의 kind('folder' | 'document')와는 별개입니다.
 */
export function useDocumentCreate(): UseDocumentCreateReturn {
  const queryClient = useQueryClient();
  const createMutation = useMutation(documentQueryOptions.create);

  const createDocument: UseDocumentCreateReturn['createDocument'] = useCallback(
    async (input) => {
      const { kind, name, parentPath, contents } = input;

      // kind에 따라 payload를 분기합니다. 현재는 'note' (노트 생성용 엔드포인트)만 지원합니다.
      if (kind === 'note') {
        const created = await createMutation.mutateAsync({
          kind: 'note',
          name,
          parentPath,
          contents,
        });

        // 단일 문서(노트) 추가에 대해 캐시를 직접 패치합니다.
        queryKeyUtils.updateDocumentCache(queryClient, {
          action: 'add',
          document: created,
        });

        return created;
      }

      throw new Error(`지원하지 않는 문서 종류입니다: ${kind}`);
    },
    [createMutation, queryClient],
  );

  return {
    createDocument,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
  };
}

/**
 * 서버 DocumentRepository.moveDocumentForOwner와 동일한 규칙으로
 * ltree 기반 경로 이동을 클라이언트 캐시에 적용합니다.
 */
function applyDocumentMoveOptimistic(
  list: DocumentDTO[],
  input: DocumentMoveMutationVariables,
): DocumentDTO[] {
  const { documentId, parentPath } = input;

  const moving = list.find((d) => d.documentId === documentId);
  if (!moving) return list;

  const oldPath = moving.path;
  if (!oldPath) return list;

  const normalizedTargetParent = parentPath.trim();

  // 자기 자신 또는 자신의 하위 경로로 이동하는 경우는 의미 없는 이동이므로 no-op 처리
  if (normalizedTargetParent) {
    const isSame = oldPath === normalizedTargetParent;
    const isDescendant = normalizedTargetParent.startsWith(`${oldPath}.`);
    if (isSame || isDescendant) {
      return list;
    }
  }

  const segments = oldPath.split('.').filter(Boolean);
  const selfLabel = segments[segments.length - 1] ?? '';
  const newBasePath = normalizedTargetParent
    ? `${normalizedTargetParent}.${selfLabel}`
    : selfLabel;

  return list.map((doc) => {
    const path = doc.path;

    // subtree 판별: oldPath 또는 oldPath.xxx
    if (path === oldPath || path.startsWith(`${oldPath}.`)) {
      let suffix = '';
      if (path.length > oldPath.length) {
        // "oldPath.xxx" 형태에서 뒤의 부분만 잘라냅니다.
        suffix = path.slice(oldPath.length + 1);
      }
      const newPath = suffix ? `${newBasePath}.${suffix}` : newBasePath;

      return {
        ...doc,
        path: newPath,
        updatedAt: new Date().toISOString(),
      };
    }

    return doc;
  });
}

/**
 * 문서 이동 훅
 * - documentId와 parentPath('' = 루트)를 입력으로 받아 path를 변경합니다.
 */
export function useDocumentMove(): UseDocumentMoveReturn {
  const queryClient = useQueryClient();
  const listQueryKeys: DocumentsListQueryKey[] = [
    queryKeys.documents.listDocumentsDomain(),
    queryKeys.documents.listAi(),
  ];

  const moveMutation = useMutation({
    mutationFn: documentQueryOptions.move.mutationFn,
    async onMutate(variables: DocumentMoveMutationVariables) {
      const snapshots: Array<{ key: DocumentsListQueryKey; previous?: DocumentDTO[] }> = [];

      // 각 문서 리스트 쿼리에 대해 refetch를 취소하고, 옵티미스틱 상태를 적용합니다.
      for (const key of listQueryKeys) {
        await queryClient.cancelQueries({ queryKey: key });

        const previous = queryClient.getQueryData<DocumentDTO[]>(key);
        snapshots.push({ key, previous });

        if (!previous) continue;
        const updated = applyDocumentMoveOptimistic(previous, variables);
        queryClient.setQueryData<DocumentDTO[]>(key, updated);
      }

      return { snapshots };
    },
    onError(_error, _variables, context) {
      if (!context?.snapshots) return;

      for (const { key, previous } of context.snapshots) {
        if (!previous) continue;
        queryClient.setQueryData<DocumentDTO[]>(key, previous);
      }
    },
    onSettled() {
      for (const key of listQueryKeys) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  return {
    move: moveMutation.mutateAsync,
    isMoving: moveMutation.isPending,
    moveError: moveMutation.error,
  };
}

/**
 * 폴더 생성 훅
 */
export function useDocumentFolderCreate(): UseDocumentFolderCreateReturn {
  const queryClient = useQueryClient();
  const createMutation = useMutation(documentQueryOptions.createFolder);

  return {
    createFolder: async (input) => {
      const { name, parentPath, domain } = input;
      const created = await createMutation.mutateAsync({
        name,
        parentPath,
        folderDomain: domain,
      });
      // 폴더도 Document로 취급되므로 공통 Document 캐시 패치를 사용합니다.
      queryKeyUtils.updateDocumentCache(queryClient, {
        action: 'add',
        document: created,
      });
      return created;
    },
    isCreating: createMutation.isPending,
    createError: createMutation.error,
  };
}

/**
 * 단일 문서 메타 조회 훅
 */
export function useDocumentDetail(documentId: string): UseDocumentDetailReturn {
  const query = useQuery(documentQueryOptions.detail(documentId));

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

/**
 * 단일 문서 콘텐츠(최신 버전) 조회 훅
 */
export function useDocumentContent(documentId: string): UseDocumentContentReturn {
  const query = useQuery(documentQueryOptions.content(documentId));

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

/**
 * 문서 메타/콘텐츠 통합 업데이트 훅
 */
export function useDocumentUpdate(): UseDocumentUpdateReturn {
  const queryClient = useQueryClient();

  const metaMutation = useMutation(documentQueryOptions.updateMeta);
  const contentMutation = useMutation(documentQueryOptions.updateContent);

  const updateDocument = useCallback(
    async (input: UpdateDocumentInput) => {
      if (input.mode === 'meta') {
        const { documentId, name } = input;
        const updated = await metaMutation.mutateAsync({ documentId, name });
        // 단일 문서 메타 변경은 캐시 패치로 처리합니다.
        queryKeyUtils.updateDocumentCache(queryClient, {
          action: 'update',
          document: updated,
        });
        return;
      }

      const { documentId, contents } = input;
      await contentMutation.mutateAsync({
        documentId,
        contentId: null,
        contents,
        version: null,
        createdAt: null,
        updatedAt: null,
      });

      // 콘텐츠는 문서 메타/리스트와 분리된 별도 쿼리이므로, 직접 해당 쿼리만 무효화합니다.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.documents.content(documentId),
      });
    },
    [metaMutation, contentMutation, queryClient],
  );

  return {
    updateDocument,
    isUpdating: metaMutation.isPending || contentMutation.isPending,
    error: metaMutation.error ?? contentMutation.error,
  };
}

/**
 * YouTube 링크 기반 문서 생성 훅
 * - ArcManager 파일 탭에서 YouTube URL을 문서로 추가할 때 사용합니다.
 */
export function useDocumentYoutubeCreate(): UseDocumentYoutubeCreateReturn {
  const queryClient = useQueryClient();
  const createMutation = useMutation(documentQueryOptions.createYoutube);

  return {
    createYoutube: async (input) => {
      const created = await createMutation.mutateAsync(input);
      queryKeyUtils.updateDocumentCache(queryClient, {
        action: 'add',
        document: created,
      });
      return created;
    },
    isCreating: createMutation.isPending,
    createError: createMutation.error,
  };
}

function createDocumentListHook(
  getOptions: () =>
    | ReturnType<typeof documentQueryOptions.listDocumentsDomain>
    | ReturnType<typeof documentQueryOptions.listAi>,
) {
  return function useDocumentList(): UseDocumentFilesReturn {
    const query = useQuery<DocumentDTO[]>(getOptions() as any);

    const refetch = useCallback(
      async () => {
        const res = await query.refetch();
        if (res.data) return res.data;
        throw res.error ?? new Error('문서 목록을 불러오지 못했습니다.');
      },
      [query],
    );

    return {
      data: query.data,
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error,
      refetch,
    };
  };
}

/**
 * 현재 사용자 기준 노트/파일 도메인(document) 문서 목록 조회 훅
 * - ArcManager documents 탭 등에서 사용
 */
export const useDocumentDocumentsDomain = createDocumentListHook(
  documentQueryOptions.listDocumentsDomain,
);

/**
 * 현재 사용자 기준 AI 세션 문서 목록 조회 훅
 */
export const useDocumentAiSessions = createDocumentListHook(
  documentQueryOptions.listAi,
);

/**
 * 문서 삭제 훅
 */
export function useDocumentDelete(): UseDocumentDeleteReturn {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation(documentQueryOptions.delete);
  const closeTab = useArcWorkCloseTab();

  const deleteDocument = useCallback(
    async (documentId: string) => {
      await deleteMutation.mutateAsync({ documentId });

      // ArcWork 연계: 동일 id의 탭이 열려 있다면 가장 먼저 닫아 줍니다.
      // - 탭을 우선 제거하여, 이후 쿼리 무효화 시 ArcData 탭에서 /content 재요청(404)이 반복되는 것을 방지합니다.
      // - ArcWork에서는 탭 id를 documentId와 동일하게 사용합니다.
      // - 탭이 없으면 closeTab은 false를 반환하므로 별도 처리가 필요하지 않습니다.
      closeTab(documentId);

      // 단일 문서 삭제는 리스트/메타 캐시에서만 제거합니다.
      queryKeyUtils.updateDocumentCache(queryClient, {
        action: 'remove',
        documentId,
      });
    },
    [closeTab, deleteMutation, queryClient],
  );

  return {
    deleteDocument,
    isDeleting: deleteMutation.isPending,
    error: deleteMutation.error,
  };
}

/**
 * 기본 문서 훅 별칭
 * - 현재는 업로드 관련 기능만 래핑합니다.
 */
export function useDocument(): UseDocumentUploadReturn {
  return useDocumentUpload();
}

/**
 * 특정 문서의 다운로드 URL을 발급하는 훅
 * - enabled=false로 초기화 후, refetch()를 통해 명시적으로 호출하는 패턴을 권장
 */
export function useDocumentDownloadUrl(
  documentId: string,
  opts?: { inline?: boolean; filename?: string; enabled?: boolean }
): UseDocumentDownloadReturn {
  const query = useQuery({
    ...documentQueryOptions.downloadUrl(documentId, {
      inline: opts?.inline,
      filename: opts?.filename,
    }),
    enabled: opts?.enabled ?? false,
  });

  const refetch = useCallback(
    async () => {
      const res = await query.refetch();
      if (res.data) return res.data;
      throw res.error ?? new Error('다운로드 URL 발급에 실패했습니다.');
    },
    [query]
  );

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}



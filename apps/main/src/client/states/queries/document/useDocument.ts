'use client';

/**
 * ArcWork 문서 업로드/다운로드 전용 React Query 훅
 * - 업로드 3단계(request/presigned/confirm)와 다운로드 URL 발급을 캡슐화
 */

import { queryKeys } from '@/share/libs/react-query/query-keys';
import {
  documentQueryOptions,
  type DocumentDTO,
  type DocumentMoveMutationVariables,
} from '@/share/libs/react-query/query-options';
import type { YoutubeDocumentCreateRequest } from '@/share/schema/zod/document-youtube-zod';
import type {
    DocumentDownloadUrlResponse,
    DocumentUploadConfirmRequest,
    DocumentUploadPresignRequest,
    DocumentUploadRequest,
    DocumentUploadRequestResponse,
} from '@/share/schema/zod/document-upload-zod';
import {
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
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

export interface UseDocumentMoveReturn {
  move: (input: { documentId: string; parentPath: string }) => Promise<DocumentDTO>;
  isMoving: boolean;
  moveError: unknown;
}

export interface UseDocumentFolderCreateReturn {
  createFolder: (input: { name: string; parentPath: string }) => Promise<DocumentDTO>;
  isCreating: boolean;
  createError: unknown;
}

export interface UseDocumentYoutubeCreateReturn {
  createYoutube: (input: YoutubeDocumentCreateRequest) => Promise<DocumentDTO>;
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
        queryKey: ['documents', 'detail', documentId],
      });
    },
    [queryClient]
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

  const moveMutation = useMutation({
    mutationFn: documentQueryOptions.move.mutationFn,
    async onMutate(variables: DocumentMoveMutationVariables) {
      const key = queryKeys.documents.listFiles();

      // 관련 쿼리의 진행 중 refetch를 취소합니다.
      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<DocumentDTO[]>(key);
      if (!previous) {
        return { previous: undefined as DocumentDTO[] | undefined };
      }

      const updated = applyDocumentMoveOptimistic(previous, variables);
      queryClient.setQueryData<DocumentDTO[]>(key, updated);

      return { previous };
    },
    onError(_error, _variables, context) {
      const key = queryKeys.documents.listFiles();
      if (context?.previous) {
        queryClient.setQueryData<DocumentDTO[]>(key, context.previous);
      }
    },
    onSettled() {
      const key = queryKeys.documents.listFiles();
      void queryClient.invalidateQueries({ queryKey: key });
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
  const createMutation = useMutation(documentQueryOptions.createFolder);

  return {
    createFolder: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
  };
}

/**
 * YouTube 링크 기반 문서 생성 훅
 * - ArcManager 파일 탭에서 YouTube URL을 문서로 추가할 때 사용합니다.
 */
export function useDocumentYoutubeCreate(): UseDocumentYoutubeCreateReturn {
  const createMutation = useMutation(documentQueryOptions.createYoutube);

  return {
    createYoutube: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
  };
}

/**
 * 현재 사용자 기준 file 문서 목록 조회 훅
 */
export function useDocumentFiles(): UseDocumentFilesReturn {
  const query = useQuery(documentQueryOptions.listFiles());

  const refetch = useCallback(
    async () => {
      const res = await query.refetch();
      if (res.data) return res.data;
      throw res.error ?? new Error('문서 목록을 불러오지 못했습니다.');
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



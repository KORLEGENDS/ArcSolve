'use client';

/**
 * ArcWork 문서 업로드/다운로드 전용 React Query 훅
 * - 업로드 3단계(request/presigned/confirm)와 다운로드 URL 발급을 캡슐화
 */

import { documentQueryOptions, type DocumentDTO } from '@/share/libs/react-query/query-options';
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



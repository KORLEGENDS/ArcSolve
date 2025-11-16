/**
 * 문서(파일 업로드) 관련 Query Options
 */

import { TIMEOUT } from '@/share/configs/constants/time-constants';
import {
  documentDownloadUrlResponseSchema,
  documentFolderCreateRequestSchema,
  documentMoveRequestSchema,
  documentUploadConfirmRequestSchema,
  documentUploadPresignRequestSchema,
  documentUploadRequestSchema,
} from '@/share/schema/zod/document-upload-zod';
import {
  type YoutubeDocumentCreateRequest,
  youtubeDocumentCreateRequestSchema,
} from '@/share/schema/zod/document-youtube-zod';
import type {
  DocumentDownloadUrlResponse,
  DocumentUploadConfirmRequest,
  DocumentUploadPresignRequest,
  DocumentUploadRequest,
  DocumentUploadRequestResponse,
} from '@/share/schema/zod/document-upload-zod';
import { queryOptions } from '@tanstack/react-query';
import { createApiMutation, createApiQueryOptions } from '../query-builder';
import { queryKeys } from '../query-keys';

export type DocumentUploadStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'upload_failed';

export type DocumentFileMetaDTO = {
  mimeType?: string | null;
  fileSize?: number | null;
  storageKey?: string | null;
} | null;

export type DocumentKind = 'note' | 'file' | 'folder';

export type DocumentDTO = {
  documentId: string;
  userId: string;
  path: string;
  /**
   * 표시용 문서 이름
   * - 서버에서 항상 non-empty 문자열로 채워주며,
   *   기존 데이터의 경우 path에서 파생된 fallback 이름이 사용될 수 있습니다.
   */
  name: string;
  kind: DocumentKind;
  uploadStatus: DocumentUploadStatus;
  fileMeta: DocumentFileMetaDTO;
  createdAt: string;
  updatedAt: string;
};

export type DocumentUploadConfirmResponse = {
  document: DocumentDTO;
};

export type DocumentListResponse = {
  documents: DocumentDTO[];
};

export interface DocumentMoveMutationVariables {
  documentId: string;
  parentPath: string;
}

export type DocumentMoveResponse = {
  document: DocumentDTO;
};

export type DocumentFolderCreateRequest = {
  name: string;
  parentPath: string;
};

export type DocumentFolderCreateResponse = {
  document: DocumentDTO;
};

export type DocumentYoutubeCreateResponse = {
  document: DocumentDTO;
};

export const documentQueryOptions = {
  uploadRequest: createApiMutation<
    DocumentUploadRequestResponse,
    DocumentUploadRequestResponse,
    DocumentUploadRequest
  >(
    () => '/api/document/upload/request',
    (data) => data,
    {
      method: 'POST',
      bodyExtractor: (variables) => documentUploadRequestSchema.parse(variables),
    }
  ),

  uploadPresign: createApiMutation<
    {
      uploadUrl: string;
      storageKey: string;
      expiresAt: string;
    },
    {
      uploadUrl: string;
      storageKey: string;
      expiresAt: string;
    },
    DocumentUploadPresignRequest
  >(
    () => '/api/document/upload/presigned',
    (data) => data,
    {
      method: 'POST',
      bodyExtractor: (variables) => documentUploadPresignRequestSchema.parse(variables),
    }
  ),

  uploadConfirm: createApiMutation<
    DocumentDTO,
    DocumentUploadConfirmResponse,
    DocumentUploadConfirmRequest
  >(
    () => '/api/document/upload/confirm',
    (data) => data.document,
    {
      method: 'POST',
      bodyExtractor: (variables) => documentUploadConfirmRequestSchema.parse(variables),
    }
  ),

  /**
   * 다운로드 URL 발급 (GET)
   * - React Query의 queryOptions를 사용해 필요 시 호출
   */
  downloadUrl: (documentId: string, opts?: { inline?: boolean; filename?: string }) =>
    queryOptions({
      queryKey: queryKeys.documents.byId(documentId),
      ...createApiQueryOptions<DocumentDownloadUrlResponse, DocumentDownloadUrlResponse>(
        (() => {
          const params = new URLSearchParams();
          if (opts?.inline) params.set('inline', '1');
          if (opts?.filename) params.set('filename', opts.filename);
          const qs = params.toString();
          return qs
            ? `/api/document/${encodeURIComponent(documentId)}/download-url?${qs}`
            : `/api/document/${encodeURIComponent(documentId)}/download-url`;
        })(),
        (data) => documentDownloadUrlResponseSchema.parse(data),
        {
          method: 'GET',
          staleTime: TIMEOUT.CACHE.SHORT,
          gcTime: TIMEOUT.CACHE.SHORT,
        }
      ),
    }),
  /**
   * 현재 사용자 기준 file 문서 목록 조회
   */
  listFiles: () =>
    queryOptions({
      queryKey: queryKeys.documents.listFiles(),
      ...createApiQueryOptions<DocumentDTO[], DocumentListResponse>(
        '/api/document?kind=file',
        (data) => data.documents,
        {
          staleTime: TIMEOUT.CACHE.SHORT,
          gcTime: TIMEOUT.CACHE.MEDIUM,
        }
      ),
    }),

  /**
   * 문서 이동 뮤테이션 옵션
   */
  move: createApiMutation<DocumentDTO, DocumentMoveResponse, DocumentMoveMutationVariables>(
    (variables) => `/api/document/${variables.documentId}/move`,
    (data) => data.document,
    {
      method: 'PATCH',
      bodyExtractor: ({ documentId: _documentId, ...body }) =>
        documentMoveRequestSchema.parse(body),
    }
  ),

  /**
   * 폴더 생성 뮤테이션 옵션
   */
  createFolder: createApiMutation<
    DocumentDTO,
    DocumentFolderCreateResponse,
    DocumentFolderCreateRequest
  >(
    () => '/api/document/folder',
    (data) => data.document,
    {
      method: 'POST',
      bodyExtractor: (variables) => documentFolderCreateRequestSchema.parse(variables),
    }
  ),

  /**
   * YouTube 링크 기반 문서 생성 뮤테이션 옵션
   */
  createYoutube: createApiMutation<
    DocumentDTO,
    DocumentYoutubeCreateResponse,
    YoutubeDocumentCreateRequest
  >(
    () => '/api/document/youtube',
    (data) => data.document,
    {
      method: 'POST',
      bodyExtractor: (variables) =>
        youtubeDocumentCreateRequestSchema.parse(variables),
    }
  ),
} as const;



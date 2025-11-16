/**
 * 문서(파일 업로드) 관련 Query Options
 */

import { TIMEOUT } from '@/share/configs/constants/time-constants';
import {
  documentDownloadUrlResponseSchema,
  documentUploadConfirmRequestSchema,
  documentUploadPresignRequestSchema,
  documentUploadRequestSchema,
} from '@/share/schema/zod/document-upload-zod';
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
  kind: DocumentKind;
  uploadStatus: DocumentUploadStatus;
  fileMeta: DocumentFileMetaDTO;
};

export type DocumentUploadConfirmResponse = {
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
} as const;



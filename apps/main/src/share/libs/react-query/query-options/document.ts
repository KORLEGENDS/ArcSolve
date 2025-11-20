/**
 * 문서(파일 업로드) 관련 Query Options
 */

import { TIMEOUT } from '@/share/configs/constants/time-constants';
import type {
  DocumentContentResponse,
  DocumentCreateRequest,
  DocumentMetaUpdateRequest,
} from '@/share/schema/zod/document-note-zod';
import {
  documentContentResponseSchema,
  documentContentUpdateRequestSchema,
  documentCreateRequestSchema,
  documentMetaUpdateRequestSchema,
} from '@/share/schema/zod/document-note-zod';
import type {
  DocumentDownloadUrlResponse,
  DocumentUploadConfirmRequest,
  DocumentUploadPresignRequest,
  DocumentUploadRequest,
  DocumentUploadRequestResponse,
} from '@/share/schema/zod/document-upload-zod';
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
import { queryOptions } from '@tanstack/react-query';
import { createApiMutation, createApiQueryOptions } from '../query-builder';
import { queryKeys } from '../query-keys';

export type DocumentUploadStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'upload_failed';

export type DocumentKind = 'folder' | 'document';

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
  /**
   * MIME 타입
   * - file 문서: 실제 파일 MIME (예: 'application/pdf', 'video/youtube')
   * - note 문서: 노트 타입 구분 (예: 'application/vnd.arc.note+plate', 'application/vnd.arc.note+draw')
   * - folder 문서: null
   */
  mimeType: string | null;
  /**
   * 파일 크기 (bytes)
   * - file 문서: 실제 파일 크기
   * - note/folder 문서: null
   */
  fileSize: number | null;
  /**
   * 스토리지 키 또는 외부 URL
   * - file 문서: R2 스토리지 키 또는 외부 URL (예: YouTube URL)
   * - note/folder 문서: null
   */
  storageKey: string | null;
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

export type DocumentContentDTO = DocumentContentResponse;

export type DocumentDetailResponse = {
  document: DocumentDTO;
};

const createDocumentListQueryOptions = (params: {
  kind: 'file' | 'note' | 'all';
  queryKey:
    | ReturnType<typeof queryKeys.documents.listFiles>
    | ReturnType<typeof queryKeys.documents.listNotes>
    | ReturnType<typeof queryKeys.documents.listAll>;
}) =>
  queryOptions({
    queryKey: params.queryKey,
    ...createApiQueryOptions<DocumentDTO[], DocumentListResponse>(
      `/api/document?kind=${params.kind}`,
      (data) => data.documents,
      {
        staleTime: TIMEOUT.CACHE.SHORT,
        gcTime: TIMEOUT.CACHE.MEDIUM,
      },
    ),
  });

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
   * 문서 생성 뮤테이션 옵션
   * - kind에 따라 note 등 다양한 문서를 생성할 수 있습니다.
   */
  create: createApiMutation<DocumentDTO, DocumentDetailResponse, DocumentCreateRequest>(
    () => '/api/document',
    (data) => data.document,
    {
      method: 'POST',
      bodyExtractor: (variables) => documentCreateRequestSchema.parse(variables),
    },
  ),

  /**
   * 단일 문서 메타 조회
   */
  detail: (documentId: string) =>
    queryOptions({
      queryKey: queryKeys.documents.byId(documentId),
      ...createApiQueryOptions<DocumentDTO, DocumentDetailResponse>(
        `/api/document/${encodeURIComponent(documentId)}`,
        (data) => data.document,
        {
          method: 'GET',
          staleTime: TIMEOUT.CACHE.SHORT,
          gcTime: TIMEOUT.CACHE.MEDIUM,
        },
      ),
    }),

  /**
   * 다운로드 URL 발급 (GET)
   * - React Query의 queryOptions를 사용해 필요 시 호출
   */
  downloadUrl: (documentId: string, opts?: { inline?: boolean; filename?: string }) =>
    queryOptions({
      queryKey: queryKeys.documents.downloadUrl(documentId),
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
    createDocumentListQueryOptions({
      kind: 'file',
      queryKey: queryKeys.documents.listFiles(),
    }),

  /**
   * 현재 사용자 기준 note 문서 목록 조회
   */
  listNotes: () =>
    createDocumentListQueryOptions({
      kind: 'note',
      queryKey: queryKeys.documents.listNotes(),
    }),

  /**
   * 현재 사용자 기준 모든 kind 문서 목록 조회
   */
  listAll: () =>
    createDocumentListQueryOptions({
      kind: 'all',
      queryKey: queryKeys.documents.listAll(),
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
   * 문서 메타 업데이트 뮤테이션 옵션
   */
  updateMeta: createApiMutation<
    DocumentDTO,
    DocumentDetailResponse,
    DocumentMetaUpdateRequest & { documentId: string }
  >(
    (variables) => `/api/document/${encodeURIComponent(variables.documentId)}`,
    (data) => data.document,
    {
      method: 'PATCH',
      bodyExtractor: ({ documentId: _documentId, ...body }) =>
        documentMetaUpdateRequestSchema.parse(body),
    },
  ),

  /**
   * 문서 콘텐츠 업데이트(새 버전 추가) 뮤테이션 옵션
   */
  updateContent: createApiMutation<
    DocumentContentDTO,
    DocumentContentResponse,
    DocumentContentDTO & { documentId: string }
  >(
    (variables) =>
      `/api/document/${encodeURIComponent(variables.documentId)}/content`,
    (data) => documentContentResponseSchema.parse(data),
    {
      method: 'POST',
      bodyExtractor: ({ documentId: _documentId, ...body }) =>
        documentContentUpdateRequestSchema.parse(body),
    },
  ),

  /**
   * 문서 콘텐츠 조회 (최신 버전)
   */
  content: (documentId: string) =>
    queryOptions({
      queryKey: queryKeys.documents.content(documentId),
      ...createApiQueryOptions<DocumentContentDTO, DocumentContentResponse>(
        `/api/document/${encodeURIComponent(documentId)}/content`,
        (data) => documentContentResponseSchema.parse(data),
        {
          method: 'GET',
          staleTime: TIMEOUT.CACHE.SHORT,
          gcTime: TIMEOUT.CACHE.SHORT,
        },
      ),
    }),

  /**
   * 문서 삭제 뮤테이션 옵션
   */
  delete: createApiMutation<void, unknown, { documentId: string }>(
    (variables) => `/api/document/${encodeURIComponent(variables.documentId)}`,
    () => undefined,
    {
      method: 'DELETE',
    },
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



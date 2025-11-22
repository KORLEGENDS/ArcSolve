import { z } from 'zod';
import { uuidSchema } from './base-zod';

// 지원하는 파일 MIME 타입 목록 (Zod 레벨에서만 관리, DB ENUM 미사용)
export const allowedDocumentFileMimeTypes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/html',
  'application/epub+zip',
] as const;

export const documentNameSchema = z.string().min(1).max(255);

export const documentParentPathSchema = z
  .string()
  .max(512)
  .refine(
    (value) =>
      value === '' ||
      /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/.test(value),
    '유효하지 않은 경로 형식입니다.'
  );

export const documentUploadRequestSchema = z.object({
  name: documentNameSchema,
  // UI에서는 이미 ltree 스타일 경로를 사용합니다.
  // 예: "project", "project.sub", "project.sub.arcyou"
  // 빈 문자열("")은 루트 경로를 의미합니다.
  parentPath: documentParentPathSchema,
  fileSize: z.number().int().positive(),
  mimeType: z.enum(allowedDocumentFileMimeTypes),
});

export type DocumentUploadRequest = z.infer<typeof documentUploadRequestSchema>;

export const documentUploadRequestResponseSchema = z.object({
  processId: uuidSchema,
  documentId: uuidSchema,
  expiresAt: z.string().datetime(),
});

export type DocumentUploadRequestResponse = z.infer<
  typeof documentUploadRequestResponseSchema
>;

export const documentUploadPresignRequestSchema = z.object({
  processId: uuidSchema,
});

export type DocumentUploadPresignRequest = z.infer<
  typeof documentUploadPresignRequestSchema
>;

export const documentUploadPresignResponseSchema = z.object({
  uploadUrl: z.string().url(),
  storageKey: z.string(),
  expiresAt: z.string().datetime(),
});

export type DocumentUploadPresignResponse = z.infer<
  typeof documentUploadPresignResponseSchema
>;

export const documentUploadConfirmRequestSchema = z.object({
  processId: uuidSchema,
});

export type DocumentUploadConfirmRequest = z.infer<
  typeof documentUploadConfirmRequestSchema
>;

export const documentDownloadUrlResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime(),
});

export type DocumentDownloadUrlResponse = z.infer<
  typeof documentDownloadUrlResponseSchema
>;

/**
 * 문서 이동 요청 스키마
 * - parentPath는 업로드 요청과 동일한 규칙을 따릅니다.
 * - '' = 루트 경로
 */
export const documentMoveRequestSchema = z.object({
  parentPath: documentParentPathSchema,
});

export type DocumentMoveRequest = z.infer<typeof documentMoveRequestSchema>;

/**
 * 폴더 생성 요청 스키마
 * - name: 폴더 이름
 * - parentPath: 상위 경로 ('' = 루트)
 * - folderDomain:
 *   - 'document' : 노트/파일 트리용 폴더 (기본값)
 *   - 'ai'       : AI 트리용 폴더
 */
export const documentFolderCreateRequestSchema = z.object({
  name: documentNameSchema,
  parentPath: documentParentPathSchema,
  folderDomain: z.enum(['document', 'ai']).default('document'),
});

export type DocumentFolderCreateRequest = z.infer<
  typeof documentFolderCreateRequestSchema
>;


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

export const documentUploadRequestSchema = z.object({
  name: z.string().min(1).max(255),
  // UI에서는 이미 ltree 스타일 경로를 사용합니다.
  // 예: "project", "project.sub", "project.sub.arcyou"
  // 빈 문자열("")은 루트 경로를 의미합니다.
  parentPath: z
    .string()
    .max(512)
    .refine(
      (value) =>
        value === '' ||
        /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/.test(value),
      '유효하지 않은 경로 형식입니다.'
    ),
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



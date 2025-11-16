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
  parentPath: z.string().min(1).max(512),
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



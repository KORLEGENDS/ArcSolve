/**
 * R2 업로드/다운로드 공통 유틸리티
 *
 * - 고수준 업로드 플로우(request/presign/confirm)는 각 도메인(document 등)에서
 *   별도 서비스로 구현하고, 여기서는 서명 URL/스토리지 키 생성만 담당합니다.
 */
 
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BUCKET, r2Client } from './client-r2';

/**
 * 다운로드 URL 생성 (프라이빗 파일용)
 * - Content-Disposition: attachment로 강제 다운로드
 * - ResponseContentType: 브라우저 MIME 스니핑 방지
 */
export async function getDownloadUrl(
  storageKey: string,
  expiresIn = 300,
  options?: {
    filename?: string;
    mimeType?: string;
    inline?: boolean;
  }
): Promise<string> {
  // 파일명 sanitization (XSS 방지)
  const sanitizedFilename = options?.filename
    ? options.filename
        .replace(/[^\w\s\-._()[\]가-힣]/g, '_') // 안전한 문자만 허용
        .substring(0, 255) // 최대 길이 제한
    : 'download';

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
    // Content-Disposition: inline(브라우저 표시) vs attachment(강제 다운로드)
    ResponseContentDisposition: options?.inline
      ? `inline; filename="${sanitizedFilename}"`
      : `attachment; filename="${sanitizedFilename}"`,
    // ResponseContentType: MIME 타입 강제 (브라우저 스니핑 방지)
    ResponseContentType: options?.mimeType || 'application/octet-stream',
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

// 삭제 API 미사용으로 제거됨: deleteObject(storageKey)

/**
 * 파일 스토리지 키 생성 - 단순하고 명확한 구조
 * 경로 형태: users/{userId}/files/{id}
 */
export function generateFileStorageKey(userId: string, id: string): string {
  // 경로 검증
  if (!userId || !id) {
    throw new Error('userId와 id는 필수입니다');
  }

  // UUID 형식 검증
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new Error('id는 유효한 UUID 형식이어야 합니다');
  }

  return `users/${userId}/files/${id}`;
}

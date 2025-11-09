/**
 * MIME 타입이 이미지인지 확인합니다.
 * @param mimeType - 확인할 MIME 타입
 * @returns 이미지 타입이면 true, 아니면 false
 */
export function isImageMimeType(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return mimeType.toLowerCase().startsWith('image/');
}


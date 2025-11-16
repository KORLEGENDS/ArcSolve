import { z } from 'zod';
import { documentParentPathSchema } from './document-upload-zod';

/**
 * YouTube 문서 생성 요청 스키마
 * - 클라이언트는 URL과 parentPath만 전달합니다.
 * - 문서 이름(name)은 서버에서 oEmbed(YouTube title) + fallback 정책으로만 결정합니다.
 */
export const youtubeDocumentCreateRequestSchema = z.object({
  url: z.string().url(),
  /**
   * ArcManager 파일 탭에서 사용하는 ltree 스타일 경로
   * - '' = 루트
   */
  parentPath: documentParentPathSchema.default(''),
});

export type YoutubeDocumentCreateRequest = z.infer<
  typeof youtubeDocumentCreateRequestSchema
>;


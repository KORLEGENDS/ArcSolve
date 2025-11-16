import { z } from 'zod';
import { documentParentPathSchema } from './document-upload-zod';

export const youtubeDocumentCreateRequestSchema = z.object({
  url: z.string().url(),
  /**
   * ArcManager 파일 탭에서 사용하는 ltree 스타일 경로
   * - '' = 루트
   */
  parentPath: documentParentPathSchema.default(''),
  /**
   * 문서 이름 (선택)
   * - 제공되지 않은 경우 서버에서 YouTube oEmbed를 통해 title을 조회합니다.
   */
  name: z.string().min(1).max(255).optional(),
});

export type YoutubeDocumentCreateRequest = z.infer<
  typeof youtubeDocumentCreateRequestSchema
>;



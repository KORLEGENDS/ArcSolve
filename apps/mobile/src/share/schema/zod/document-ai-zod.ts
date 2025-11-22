import { z } from 'zod';

/**
 * 문서 이름 스키마
 */
export const documentNameSchema = z.string().min(1).max(255);

/**
 * 문서 부모 경로 스키마 (ltree 스타일)
 */
export const documentParentPathSchema = z.string().default('');

/**
 * ArcAI 세션 문서 생성 요청 스키마
 *
 * - name      : 표시용 세션 이름
 * - parentPath: ArcManager/ArcWork에서 사용하는 ltree 스타일 경로 ('' = 루트)
 */
export const documentAiSessionCreateRequestSchema = z.object({
  name: documentNameSchema,
  parentPath: documentParentPathSchema,
});

export type DocumentAiSessionCreateRequest = z.infer<
  typeof documentAiSessionCreateRequestSchema
>;


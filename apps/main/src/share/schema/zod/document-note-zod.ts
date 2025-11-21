import { z } from 'zod';
import { uuidSchema } from './base-zod';
import { documentNameSchema, documentParentPathSchema } from './document-upload-zod';
import { generateUUID } from './zod-utils/uuid-zod-utils';

/**
 * Plate(Slate) 콘텐츠 스키마 및 기본값
 * - 다른 프로젝트에서 사용하던 기본 구조를 참고하여, 노트 콘텐츠의 기본 형태를 정의합니다.
 */

// 텍스트 노드
const slateTextSchema = z
  .object({
    text: z.string(),
  })
  .catchall(z.unknown());

// Element 노드 (children: Descendant[])
const slateElementSchema: z.ZodType<any> = z.lazy(() =>
  z
    .object({
      type: z.string().min(1),
      id: z.string().min(1).optional(),
      children: z.array(z.union([slateTextSchema, slateElementSchema])).min(0),
    })
    .catchall(z.unknown())
    .transform((node) => ({ ...node, id: node.id ?? generateUUID() })),
);

const slateDescendantSchema = z.union([slateTextSchema, slateElementSchema]);

// 공통 기본 문단
export const DEFAULT_NOTE_PARAGRAPH = [{ type: 'p', children: [{ text: '' }] }];

/**
 * Draw(Excalidraw) 씬 스키마 (보수적 검증)
 */
const excalidrawFileDataSchema = z
  .object({
    id: z.string(),
    mimeType: z.string(),
    dataURL: z.string(),
    created: z.number().optional(),
    lastRetrieved: z.number().optional(),
  })
  .catchall(z.unknown());

const drawSceneSchema = z
  .object({
    type: z.literal('draw'),
    source: z.string().url().optional(),
    elements: z.array(z.unknown()),
    appState: z.record(z.string(), z.unknown()),
    files: z.record(z.string(), excalidrawFileDataSchema).default({}),
  })
  .catchall(z.unknown());

// Slate 콘텐츠
const slateContentSchema = z.array(slateDescendantSchema);

/**
 * 노트 콘텐츠 스키마
 * - Slate(Slate/Plate) 배열 또는 Draw 씬
 * - 기본값은 빈 문단 1개
 */
export const noteContentSchema = z
  .union([slateContentSchema, drawSceneSchema])
  .default(DEFAULT_NOTE_PARAGRAPH as any);

// 타입 별칭 (클라이언트/서버 공통)
export type EditorText = z.infer<typeof slateTextSchema>;
export type EditorElement = z.infer<typeof slateElementSchema>;
export type EditorNode = z.infer<typeof slateDescendantSchema>;
export type EditorContent = z.infer<typeof noteContentSchema>;

/**
 * 문서 콘텐츠 업데이트(새 버전 추가) 요청 스키마
 * - kind에 관계없이 documentId 기준으로 새로운 contents 버전을 추가할 때 사용합니다.
 */
export const documentContentUpdateRequestSchema = z.object({
  contents: z.unknown(),
});

export type DocumentContentUpdateRequest = z.infer<
  typeof documentContentUpdateRequestSchema
>;

/**
 * 노트 메타데이터(name 등) 업데이트 요청 스키마
 */
export const documentMetaUpdateRequestSchema = z.object({
  name: documentNameSchema.optional(),
});

export type DocumentMetaUpdateRequest = z.infer<typeof documentMetaUpdateRequestSchema>;

/**
 * 문서 콘텐츠 응답 스키마
 * - contents: 문서 표현(JSON)
 * - version: 숫자 버전 (없으면 null)
 */
export const documentContentResponseSchema = z.object({
  documentId: uuidSchema,
  contentId: uuidSchema.nullable(),
  contents: z.unknown().nullable(),
  version: z.number().int().positive().nullable(),
  createdAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export type DocumentContentResponse = z.infer<typeof documentContentResponseSchema>;

/**
 * Document 생성 요청 스키마
 * - kind 필드는 API 레벨 디스크리미네이터입니다.
 * - DB의 documents.kind('folder' | 'document')와는 별개의 개념이며, 실제 문서 타입은 mimeType으로 구분합니다.
 *
 * 현재 지원:
 * - 'note' : 노트 문서 (contents 포함)
 * - 'ai'   : AI 세션 문서 (contents 없음, ArcAI 전용)
 */
const documentNoteCreateRequestSchema = z.object({
  kind: z.literal('note'),
  name: documentNameSchema,
  parentPath: documentParentPathSchema,
  contents: noteContentSchema.optional(),
});

const documentAiCreateRequestSchema = z.object({
  kind: z.literal('ai'),
  name: documentNameSchema,
  parentPath: documentParentPathSchema,
});

export const documentCreateRequestSchema = z.discriminatedUnion('kind', [
  documentNoteCreateRequestSchema,
  documentAiCreateRequestSchema,
]);

export type DocumentCreateRequest = z.infer<typeof documentCreateRequestSchema>;



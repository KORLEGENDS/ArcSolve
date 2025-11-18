## 1. 개요

`document` 도메인은 ArcSolve에서 **파일/노트/폴더를 통합적으로 관리하는 루트 엔티티**입니다.  
이 문서는 `document` 관련 **DB 스키마 → Repository → 서버 API → React Query 옵션 → 클라이언트 훅 → UI(ArcManager/ArcData)**까지의 흐름을 한 번에 정리합니다.

핵심 키워드:

- 문서 종류: `kind = 'file' | 'note' | 'folder'`
- 경로: `path (ltree)` – 사용자 네임스페이스 내 트리 구조
- 콘텐츠: `document_content` – 버전 단위 JSON
- 파일 메타/다운로드: `fileMeta + /api/document/[id]/download-url`
- 노트 콘텐츠: Plate JSON (`noteContentSchema`)

---

## 2. DB 스키마

### 2.1 `document` 테이블

문서의 정체성과 계층 구조, 최신 콘텐츠 포인터를 관리합니다.

```43:85:apps/main/src/share/schema/drizzles/document-drizzle.ts
export const documents = pgTable(
  'document',
  {
    documentId: uuid('document_id').primaryKey().notNull().defaultRandom(),
    userId: uuid('user_id').notNull(),
    name: text('name'),
    path: ltree('path').notNull(),
    kind: documentKindEnum('kind').notNull(),              // 'note' | 'file' | 'folder'
    fileMeta: jsonb('file_meta'),                          // 파일 문서 전용 메타
    uploadStatus: documentUploadStatusEnum('upload_status')
      .default('uploaded')
      .notNull(),                                          // pending/uploading/uploaded/failed
    latestContentId: uuid('latest_content_id'),            // 최신 document_content FK
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    userPathUnique: uniqueIndex('document_user_id_path_deleted_null_idx')
      .on(table.userId, table.path)
      .where(sql`deleted_at IS NULL`),
    pathGistIdx: index('document_path_gist_idx').using('gist', table.path),
  })
);
```

### 2.2 `document_content` 테이블

문서의 실제 내용을 버전 단위로 관리합니다.

```97:124:apps/main/src/share/schema/drizzles/document-drizzle.ts
export const documentContents = pgTable(
  'document_content',
  {
    documentContentId: uuid('document_content_id').primaryKey().notNull().defaultRandom(),
    documentId: uuid('document_id').notNull().references(() => documents.documentId, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),                 // 이 버전을 생성한 작성자
    contents: jsonb('contents'),                       // 임의 JSON (텍스트, 파싱 결과 등)
    version: integer('version').notNull(),             // 1,2,3...
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    documentVersionUnique: uniqueIndex(
      'document_content_document_id_version_deleted_null_idx',
    )
      .on(table.documentId, table.version)
      .where(sql`deleted_at IS NULL`),
  })
);
```

### 2.3 RAG/관계 스키마 (요약)

- `document_relation` – 문서 간 관계 그래프 (reference/summary/translation/duplicate)
- `document_chunk` – RAG 검색용 chunk + embedding (pgvector)

이 문서는 주로 **CRUD/API/클라이언트 흐름**에 초점을 맞추므로, RAG/관계는 상세 설명을 생략합니다.

---

## 3. Repository 레이어 (`DocumentRepository`)

위 스키마를 감싸는 Repository는 다음 역할을 담당합니다.

```113:112:apps/main/src/share/schema/repositories/document-repository.ts
export class DocumentRepository {
  constructor(private readonly database: DB = defaultDb) {}

  // 폴더 보장/생성
  private async ensureFolderForOwner(database: DB, userId: string, rawPath: string): Promise<Document | null> { … }
  async createFolderForOwner(input: { userId: string; parentPath: string; name: string }): Promise<Document> { … }

  // 파일 업로드용 pending 문서 생성
  async createPendingFileForUpload(input: CreatePendingFileInput): Promise<Document> { … }

  // 외부 URL(Youtube 등) 기반 파일 문서 생성
  async createExternalFile(input: CreateExternalFileInput): Promise<Document> { … }

  // 노트 문서 + 초기 콘텐츠 버전 생성
  async createNoteForOwner(input: CreateNoteInput): Promise<{ document: Document; content: DocumentContent }> { … }

  // 단일 문서 조회
  async findByIdForOwner(documentId: string, userId: string): Promise<Document | null> { … }

  // 문서 + 최신 콘텐츠 조회
  async findWithLatestContentForOwner(
    documentId: string,
    userId: string,
  ): Promise<{ document: Document; content: DocumentContent | null } | null> { … }

  // 사용자별 문서 목록 (kind 필터)
  async listByOwner(userId: string, options?: { kind?: Document['kind'] }): Promise<Document[]> { … }

  // 메타 업데이트(name 등)
  async updateDocumentMetaForOwner(params: { documentId: string; userId: string; name?: string }): Promise<Document> { … }

  // 콘텐츠 버전 추가 + latestContentId 갱신
  async appendContentVersionForOwner(params: {
    documentId: string;
    userId: string;
    contents: unknown;
  }): Promise<{ document: Document; content: DocumentContent }> { … }

  // 문서 이동 (ltree path 기반 subtree 이동)
  async moveDocumentForOwner(params: {
    documentId: string;
    userId: string;
    targetParentPath: string;
  }): Promise<Document> { … }

  // 문서 삭제 (soft delete)
  async deleteDocumentForOwner(params: { documentId: string; userId: string }): Promise<void> { … }
}
```

핵심 포인트:

- **경로 정책**: `toLtreeLabel` / `normalizeLtreePath`로 ltree에 안전한 path를 생성
- **폴더 보장**: 파일/노트 생성 시 부모 경로에 폴더 문서가 없으면 자동 생성
- **노트/파일/폴더 공통 처리**: `kind`에 따라 분기하지만, 기본 CRUD는 하나의 Repository에서 처리

---

## 4. Zod 스키마 & API 모델

### 4.1 업로드/다운로드 (`document-upload-zod.ts`)

```4:36:apps/main/src/share/schema/zod/document-upload-zod.ts
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
  name: documentNameSchema,
  parentPath: documentParentPathSchema,
  fileSize: z.number().int().positive(),
  mimeType: z.enum(allowedDocumentFileMimeTypes),
});
```

- **업로드 3단계**
  - `/api/document/upload/request` – 업로드 프로세스 생성 (documentId, processId 발급)
  - `/api/document/upload/presigned` – R2 업로드용 presigned URL 발급
  - `/api/document/upload/confirm` – 업로드 완료 후 `uploadStatus` → `uploaded`로 변경

- **다운로드**

```76:82:apps/main/src/share/schema/zod/document-upload-zod.ts
export const documentDownloadUrlResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime(),
});
```

### 4.2 노트 전용 콘텐츠 & 생성 (`document-note-zod.ts`)

```61:68:apps/main/src/share/schema/zod/document-note-zod.ts
export const noteContentSchema = z
  .union([slateContentSchema, drawSceneSchema])
  .default(DEFAULT_NOTE_PARAGRAPH as any);

export type EditorContent = z.infer<typeof noteContentSchema>;
```

```118:127:apps/main/src/share/schema/zod/document-note-zod.ts
const documentNoteCreateRequestSchema = z.object({
  kind: z.literal('note'),
  name: documentNameSchema,
  parentPath: documentParentPathSchema,
  contents: noteContentSchema.optional(),
});

export const documentCreateRequestSchema = z.discriminatedUnion('kind', [
  documentNoteCreateRequestSchema,
]);
```

현재 `POST /api/document`는 `kind = 'note'`만 지원하며, 향후 `folder`/`external` 등으로 확장 가능하도록 설계되어 있습니다.

---

## 5. 서버 API 라우트

### 5.1 문서 목록/생성 (`GET/POST /api/document`)

```17:69:apps/main/src/app/(backend)/api/document/route.ts
export async function GET(request: NextRequest) {
  // 인증 → userId
  // kind 쿼리 파라미터: null/file/note/all
  const allDocuments = await repository.listByOwner(userId);

  const documents = allDocuments.filter((doc) => {
    if (kindParam === null || kindParam === 'file') {
      return doc.kind === 'file' || doc.kind === 'folder';
    }
    if (kindParam === 'note') {
      return doc.kind === 'note' || doc.kind === 'folder';
    }
    return true; // 'all'
  });

  return ok({ documents: documents.map(doc => ({ … })) }, { … });
}
```

```115:176:apps/main/src/app/(backend)/api/document/route.ts
export async function POST(request: NextRequest) {
  // 인증 → userId
  const raw = await request.json().catch(() => undefined);
  const parsed = documentCreateRequestSchema.safeParse(raw);
  …
  switch (input.kind) {
    case 'note': {
      const result = await repository.createNoteForOwner({
        userId,
        parentPath: input.parentPath,
        name: input.name,
        initialContents: input.contents,
      });
      created = result.document;
      break;
    }
    default:
      throwApi('BAD_REQUEST', '지원하지 않는 문서 종류입니다.', { kind: input.kind });
  }

  return ok({ document: { … } }, { … });
}
```

### 5.2 단일 문서 메타/삭제 (`/api/document/[documentId]`)

- `GET /api/document/[id]` → `DocumentDetailResponse`
- `PATCH /api/document/[id]` → `updateDocumentMetaForOwner`
- `DELETE /api/document/[id]` → `deleteDocumentForOwner`

> 구체 구현은 생략하지만, React Query `documentQueryOptions.detail`/`updateMeta`/`delete`가 이 라우트와 1:1로 매핑됩니다.

### 5.3 문서 콘텐츠 버전 (`/api/document/[documentId]/content`)

- `GET` – 최신 버전 조회
- `POST` – 새 버전 추가 (`appendContentVersionForOwner`)

### 5.4 문서 이동 (`PATCH /api/document/[documentId]/move`)

- `DocumentRepository.moveDocumentForOwner`와 동일한 규칙으로, ltree path 기반 subtree 이동 수행.

### 5.5 다운로드 URL 발급 (`GET /api/document/[documentId]/download-url`)

```17:81:apps/main/src/app/(backend)/api/document/[documentId]/download-url/route.ts
export async function GET(request: NextRequest, context: RouteContext) {
  // 인증 → userId
  const { documentId } = await context.params;
  const idResult = uuidSchema.safeParse(documentId);
  …
  const document = await repository.findByIdForOwner(idResult.data, userId);
  if (!document) … NOT_FOUND
  if (document.kind !== 'file') … BAD_REQUEST
  if (document.uploadStatus !== 'uploaded') … BAD_REQUEST

  const fileMeta = document.fileMeta as DocumentFileMeta | null;
  const storageKey = fileMeta?.storageKey;
  …
  const { url, expiresAt } = await getCachedDownloadUrl(storageKey, {
    filename,
    mimeType: fileMeta?.mimeType ?? undefined,
    inline,
  });
  return ok({ url, expiresAt }, …);
}
```

PDF/미디어 뷰어(ArcDataPDFHost/ArcDataPlayerHost)는 이 엔드포인트로부터 R2 서명 URL을 받아 파일을 로드합니다.

---

## 6. React Query 옵션 (`documentQueryOptions`)

```107:209:apps/main/src/share/libs/react-query/query-options/document.ts
export const documentQueryOptions = {
  // 업로드 3단계
  uploadRequest: …('/api/document/upload/request'),
  uploadPresign: …('/api/document/upload/presigned'),
  uploadConfirm: …('/api/document/upload/confirm'),

  // 문서 생성 (현재 note만)
  create: createApiMutation<DocumentDTO, DocumentDetailResponse, DocumentCreateRequest>(
    () => '/api/document',
    (data) => data.document,
    { method: 'POST', bodyExtractor: … },
  ),

  // 단일 문서 메타 조회
  detail: (documentId) => queryOptions({
    queryKey: queryKeys.documents.byId(documentId),
    …('/api/document/{documentId}', (data) => data.document),
  }),

  // 다운로드 URL 조회 (ArcDataPDF/Player 등)
  downloadUrl: (documentId, opts) => queryOptions({
    queryKey: queryKeys.documents.downloadUrl(documentId),
    …('/api/document/{documentId}/download-url?…', (data) => documentDownloadUrlResponseSchema.parse(data)),
  }),

  // 목록: file/note/all
  listFiles: () => queryOptions({ queryKey: queryKeys.documents.listFiles(), …('/api/document?kind=file', …) }),
  listNotes: () => queryOptions({ queryKey: queryKeys.documents.listNotes(), …('/api/document?kind=note', …) }),
  listAll: () => queryOptions({ queryKey: queryKeys.documents.listAll(), …('/api/document?kind=all', …) }),

  // 이동/메타/콘텐츠/삭제
  move: createApiMutation(…'/api/document/{id}/move'…),
  updateMeta: createApiMutation(…PATCH '/api/document/{id}'…),
  updateContent: createApiMutation(…POST '/api/document/{id}/content'…),
  delete: createApiMutation(…DELETE '/api/document/{id}'…),

  // YouTube 문서 생성
  createYoutube: createApiMutation(…'/api/document/youtube'…),
} as const;
```

> 모든 옵션은 `query-keys.ts`의 `queryKeys.documents.*`와 1:1로 매핑되어,  
> ArcManager/ArcData/기타 UI에서 동일한 API를 일관되게 사용할 수 있습니다.

---

## 7. 클라이언트 훅 (`useDocument.ts`)

`documentQueryOptions` 위에 얇은 React 훅 레이어를 제공합니다.

### 7.1 업로드/다운로드

```134:165:apps/main/src/client/states/queries/document/useDocument.ts
export function useDocumentUpload(): UseDocumentUploadReturn { … }

export function useDocumentDownloadUrl(
  documentId: string,
  opts?: { inline?: boolean; filename?: string; enabled?: boolean }
): UseDocumentDownloadReturn {
  const query = useQuery({
    ...documentQueryOptions.downloadUrl(documentId, { inline: opts?.inline, filename: opts?.filename }),
    enabled: opts?.enabled ?? false,
  });
  …
}
```

### 7.2 목록/상세/콘텐츠

- `useDocumentFiles()` – 파일/폴더 목록 (ArcManager files 탭)
- `useDocumentNotes()` – 노트/폴더 목록 (ArcManager notes 탭)
- `useDocumentDetail(documentId)` – 단일 문서 메타
- `useDocumentContent(documentId)` – 최신 콘텐츠(JSON)

### 7.3 통합 액션 훅

- `useDocumentMove()` – 문서 이동 (ArcManager DnD와 옵티미스틱 업데이트 포함)
- `useDocumentUpdate()` – 메타/콘텐츠 통합 업데이트
- `useDocumentDelete()` – 문서 삭제
- `useDocumentFolderCreate()` – 폴더 생성
- `useDocumentYoutubeCreate()` – YouTube 문서 생성
- `useDocumentCreate()` – 노트 문서 생성 (kind='note')

---

## 8. UI 연동

### 8.1 ArcManager (파일/노트 트리)

- 파일 탭:
  - `useDocumentFiles()` → `DocumentDTO[]` → `ArcManagerTreeItem[]`로 변환 후 트리 렌더
  - DnD → `useDocumentMove()`로 path 기반 subtree 이동
  - 폴더 생성/업로드/YouTube 생성 → 각 훅 호출 후 목록 refetch

- 노트 탭:
  - `useDocumentNotes()` → note + folder 트리
  - 노트 생성 버튼 → `useDocumentCreate()` (kind='note', `DEFAULT_NOTE_PARAGRAPH` 기본값)
  - DnD → ArcWork 탭에 `arcdata-document` 탭으로 노트 열기

### 8.2 ArcData (문서 뷰어)

- `ArcData` 엔트리 컴포넌트:
  - `useDocumentDetail(documentId)`로 문서를 조회하고,
  - `kind === 'file'` → PDF/Player 호스트
  - `kind === 'note'` → 노트 호스트(`ArcDataNoteHost`)

- `ArcDataPDFHost`:
  - `useDocumentDownloadUrl(documentId, { inline: true, enabled: true })`로 R2 서명 URL 발급
  - `pdfManager.loadDocument(pdfUrl)`로 PDF 로드 및 페이지/줌 관리

- `ArcDataNoteHost`:
  - 현재는 데모용 Plate 에디터 래퍼이며,
  - 추후 `useDocumentContent(documentId)` + `noteContentSchema`로 실제 노트 JSON과 연동 예정.

---

## 9. 요약

- `document` 도메인은 **파일/노트/폴더를 하나의 모델로 통합**하며,
  - DB 레벨에서는 `documents` + `document_content` + (optional) `document_relation`/`document_chunk`,
  - 서버 레벨에서는 `/api/document`와 하위 라우트들(`/[id]`, `/[id]/content`, `/[id]/move`, `/[id]/download-url`)로 노출되고,
  - 클라이언트 레벨에서는 `documentQueryOptions` + `useDocument*` 훅을 통해 캡슐화됩니다.
- ArcManager/ArcData/ArcWork는 이 공통 API를 기반으로
  - 문서 트리 탐색/이동(DnD)
  - 파일 업로드/다운로드
  - 노트 생성/편집
  - PDF/Player/Note 뷰어 렌더링을 구현하고 있습니다.

이 문서를 **document 도메인 변경/확장 시의 기준 문서**로 유지하면서,  
새로운 kind(예: 이미지 전용, 외부 링크 등)를 추가할 때는 Repository → API → Query Options → Hooks → UI까지 일관되게 확장하는 것을 권장합니다.



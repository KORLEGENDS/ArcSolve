## 1. 개요

`document` 도메인은 ArcSolve에서 **파일/노트/폴더를 통합적으로 관리하는 루트 엔티티**입니다.  
이 문서는 `document` 관련 **DB 스키마 → Repository → 서버 API → React Query 옵션 → 클라이언트 훅 → UI(ArcManager/ArcData)**까지의 흐름을 한 번에 정리합니다.

핵심 키워드:

- 문서 구조 종류: `kind = 'folder' | 'document'` (폴더/리프 구조만 표현)
- 콘텐츠 타입: `mimeType` – note/draw/pdf/youtube 등 실제 비즈니스 타입은 전부 mimeType으로 구분
- 경로: `path (ltree)` – 사용자 네임스페이스 내 트리 구조 (ASCII slug, transliteration 기반)
- 콘텐츠: `document_content` – 버전 단위 JSON
- 파일 메타/다운로드: `mimeType/fileSize/storageKey + /api/document/[id]/download-url`
- 노트 콘텐츠: Plate/Draw JSON (`noteContentSchema` – `application/vnd.arc.note+plate` / `application/vnd.arc.note+draw`)

**"kind" 개념 레벨 구분:**

- **DB 스키마 레벨**: `documents.kind = 'folder' | 'document'`
  - 폴더 vs 리프(파일/노트 등) 구조만 담당
  - 실제 타입(노트/드로우/PDF/YouTube)은 `mimeType`으로 구분
- **API 뷰 필터 레벨**: `GET /api/document?kind=document|ai`
  - ArcManager의 "문서 탭 / AI 탭"을 위한 UX 필터
  - `kind=document`: 노트/파일 + document 도메인 폴더
  - `kind=ai`: AI 세션 + AI 도메인 폴더

---

## 2. DB 스키마

### 2.1 `document` 테이블

문서의 정체성과 계층 구조, 최신 콘텐츠 포인터를 관리합니다.

```55:124:apps/main/src/share/schema/drizzles/document-drizzle.ts
export const documents = pgTable(
  'document',
  {
    documentId: uuid('document_id')
      .primaryKey()
      .notNull()
      .defaultRandom(),

    // owner (tenant 기준)
    userId: uuid('user_id').notNull(),

    /**
     * 표시용 문서 이름
     * - path는 ltree용 slug 경로이므로, 실제 UI에서는 항상 name을 사용합니다.
     * - name은 UTF-8 전체 범위를 허용하며, 한글/이모지 등도 그대로 저장합니다.
     */
    name: text('name'),

    // hierarchical path within the user's namespace
    path: ltree('path').notNull(),

    kind: documentKindEnum('kind').notNull(),

    /**
     * MIME 타입
     * - file 문서: 실제 파일 MIME (예: 'application/pdf', 'video/youtube')
     * - note 문서: 노트 타입 구분 (예: 'application/vnd.arc.note+plate', 'application/vnd.arc.note+draw')
     * - folder 문서:
     *   - 기존 데이터: null (도메인 정보 없음, 기본적으로 document 도메인으로 취급)
     *   - 신규 데이터:
     *     - 노트/파일 트리용 폴더: 'application/vnd.arc.folder+document'
     *     - AI 트리용 폴더: 'application/vnd.arc.folder+ai'
     */
    mimeType: text('mime_type'),

    /**
     * 파일 크기 (bytes)
     * - file 문서: 실제 파일 크기
     * - note/folder 문서: null
     */
    fileSize: bigint('file_size', { mode: 'number' }),

    /**
     * 스토리지 키 또는 외부 URL
     * - file 문서: R2 스토리지 키 또는 외부 URL (예: YouTube URL)
     * - note/folder 문서: null
     */
    storageKey: text('storage_key'),

    // 업로드 상태 (note/folder 등 비파일 문서는 기본적으로 'uploaded' 상태로 간주)
    uploadStatus: documentUploadStatusEnum('upload_status')
      .default('uploaded')
      .notNull(),

    /**
     * 전처리(파싱/임베딩 등) 상태
     * - 파일 업로드 이후, 백엔드 전처리 파이프라인의 진행 상태를 나타냅니다.
     * - note/folder 등 비파일 문서는 생성 시점에 'processed' 로 간주할 수 있습니다.
     */
    processingStatus: documentProcessingStatusEnum('processing_status')
      .default('pending')
      .notNull(),

    // points to the latest content version (nullable for empty documents)
    latestContentId: uuid('latest_content_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    // per-user unique path for non-deleted documents
    userPathUnique: uniqueIndex('document_user_id_path_deleted_null_idx')
      .on(table.userId, table.path)
      .where(sql`deleted_at IS NULL`),

    // subtree queries on path (ltree)
    pathGistIdx: index('document_path_gist_idx').using('gist', table.path),
  })
);
```

#### 업로드 상태 vs 전처리 상태

- `uploadStatus`: 파일이 스토리지에 올라갔는지 여부 (`pending/uploading/uploaded/upload_failed`)
- `processingStatus`: 전처리(파싱/임베딩) 상태 (`pending/processing/processed/failed`)
- note/folder/외부 리소스는 생성 시점에 바로 `processed` 로 간주하는 정책.

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

  // 문서 삭제 (hard delete + FK cascade)
  async deleteDocumentForOwner(params: { documentId: string; userId: string }): Promise<void> { … }

  // 서버 공통 DTO 매퍼
  mapDocumentToDTO(doc: Document): DocumentDTO { … }
}
```

### 3.1 서버/클라 공통 DocumentDTO

서버와 클라이언트가 공유하는 문서 메타 데이터 구조입니다.

`DocumentRepository` 설명에 한 줄 추가:

`updateProcessingStatusForOwner` 를 통해 전처리 상태를 업데이트하며, 파일 업로드 완료 후 Outbox 잡 생성과 함께 `pending` 으로 진입한다.

```ts
export type DocumentDTO = {
  documentId: string;
  userId: string;
  path: string;
  /**
   * 표시용 문서 이름
   * - 서버에서 항상 non-empty 문자열로 채워주며,
   *   기존 데이터의 경우 path에서 파생된 fallback 이름이 사용될 수 있습니다.
   */
  name: string;
  kind: 'folder' | 'document';
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'upload_failed';
  processingStatus: 'pending' | 'processing' | 'processed' | 'failed';
  /**
   * MIME 타입
   * - file 문서: 실제 파일 MIME (예: 'application/pdf', 'video/youtube')
   * - note 문서: 노트 타입 구분 (예: 'application/vnd.arc.note+plate', 'application/vnd.arc.note+draw')
   * - folder 문서: null
   */
  mimeType: string | null;
  /**
   * 파일 크기 (bytes)
   * - file 문서: 실제 파일 크기
   * - note/folder 문서: null
   */
  fileSize: number | null;
  /**
   * 스토리지 키 또는 외부 URL
   * - file 문서: R2 스토리지 키 또는 외부 URL (예: YouTube URL)
   * - note/folder 문서: null
   */
  storageKey: string | null;
  createdAt: string;
  updatedAt: string;
};
```

**특징:**
- 서버 `mapDocumentToDTO()`가 **모든 `/api/document*` 응답을 이 구조로 정규화**
- 클라이언트 `documentQueryOptions`가 이 DTO를 기반으로 타입 안전성 보장
- `Date` 객체는 ISO 문자열로 변환하여 전송
- 폴더 문서는 `mimeType/fileSize/storageKey = null`

---

## 4. Zod 스키마 & API 모델

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

- **업로드 3단계 (파일/노트 미디어 공통)**
  - `/api/document/upload/request` – 업로드 프로세스 생성 (documentId, processId 발급, `documents.kind = 'document'`, `uploadStatus = 'pending'`)
  - `/api/document/upload/presigned` – R2 업로드용 presigned URL 발급 (`uploadStatus = 'uploading'`)
  - `/api/document/upload/confirm` – 업로드 검증 + `uploadStatus='uploaded'` + 전처리 잡(Outbox) 적재 + `processingStatus='pending'` 세팅
  - ArcManager의 파일 업로드뿐 아니라, **ArcDataNote 내 미디어(이미지/파일) 업로드도 이 파이프라인을 그대로 재사용**합니다.
    - 노트에서 첨부한 이미지/파일 역시 `document` 테이블에 **파일 문서(kind='document')** 로 저장되며,
    - Plate 노드 쪽에는 해당 파일 문서의 `download-url`(서명 URL)과 이름만 주입하여 렌더링합니다.

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

현재 `POST /api/document`는 **노트 생성용 kind='note' 디스크리미네이터만** 지원하며, DB의 `documents.kind` 값은 항상 `'document'`로 저장됩니다.  
폴더 생성은 `/api/document/folder`, 파일/외부 리소스 생성은 각 전용 엔드포인트(mimeType 기반)로 분리되어 있습니다.

---

## 5. 서버 API 라우트

### 5.1 문서 목록/생성 (`GET/POST /api/document`)

```8:90:apps/main/src/app/(backend)/api/document/route.ts
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return error('UNAUTHORIZED', '인증이 필요합니다.', { … });
    }

    const userId = session.user.id;

    const repository = new DocumentRepository();
    const { searchParams } = new URL(request.url);
    const kindParam = searchParams.get('kind');

    // kind 파라미터:
    // - null 또는 'document' : 노트/파일 + document 도메인 폴더 트리
    // - 'ai'                 : AI 세션 + AI 도메인 폴더 트리
    if (
      !(
        kindParam === null ||
        kindParam === 'document' ||
        kindParam === 'ai'
      )
    ) {
      return error('BAD_REQUEST', '지원하지 않는 문서 종류입니다.', { … });
    }

    const allDocuments = await repository.listByOwner(userId);

    const documents = allDocuments.filter((doc) => {
      const mimeType = doc.mimeType ?? undefined;
      const isFolder = doc.kind === 'folder';

      const isNote =
        typeof mimeType === 'string' &&
        mimeType.startsWith('application/vnd.arc.note+');
      const isAiSession =
        typeof mimeType === 'string' &&
        mimeType === 'application/vnd.arc.ai-chat+json';

      const isDocumentFolder =
        isFolder &&
        (mimeType === null ||
          mimeType === 'application/vnd.arc.folder+document');
      const isAiFolder =
        isFolder && mimeType === 'application/vnd.arc.folder+ai';

      const isFileLike =
        typeof mimeType === 'string' &&
        !isNote &&
        !isAiSession &&
        !mimeType.startsWith('application/vnd.arc.folder+');

      if (kindParam === 'ai') {
        // AI 트리: AI 세션 + AI 폴더만 반환
        return isAiFolder || isAiSession;
      }

      // 기본(문서 트리): note + fileLike + document 폴더
      return isDocumentFolder || isNote || isFileLike;
    });

    return ok(
      {
        documents: documents.map((doc) => ({
          documentId: doc.documentId,
          userId: doc.userId,
          path: doc.path,
          // name은 항상 DB에 저장된 값을 그대로 사용합니다.
          name: (doc as { name: string }).name,
          kind: doc.kind,
          uploadStatus: doc.uploadStatus,
          mimeType: doc.mimeType ?? null,
          fileSize: doc.fileSize ?? null,
          storageKey: doc.storageKey ?? null,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        })),
      },
      { … },
    );
  } catch (err) {
    …
  }
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
- **`DELETE /api/document/[id]`**
  - `DocumentRepository.deleteDocumentForOwner` 호출
  - 대상 `document` row를 hard delete 하고, FK cascade로 연관 `document_content / document_relation / document_chunk`를 함께 삭제
  - 이후 해당 `documentId`에 대해
    - `GET /api/document/[id]`
    - `GET /api/document/[id]/content`
    - `GET /api/document/[id]/download-url`
    는 모두 `NOT_FOUND`(404)를 반환하는 것이 정상 동작

> 구체 구현은 생략하지만, React Query `documentQueryOptions.detail`/`updateMeta`/`delete`가 이 라우트와 1:1로 매핑됩니다.

### 5.3 문서 콘텐츠 버전 (`/api/document/[documentId]/content`)

- **노트 계열 MIME 타입 문서 전용** 엔드포인트입니다.  
  (`documents.kind === 'document'` 이면서 `mimeType`이 `application/vnd.arc.note+...` 인 경우에만 허용)
- `GET` – 최신 버전 조회
- `POST` – 새 버전 추가 (`appendContentVersionForOwner`)

### 5.4 문서 이동 (`PATCH /api/document/[documentId]/move`)

- `DocumentRepository.moveDocumentForOwner`와 동일한 규칙으로, ltree path 기반 subtree 이동 수행.

### 5.5 다운로드 URL 발급 (`GET /api/document/[documentId]/download-url`)

```16:93:apps/main/src/app/(backend)/api/document/[documentId]/download-url/route.ts
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return error('UNAUTHORIZED', '인증이 필요합니다.', { … });
    }

    const userId = session.user.id;

    const { documentId } = await context.params;
    const idResult = uuidSchema.safeParse(documentId);
    if (!idResult.success) {
      return error('BAD_REQUEST', '유효하지 않은 문서 ID입니다.', { … });
    }

    const repository = new DocumentRepository();
    const document = await repository.findByIdForOwner(idResult.data, userId);

    if (!document) {
      return error('NOT_FOUND', '문서를 찾을 수 없습니다.', { … });
    }

    // 폴더 문서는 다운로드 대상이 아닙니다.
    if (document.kind === 'folder') {
      return error('BAD_REQUEST', '폴더 문서는 다운로드할 수 없습니다.', { … });
    }

    if (document.uploadStatus !== 'uploaded') {
      return error(
        'BAD_REQUEST',
        `업로드가 완료되지 않은 문서입니다: ${document.uploadStatus}`,
        { … },
      );
    }

    const storageKey = document.storageKey;
    if (!storageKey) {
      return error('INTERNAL', '파일 스토리지 키가 없습니다.', { … });
    }

    const { searchParams } = new URL(request.url);
    const inline = searchParams.get('inline') === '1';
    const filename = searchParams.get('filename') ?? undefined;

    const { url, expiresAt } = await getCachedDownloadUrl(storageKey, {
      filename: filename ?? undefined,
      mimeType: document.mimeType ?? undefined,
      inline,
    });

    const payload = { url, expiresAt };
    const parsed = documentDownloadUrlResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return error('INTERNAL', '다운로드 URL 생성 결과 검증에 실패했습니다.', { … });
    }

    return ok(parsed.data, {
      user: { id: userId, email: session.user.email || undefined },
      message: '다운로드 URL을 발급했습니다.',
    });
  } catch (err) {
    …
  }
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

  // AI 세션 생성
  createAi: createApiMutation<DocumentDTO, DocumentDetailResponse, DocumentAiSessionCreateRequest>(
    () => '/api/document/ai',
    (data) => data.document,
    { method: 'POST', bodyExtractor: … },
  ),

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

- **노트 미디어 업로드 전용 훅 (`useUploadFile`)**
  - 위치: `apps/main/src/client/components/arc/ArcData/hooks/note/use-upload-file.ts`
  - `useDocumentUpload()`을 내부에서 사용하여, **노트 내 이미지/파일 업로드를 document 파일 업로드 파이프라인과 통합**합니다.
    - 1) `requestUpload({ name, parentPath, fileSize, mimeType })`
    - 2) `getPresignedUploadUrl({ processId })`로 R2 `uploadUrl` 발급
    - 3) `fetch(uploadUrl, { method: 'PUT', body: file })` 로 실제 파일 업로드
    - 4) `confirmUpload({ processId })` 로 `uploadStatus = 'uploaded'` 전환
    - 5) `GET /api/document/[documentId]/download-url?inline=1&filename=...` 으로 렌더링용 서명 URL 획득
  - 반환값:
    - `uploadedFile: { documentId, name, size, type, url }`
    - `uploadFile(file: File)` – 위 1~5 단계를 캡슐화한 업로드 트리거
    - `isUploading`, `progress`, `uploadingFile` – UI 상태 표시용
  - Plate 노트(`ArcDataNote`)에서는 이 훅을 통해 업로드된 파일 문서를 **노트 블록 내 미디어 노드**로 매핑합니다.

### 7.2 목록/상세/콘텐츠

- `useDocumentFiles()` – 파일/폴더 목록 (ArcManager files 탭)
- `useDocumentNotes()` – 노트/폴더 목록 (ArcManager notes 탭)
- `useDocumentDetail(documentId)` – 단일 문서 메타
- `useDocumentContent(documentId)` – 최신 콘텐츠(JSON)

### 7.3 통합 액션 훅

- `useDocumentMove()` – 문서 이동 (ArcManager DnD와 옵티미스틱 업데이트 포함)
- `useDocumentUpdate()` – 메타/콘텐츠 통합 업데이트
- **`useDocumentDelete()`**
  - 내부 동작:
    1. `DELETE /api/document/[id]` 호출 (`documentQueryOptions.delete`)
    2. **성공 시 `useArcWorkCloseTab()`으로 동일 `documentId`를 가진 ArcWork 탭(예: `arcdata-document`)을 먼저 닫음**
    3. 그 다음에 `queryKeys.documents.*` 관련 쿼리(detail, content, listFiles, listNotes, listAll)를 순차적으로 invalidate
  - 이렇게 해서 삭제 직후 ArcData 탭에서 `/content`를 계속 재요청하며 404를 반복하는 문제를 방지
- `useDocumentFolderCreate()` – 폴더 생성
- `useDocumentYoutubeCreate()` – YouTube 문서 생성
- `useDocumentCreate()` – 노트 문서 생성 (kind='note')
- `useDocumentAiCreate()` – AI 세션 문서 생성 (kind='ai')

---

## 5.x 전처리 파이프라인 개요

파일 업로드 이후 실행되는 전처리(파싱/임베딩 등) 파이프라인의 전체 흐름은  
별도 문서인 `docs/document-preprocessing.md` 에서 상세히 다룹니다.

여기서는 개요만 정리합니다.

- **순서(요약)**: 업로드 완료 → Outbox(`document.preprocess.v1`) → `outbox-worker-document` → 사이드카 → `processingStatus` `'processed'/'failed'`
- **책임 분리**
  - 메인 서버: 업로드 요청/검증, Outbox 잡 생성, 상태 플래그(`uploadStatus/processingStatus`) 관리
  - Outbox 워커: 잡 소비, 사이드카 호출, 처리 성공/실패에 따른 `processingStatus` 업데이트
  - 사이드카: R2에서 파일 다운로드, 파싱/청킹/임베딩/저장 수행

---

## 8. UI 연동

### 8.1 ArcManager (파일/노트 트리)

- 파일 탭:
  - `useDocumentFiles()` → `DocumentDTO[]` → `ArcManagerTreeItem[]`로 변환 후 트리 렌더
  - 내부적으로 `GET /api/document?kind=file`을 호출하며,
    - `kind='folder'` 문서 + `mimeType`이 note 계열이 **아닌** 문서(`isFileLike`)만 포함합니다.
  - DnD → `useDocumentMove()`로 path 기반 subtree 이동
  - 폴더 생성/업로드/YouTube 생성 → 각 훅 호출 후 목록 refetch

- 노트 탭(향후 확장 포인트):
  - `useDocumentNotes()` → note + folder 트리
  - 서버에서는 `GET /api/document?kind=note`를 호출하며,
    - `kind='folder'` 문서 + `mimeType`이 `application/vnd.arc.note+...` 인 문서만 포함합니다.
  - 노트 생성 버튼 → `useDocumentCreate()` (kind='note', `DEFAULT_NOTE_PARAGRAPH` 기본값)
  - DnD → ArcWork 탭에 `arcdata-document` 탭으로 노트 열기

### 8.2 ArcData (문서 뷰어)

- `ArcData` 엔트리 컴포넌트:
  - `useDocumentDetail(documentId)`로 문서를 조회하고,
  - `kind === 'folder'` 인 문서는 ArcData에서 렌더링하지 않습니다.
  - 나머지(`kind === 'document'`) 문서는 **`mimeType` 기준으로** 호스트를 선택합니다.
    - `mimeType`이 `application/vnd.arc.note+plate` → Plate 노트 호스트(`ArcDataNoteHost`)
    - `mimeType`이 `application/vnd.arc.note+draw` → 드로우 노트 호스트(`ArcDataDrawHost`)
    - `application/pdf` → PDF 뷰어(`ArcDataPDFHost`)
    - `video/*` / `audio/*` / `video/youtube` / YouTube URL → 플레이어 호스트(`ArcDataPlayerHost`)

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



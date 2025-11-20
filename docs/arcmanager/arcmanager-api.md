## 1. ArcManager 개요

ArcManager는 ArcSolve 내에서 **문서(파일/폴더) 트리를 탐색하고 관리하는 파일 매니저**입니다.  
현재 구현은 `document` 도메인(ArcData, ArcWork와 연동되는 파일/폴더) 중심이며, 구조적으로는 노트/채팅 탭까지 확장 가능하도록 설계되어 있습니다.

- **주요 역할**
  - `document` 테이블 기반 **트리 구조(ltree)**를 좌측 패널에서 탐색
  - 파일/폴더 생성 및 이동 (Drag & Drop)
  - 파일은 ArcWork 탭 + ArcData 뷰어와 연동해 열기
- **관련 핵심 파일**
  - 클라이언트 UI  
    - `apps/main/src/client/components/arc/ArcManager/ArcManager.tsx`
    - `apps/main/src/client/components/arc/ArcManager/components/tree/ArcManagerTree.tsx`
    - `apps/main/src/client/components/arc/ArcManager/components/list/ArcManagerListItem.tsx`
  - React Query 훅  
    - `apps/main/src/client/states/queries/document/useDocument.ts`
  - 서버/레포지토리  
    - `apps/main/src/app/(backend)/api/document/route.ts`
    - `apps/main/src/app/(backend)/api/document/[documentId]/move/route.ts`
    - `apps/main/src/app/(backend)/api/document/folder/route.ts`
    - `apps/main/src/share/schema/repositories/document-repository.ts`
    - `apps/main/src/share/schema/drizzles/document-drizzle.ts`

---

## 2. 데이터 모델 및 경로 정책

### 2.1 Document 스키마 (요약)

문서(파일/폴더)는 `document` 테이블에 저장되며, **경로(path)**는 PostgreSQL `ltree` 타입으로 관리합니다.

- `kind`: `'folder' | 'document'` (폴더/리프 구조만 표현)
- `mimeType`: 실제 타입 (노트/드로우/PDF/YouTube/기타 파일 등)을 구분
- `path`: ltree 경로 (예: `project.sub_folder.file_pdf`)
- `userId`: 사용자별 네임스페이스

```48:85:apps/main/src/share/schema/drizzles/document-drizzle.ts
export const documents = pgTable(
  'document',
  {
    documentId: uuid('document_id')
      .primaryKey()
      .notNull()
      .defaultRandom(),
    userId: uuid('user_id').notNull(),
    path: ltree('path').notNull(),
    kind: documentKindEnum('kind').notNull(),
    mimeType: text('mime_type'),
    fileSize: bigint('file_size', { mode: 'number' }),
    storageKey: text('storage_key'),
    uploadStatus: documentUploadStatusEnum('upload_status')
      .default('uploaded')
      .notNull(),
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

### 2.2 경로 규칙 (ltree)

- 각 segment는 `toLtreeLabel`로 정규화
  - 원본 이름(`Document.name`)은 UTF-8 전체 범위를 허용하고,
  - `toLtreeLabel`은 이를 **transliteration 기반 ASCII slug**(예: `"새 그림"` → `sae_geurim`)로 변환합니다.
  - 허용 문자: `a-z`, `0-9`, `_`
  - 첫 글자가 영문자가 아니면 `n_` prefix
- 부모/자식 관계는 `'.'`로 연결된 prefix 관계로 나타냅니다.
  - 예:  
    - 폴더: `project`  
    - 하위 폴더: `project.design`  
    - 파일: `project.design.v1_pdf`

서버에서는 `normalizeLtreePath`를 통해 클라이언트에서 넘어온 경로 문자열을 한 번 더 정규화합니다.

---

## 3. 서버 API 레이어

### 3.1 문서 목록 조회 (ArcManager 트리용)

- **엔드포인트**: `GET /api/document?kind=file`
- **핵심 정책**
  - 현재 구현에서는 ArcManager **파일 탭(view=files)과 노트 탭(view=notes) 모두** `GET /api/document` 를 사용합니다.
    - `files` 탭: `kind=file`
    - `notes` 탭: `kind=note`
  - 내부에서는 `DocumentRepository.listByOwner(userId)`로 전체 문서를 가져온 뒤,
    **폴더(`kind='folder'`) + note 계열이 아닌 문서(`mimeType`으로 판별)**만 필터링해서 반환합니다.

```ts
// apps/main/src/app/(backend)/api/document/route.ts 중 GET 일부
const allDocuments = await repository.listByOwner(userId);

const documents = allDocuments.filter((doc) => {
  const mimeType = doc.mimeType ?? undefined;
  const isFolder = doc.kind === 'folder';
  const isNote =
    typeof mimeType === 'string' &&
    mimeType.startsWith('application/vnd.arc.note+');
  const isFileLike =
    typeof mimeType === 'string' &&
    !mimeType.startsWith('application/vnd.arc.note+');

  if (kindParam === null || kindParam === 'file') {
    // ArcManager 파일 트리: fileLike + folder
    return isFolder || isFileLike;
  }

  if (kindParam === 'note') {
    // (향후) 노트 트리: note + folder
    return isFolder || isNote;
  }

  return true;
});
```

- **응답 DTO**: `DocumentDTO[]`
  - 정의 위치: `apps/main/src/share/libs/react-query/query-options/document.ts`
  - 필드: `documentId`, `userId`, `path`, `kind`, `uploadStatus`, `fileMeta`, `createdAt`, `updatedAt`

### 3.2 문서 이동 API (폴더/파일 공통)

- **엔드포인트**: `PATCH /api/document/[documentId]/move`
- **요청 바디**:

```ts
type DocumentMoveRequest = {
  /** 새 부모 경로 ('' = 루트) */
  parentPath: string;
};
```

- **서버 처리 흐름**
  1. `DocumentRepository.moveDocumentForOwner({ documentId, userId, targetParentPath })` 호출
  2. `documentId`가 가리키는 문서의 `path`를 기준으로 **subtree**를 계산
     - `sql\`${documents.path} <@ ${oldPath}::ltree\``
  3. 서브트리에 포함되는 모든 문서에 대해 `oldPath` prefix를 `newBasePath`로 치환
     - 파일이면 “자기 자신만 이동”
     - 폴더이면 “폴더 + 하위 전체 이동”
  4. `userId + path` 유니크 제약 위반 시 `CONFLICT` 에러 반환

```279:379:apps/main/src/share/schema/repositories/document-repository.ts
  async moveDocumentForOwner(params: {
    documentId: string;
    userId: string;
    targetParentPath: string;
  }): Promise<Document> {
    const { documentId, userId, targetParentPath } = params;

    const current = await this.findByIdForOwner(documentId, userId);
    if (!current) { /* NOT_FOUND */ }

    const oldPath = (current.path as unknown as string) ?? '';
    const normalizedTargetParent = normalizeLtreePath(targetParentPath);

    // 자기 자신 또는 자신의 하위 경로로 이동하는 경우는 의미 없는 이동이므로 no-op
    if (normalizedTargetParent) {
      const isSame = oldPath === normalizedTargetParent;
      const isDescendant = normalizedTargetParent.startsWith(`${oldPath}.`);
      if (isSame || isDescendant) {
        return current;
      }
    }

    const segments = oldPath.split('.').filter(Boolean);
    const selfLabel = segments[segments.length - 1] ?? toLtreeLabel('unnamed');
    const newBasePath = normalizedTargetParent
      ? `${normalizedTargetParent}.${selfLabel}`
      : selfLabel;

    const updatedRoot = await this.database.transaction(async (tx) => {
      if (normalizedTargetParent) {
        await this.ensureFolderForOwner(tx, userId, normalizedTargetParent);
      }

      const subtree = await tx
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.userId, userId),
            isNull(documents.deletedAt),
            sql`${documents.path} <@ ${oldPath}::ltree`
          )
        );

      for (const row of subtree) {
        const rowPath = row.path as unknown as string;
        let suffix = '';
        if (rowPath.length > oldPath.length) {
          suffix = rowPath.slice(oldPath.length + 1);
        }
        const newPath = suffix ? `${newBasePath}.${suffix}` : newBasePath;

        await tx
          .update(documents)
          .set({ path: newPath })
          .where(
            and(eq(documents.documentId, row.documentId), eq(documents.userId, userId))
          );
      }

      // ...
    });

    return updatedRoot;
  }
```

> **중요**: 서버는 **폴더/파일 타입을 구분하지 않고** `documentId` 기준으로 subtree를 이동합니다.  
> “폴더 이동 + 하위 전체 이동”은 이 레벨에서 보장되며, 클라이언트에서는 단순히 `documentId`와 `parentPath`만 넘깁니다.

### 3.3 폴더 생성 API

- **엔드포인트**: `POST /api/document/folder`
- **요청 바디**:

```ts
type DocumentFolderCreateRequest = {
  name: string;
  parentPath: string; // '' = 루트
};
```

- `DocumentRepository.createFolderForOwner` 호출
  - `parentPath`를 `normalizeLtreePath`로 정규화한 뒤, `toLtreeLabel(name)`을 붙여 최종 `path` 구성
  - `documents.userPathUnique`(부분 유니크 인덱스: `user_id + path, deleted_at IS NULL`)를 대상으로
    `INSERT ... ON CONFLICT DO NOTHING` 을 수행해 **동일 경로 중복 INSERT를 예외 없이 무시**
  - insert 결과가 없으면 `ensureFolderForOwner` 로 같은 경로의 기존 폴더를 조회해 반환 → **폴더 생성은 완전히 idempotent**
  - 핵심 구현 요약:
    - `insert(documents).values(...).onConflictDoNothing({ target: documents.userPathUnique })`
    - 이후 `ensureFolderForOwner(userId, path)` 재조회

---

## 4. React Query 레이어

### 4.1 Document Query Options

- 정의 위치: `apps/main/src/share/libs/react-query/query-options/document.ts`
- 주요 타입
  - `DocumentDTO`: 서버 Document 엔티티의 클라이언트 DTO
  - `DocumentMoveMutationVariables`: `{ documentId: string; parentPath: string }`
- 주요 옵션
  - `listFiles`: `GET /api/document?kind=file` → `DocumentDTO[]` (ArcManager `files` 탭에서 사용)
  - `listNotes`: `GET /api/document?kind=note` → `DocumentDTO[]` (ArcManager `notes` 탭에서 사용)
  - `move`: `PATCH /api/document/[documentId]/move` → `DocumentDTO`
  - `createFolder`: `POST /api/document/folder` → `DocumentDTO` (현재는 `files`/`notes` 탭에서 모두 사용)

```76:176:apps/main/src/share/libs/react-query/query-options/document.ts
export const documentQueryOptions = {
  // ...
  listFiles: () =>
    queryOptions({
      queryKey: queryKeys.documents.listFiles(),
      ...createApiQueryOptions<DocumentDTO[], DocumentListResponse>(
        '/api/document?kind=file',
        (data) => data.documents,
        {
          staleTime: TIMEOUT.CACHE.SHORT,
          gcTime: TIMEOUT.CACHE.MEDIUM,
        }
      ),
    }),

  move: createApiMutation<DocumentDTO, DocumentMoveResponse, DocumentMoveMutationVariables>(
    (variables) => `/api/document/${variables.documentId}/move`,
    (data) => data.document,
    {
      method: 'PATCH',
      bodyExtractor: ({ documentId: _documentId, ...body }) =>
        documentMoveRequestSchema.parse(body),
    }
  ),

  createFolder: createApiMutation<
    DocumentDTO,
    DocumentFolderCreateResponse,
    DocumentFolderCreateRequest
  >(
    () => '/api/document/folder',
    (data) => data.document,
    {
      method: 'POST',
      bodyExtractor: (variables) => documentFolderCreateRequestSchema.parse(variables),
    }
  ),
} as const;
```

### 4.2 ArcManager에서 사용하는 훅들

정의 위치: `apps/main/src/client/states/queries/document/useDocument.ts`

- `useDocumentFiles`
  - `documentQueryOptions.listFiles()` 기반
  - ArcManager 파일 탭이 사용하는 파일/폴더 목록
- `useDocumentMove`
  - `documentQueryOptions.move` 기반
  - **옵티미스틱 업데이트 + 전체 캐시 갱신을 포함**
  - `listFiles`, `listNotes`, `listAll` 키에 대해 동시에 옵티미스틱 적용/롤백/invalidate를 수행하므로, 파일/노트 탭 모두에서 이동 즉시 UI 반영
- `useDocumentFolderCreate`
  - 새 폴더 생성용 mutation

---

## 5. 옵티미스틱 이동 (폴더/파일 공통)

### 5.1 핵심 아이디어

문서 이동(`move`) 시:

1. 서버 응답을 기다리기 전에 **React Query 캐시에서 문서 리스트의 `path`를 먼저 변경**합니다.
2. 서버와 동일한 ltree prefix 이동 규칙을 클라이언트에 복제하여,  
   **폴더 이동 시에도 서브트리 전체가 한 번에 이동**된 것처럼 보이게 합니다.
3. 실패 시 롤백, 성공/실패와 관계없이 백그라운드 리페치로 최종 동기화합니다.

### 5.2 `applyDocumentMoveOptimistic`

```118:159:apps/main/src/client/states/queries/document/useDocument.ts
function applyDocumentMoveOptimistic(
  list: DocumentDTO[],
  input: DocumentMoveMutationVariables,
): DocumentDTO[] {
  const { documentId, parentPath } = input;

  const moving = list.find((d) => d.documentId === documentId);
  if (!moving) return list;

  const oldPath = moving.path;
  if (!oldPath) return list;

  const normalizedTargetParent = parentPath.trim();

  // 자기 자신 또는 자신의 하위 경로로 이동하는 경우는 의미 없는 이동이므로 no-op 처리
  if (normalizedTargetParent) {
    const isSame = oldPath === normalizedTargetParent;
    const isDescendant = normalizedTargetParent.startsWith(`${oldPath}.`);
    if (isSame || isDescendant) {
      return list;
    }
  }

  const segments = oldPath.split('.').filter(Boolean);
  const selfLabel = segments[segments.length - 1] ?? '';
  const newBasePath = normalizedTargetParent
    ? `${normalizedTargetParent}.${selfLabel}`
    : selfLabel;

  return list.map((doc) => {
    const path = doc.path;

    // subtree 판별: oldPath 또는 oldPath.xxx
    if (path === oldPath || path.startsWith(`${oldPath}.`)) {
      let suffix = '';
      if (path.length > oldPath.length) {
        suffix = path.slice(oldPath.length + 1);
      }
      const newPath = suffix ? `${newBasePath}.${suffix}` : newBasePath;

      return {
        ...doc,
        path: newPath,
        updatedAt: new Date().toISOString(),
      };
    }

    return doc;
  });
}
```

### 5.3 `useDocumentMove`의 옵티미스틱 처리

```161:199:apps/main/src/client/states/queries/document/useDocument.ts
export function useDocumentMove(): UseDocumentMoveReturn {
  const queryClient = useQueryClient();

  const moveMutation = useMutation({
    mutationFn: documentQueryOptions.move.mutationFn,
    async onMutate(variables: DocumentMoveMutationVariables) {
      const key = queryKeys.documents.listFiles();

      // 관련 쿼리의 진행 중 refetch를 취소합니다.
      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<DocumentDTO[]>(key);
      if (!previous) {
        return { previous: undefined as DocumentDTO[] | undefined };
      }

      const updated = applyDocumentMoveOptimistic(previous, variables);
      queryClient.setQueryData<DocumentDTO[]>(key, updated);

      return { previous };
    },
    onError(_error, _variables, context) {
      const key = queryKeys.documents.listFiles();
      if (context?.previous) {
        queryClient.setQueryData<DocumentDTO[]>(key, context.previous);
      }
    },
    onSettled() {
      const key = queryKeys.documents.listFiles();
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return {
    move: moveMutation.mutateAsync,
    isMoving: moveMutation.isPending,
    moveError: moveMutation.error,
  };
}
```

- **옵티미스틱 시점**: `onMutate`
- **롤백 시점**: `onError`
- **서버와 최종 동기화**: `onSettled`에서 `invalidateQueries` → 백그라운드 리페치

> 이 덕분에 ArcManager 트리는 **폴더/파일 이동 직후 끊김 없이 UI가 갱신**되고,  
> 네트워크/서버 상태는 이후 자동으로 맞춰집니다.

---

## 6. ArcManager 컴포넌트 구조

### 6.1 탭 구조 및 상태

정의 파일: `apps/main/src/client/components/arc/ArcManager/ArcManager.tsx`

- 탭 종류
  - `notes` / `files` / `chat`
  - `files` 탭: 파일/폴더 문서를 `GET /api/document?kind=file` 기반으로 조회
  - `notes` 탭: 노트/폴더 문서를 `GET /api/document?kind=note`, `POST /api/document`, `POST /api/document/folder` 로 조회/생성
  - `chat` 탭: UI 구조만 준비되어 있고, 아직 별도의 서버 도메인과는 연결되지 않음
- 탭별 상태 (`ArcManagerTabViewState`)
  - `searchQuery`: 검색어 (현재 필터 미적용, UI만)
  - `currentPath`: 현재 탐색 중인 경로 (`''` = 루트)
  - `isCollapsed`: 브레드크럼 접힘 여부
  - `creatingFolder`: 인라인 새 폴더 입력 중 여부
  - `newFolderName`: 인라인 입력 값

문서 목록(`DocumentDTO[]`)은 `fileTreeItems: ArcManagerTreeItem[]`으로 변환되어 트리 구조로 렌더링됩니다.

#### 6.2 인라인 생성 패턴

노트/폴더/YouTube 생성 시 **인라인 이름 입력 플레이스홀더**를 사용하여 사용자 경험을 개선합니다:

- **노트 생성 (notes 탭)**
  - 버튼 클릭 → `creatingNoteType: 'text' | 'draw'` 상태 설정 → 인라인 행 렌더링
  - 이름 입력 → Enter/blur 시 `handleNoteCreateConfirm` 호출 → `createDocument` 실행
  - **Enter는 blur만 트리거**하여 이중 요청 방지 (Enter + blur 중복 호출 문제 해결)

- **폴더 생성 (files / notes 탭)**
  - 버튼 클릭 → `creatingFolder: true` → 인라인 폴더 행 렌더링
  - 이름 입력
    - Enter: `e.preventDefault()` 후 `blur()`만 트리거 → 실제 생성 로직은 **blur 한 번만** 실행
    - blur: `handleFolderCreateConfirm(tab)` 호출
  - `handleFolderCreateConfirm` 내부에서
    - 탭별 핸들러(`folderCreateHandlers[tab]`)를 통해
      - `files` 탭: `createFolder({ parentPath, name })` 후 `refetchFiles()`
      - `notes` 탭: `createFolder({ parentPath, name })` 후 `refetchNotes()`
    - `folderCreatingRef` 로 탭별 **중복 실행(다중 blur 등)을 방지**

- **폴더 생성 (chat 탭)**
  - 동일한 인라인 UI는 제공하지만, 아직 서버 도메인이 없으므로 `createFolder`는 호출하지 않고
    단순히 UI 상태만 초기화합니다.

- **YouTube 생성 (files 탭)**
  - 버튼 클릭 → `creatingYoutube: true` → 인라인 YouTube 행 렌더링
  - URL 입력 → Enter/blur 시 `handleYoutubeCreateConfirm` → `createYoutube` 호출

모든 인라인 생성은 `ArcManagerListItemComponent`를 재사용하며, `nameNode`에 `<input>`을 전달하여 일관된 UX를 유지합니다.

### 6.3 Tree & List 컴포넌트

- `ArcManagerTreeItem` = `ArcManagerListItem` + `children` (재귀)
- `ArcManagerTree`
  - 각 행(row)을 렌더링하고, 폴더 확장/축소 및 DnD 이벤트를 처리
  - `onFolderEnter`, `onItemDragStart`, `onItemDropOnRow`, `onItemDropOnEmpty`, `onPlaceholderDrop`, `onItemContextMenu` 등을 props로 받음
- `ArcManagerListItem`
  - 실제 버튼 UI (아이콘 + 이름 + 메뉴 아이콘)
  - `itemType === 'folder'`일 때 폴더 아이콘/열림/닫힘 상태 표시

#### 6.4 컨텍스트 메뉴 (우클릭 / 옵션 버튼 공통)

- Radix UI의 `ContextMenu`를 사용해 ArcManager 트리 행 전체에 **공통 컨텍스트 메뉴**를 제공합니다.
- **트리 레벨**
  - `ArcManagerTree`는 각 행의 `onContextMenu` 이벤트에서 상위로
    - `onItemContextMenu({ item, event })`
    를 호출해 “어떤 아이템에 대해 메뉴가 열렸는지”만 알려줍니다.
  - 우측 옵션 버튼(세 점 아이콘) 클릭 시에도 동일한 타깃을 상위에 전달할 수 있도록 `onItemMenuClick(item)` 훅 포인트를 제공합니다.
- **상위 레벨(ArcManager)**
  - `ContextMenu` 루트를 ArcManager 내부에 한 번만 두고,
    - `ContextMenuTrigger`로 트리 영역을 래핑
    - `ContextMenuContent` 안에서 `contextMenuTarget`(선택된 `ArcManagerTreeItem`) 기준으로 공통 액션을 생성합니다.
  - 공통 액션은 현재 다음과 같습니다.
    - **열기(open)**: `itemType === 'item'` 인 경우, `useArcWorkEnsureOpenTab()`을 사용해 `arcdata-document` 탭을 엽니다.
    - **삭제(delete)**
      - `useDocumentDelete()`를 호출해:
        1. 서버에서 문서를 hard delete(+ FK cascade) 하고,
        2. **성공 시 ArcWork 레이아웃에서 동일 `documentId`를 가진 `arcdata-document` 탭을 먼저 닫은 다음,**
        3. 문서 메타/콘텐츠/목록 관련 React Query 캐시를 invalidate 합니다.
      - 컨텍스트 메뉴에서 어떤 노트 타입이든 삭제를 눌렀을 때, **탭이 먼저 닫힌 뒤, 백그라운드에서 리스트/캐시가 정리되는** 것이 의도된 동작입니다.

```ts
// 개략적인 액션 생성 함수
function createCommonActionsForArcManagerItem(
  item: ArcManagerTreeItem,
  deps: { ensureOpenTab: (...args) => void; deleteDocument: (id: string) => Promise<void> },
) {
  const actions = [];
  if (item.itemType === 'item') {
    actions.push({ id: 'open', onSelect: () => deps.ensureOpenTab({ id: item.id, name: item.name, type: 'arcdata-document' }) });
  }
  actions.push({ id: 'delete', onSelect: () => deps.deleteDocument(item.id) });
  return actions;
}
```

- 이렇게 설계함으로써:
  - **우클릭(행 전체)**과
  - **옵션 버튼(우측 아이콘)**
  모두에서 동일한 컨텍스트 메뉴 구성을 재사용할 수 있고,
  삭제/열기 등 공통 동작은 ArcManager 내부의 한 함수에서만 관리됩니다.
  - 노트 탭에서도 동일한 핸들러가 작동하며, ArcWork 탭 닫기 및 캐시 정리가 일관적으로 동작합니다.

---

## 7. 드래그앤드롭 정책

### 7.1 드래그 소스 (행 기준)

`ArcManagerTree`의 각 행은 `draggable` 속성을 가지고, `onDragStart`에서 부모로 이벤트를 위임합니다.

```140:152:apps/main/src/client/components/arc/ArcManager/components/tree/ArcManagerTree.tsx
        <div
          className={`${s.row} flex items-center gap-2 ${isDropGroup ? 'bg-muted/40' : ''} ${isDropFolder ? 'ring-1 ring-primary border-primary/60' : ''}`}
          // ...
          draggable
          onDragStart={(event) => {
            onItemDragStart?.({ item, event });
          }}
        >
```

`ArcManager.tsx`에서는 다음 두 가지 데이터가 동시에 설정됩니다.

1. **ArcWork 탭 DnD (파일만)**
   - `item.itemType === 'item'`일 때만 ArcData 탭을 열기 위한 메타데이터 세팅
2. **ArcManager 전용 이동 payload (폴더 + 파일 둘 다)**
   - `DataTransfer`에 `application/x-arcmanager-item` 타입으로  
     `{ source: 'arcmanager', id, path, itemType }`를 저장 (출처 식별용)

```186:235:apps/main/src/client/components/arc/ArcManager/ArcManager.tsx
const handleArcManagerItemDragStart = React.useCallback(
  (params: {
    item: ArcManagerTreeItem;
    event: React.DragEvent<HTMLDivElement>;
    kind: 'file' | 'note';
  }) => {
    const { item, event, kind } = params;
    const dt = event.dataTransfer;
    if (!dt) return;

    // 1) ArcWork 탭용 payload: leaf(item)만 ArcWork 탭으로 열 수 있습니다.
  if (item.itemType === 'item') {
    const tabName =
      (item as { name?: string }).name &&
      (item as { name?: string }).name!.trim().length > 0
        ? (item as { name?: string }).name!
        : item.path;

      setArcWorkTabDragData(event, {
      id: item.id,
      name: tabName,
      type: 'arcdata-document',
    });
  }

    // 2) ArcManager 전용 payload: 트리 내부 이동 및 DropZone에서 사용
    let docMeta: DocumentDTO | undefined;
    if (kind === 'file') {
      docMeta = fileDocumentMap.get(item.id);
    }

  const payload = {
    source: 'arcmanager' as const,
      // 호환성: 일부 기존 코드는 id를, 새로운 코드는 documentId를 사용하므로 둘 다 설정
    id: item.id,
      documentId: item.id,
    path: item.path,
      name: (item as { name?: string }).name ?? item.path,
      kind: (docMeta?.kind as 'folder' | 'document') ?? kind,
    itemType: item.itemType,
      mimeType: docMeta?.mimeType ?? null,
  };

    try {
  dt.setData('application/x-arcmanager-item', JSON.stringify(payload));
  dt.effectAllowed = 'move';
    } catch {
      // ignore
    }
},
  [fileDocumentMap],
);
```

> **정책 정리**
> - **탭 열기(DnD → ArcWork)**: `item`(파일/노트 등 leaf)만 대상이며,  
>   `setArcWorkTabDragData(event, { id, type: 'arcdata-document', name })` 로 payload 를 설정합니다.
> - **문서 이동(DnD → ArcManager 내부 / 기타 DropZone)**: `folder`/`item` 모두 대상이며,  
>   `application/x-arcmanager-item` payload 를 기준으로 동작합니다.

### 7.2 드롭 타겟: 행 위 (onItemDropOnRow)

- `target` 정보: `{ path: string; itemType: 'folder' | 'item' }`
- 소스 복원:
  - `dt.getData('application/x-arcmanager-item')` → `{ id, path, itemType }`
- 부모 경로 결정 규칙
  - 타겟이 **파일**이면: `parentPath = getParentPath(target.path)`  
    → “그 파일이 속한 폴더”
  - 타겟이 **폴더**이면: `parentPath = target.path`  
    → “해당 폴더 내부”
- 이동 전/후 부모가 같으면 `move` 호출 생략

```406:435:apps/main/src/client/components/arc/ArcManager/ArcManager.tsx
onItemDropOnRow: async ({ target, event }) => {
  const dt = event.dataTransfer;
  const raw = dt.getData('application/x-arcmanager-item');
  const source = JSON.parse(raw) as { id: string; path: string; itemType: 'folder' | 'item' };

  // 타겟이 파일이면 그 파일이 속한 폴더가 목적지,
  // 타겟이 폴더면 해당 폴더가 목적지입니다.
  let parentPath = '';
  if (target.itemType === 'item') {
    parentPath = getParentPath(target.path);
  } else {
    parentPath = target.path;
  }

  const sourceParentPath = getParentPath(source.path);
  if (parentPath === sourceParentPath) return;

  await move({ documentId: source.id, parentPath });
},
```

### 7.3 드롭 타겟: 트리 빈 영역 (onItemDropOnEmpty)

- 드롭 위치: **어떤 행에도 걸리지 않는 트리 영역**
- 목적지: `parentPath = currentPath`  
  → “현재 보고 있는 디렉토리 바로 아래”

```440:462:apps/main/src/client/components/arc/ArcManager/ArcManager.tsx
onItemDropOnEmpty: async ({ event }) => {
  const dt = event.dataTransfer;
  const raw = dt.getData('application/x-arcmanager-item');
  const source = JSON.parse(raw) as { id: string; path: string; itemType: 'folder' | 'item' };

  // 빈 영역 드롭은 현재 디렉토리로 이동합니다.
  const parentPath = currentPath;

  const sourceParentPath = getParentPath(source.path);
  if (parentPath === sourceParentPath) return;

  await move({ documentId: source.id, parentPath });
},
```

### 7.4 드롭 타겟: 플레이스홀더 영역 (onPlaceholderDrop)

- UI 상 의미: “현재 디렉토리 최상단으로 이동하기”
- 구현 상 목적지: `parentPath = currentPath` (onItemDropOnEmpty와 동일 경로)
- 향후 정렬/순서 정보가 도입되면, 이 영역을 사용해 “상단으로 올리기”를 보다 정확히 표현할 수 있습니다.

```468:492:apps/main/src/client/components/arc/ArcManager/ArcManager.tsx
onPlaceholderDrop: async ({ event }) => {
  const dt = event.dataTransfer;
  const raw = dt.getData('application/x-arcmanager-item');
  const source = JSON.parse(raw) as { id: string; path: string; itemType: 'folder' | 'item' };

  // 플레이스홀더 드롭은 "현재 디렉토리의 최상위 위치"로 이동합니다.
  // 즉, 현재 디렉토리 바로 아래 레벨로 올립니다.
  const parentPath = currentPath;

  const sourceParentPath = getParentPath(source.path);
  if (parentPath === sourceParentPath) return;

  await move({ documentId: source.id, parentPath });
},
```

### 7.5 드래그 중 하이라이트 정책

`ArcManagerTree`는 `dropFolderPath` 상태를 사용해 **행/그룹 하이라이트**를 관리합니다.

- 폴더 행 위로 드래그: 해당 폴더를 `dropFolderPath`로 설정
- 아이템 행 위로 드래그: 그 아이템의 부모 폴더를 `dropFolderPath`로 설정
- `dropFolderPath`를 기준으로
  - **해당 폴더 자체**: 테두리 강조
  - **그 하위 전체**: 배경 강조 (`isDropGroup`)

이를 통해 사용자는 항상 **“어느 폴더로 이동되는지”**를 직관적으로 인식할 수 있습니다.

---

## 8. 변경·확장 시 가이드

### 8.1 노트/채팅 탭까지 확장하고 싶을 때

- 노트 탭은 이미 `document` 도메인(`kind=note`)과 연동되어 있으므로,
  추가 확장은 노트 에디터/콘텐츠 도메인에서 다룹니다.
- 채팅 탭을 ArcManager와 연동하고 싶다면 다음 순서를 따릅니다:
  1) `/api/arcyou/...` 등 채팅 전용 도메인 정의
  2) React Query 옵션 추가
  3) ArcManager 탭 구성/트리 매핑 확장

### 8.2 DnD 정책을 조정할 때 체크리스트

1. **ArcManagerTree**
   - `onItemDragStart` / `onDragOver` / `onDrop` / `onItemDropOnEmpty` / `onPlaceholderDrop` 이벤트 흐름 이해
   - `dropFolderPath`와 하이라이트 정책이 원하는 UX와 맞는지 확인
2. **ArcManager (상위 컴포넌트)**
   - `onItemDropOnRow`, `onItemDropOnEmpty`, `onPlaceholderDrop`에서
     - `parentPath` 계산 로직
     - `move` 호출 조건 (`sourceParentPath` 비교) 재검토
3. **useDocumentMove**
   - 옵티미스틱 업데이트 알고리즘(`applyDocumentMoveOptimistic`)이 서버 로직과 계속 동기화되어 있는지 확인
   - 서버 쪽 `moveDocumentForOwner`를 변경했다면, 클라이언트 헬퍼도 반드시 함께 수정

---

## 9. 요약

- ArcManager는 **`document` + ltree 기반 트리 UI**로, 파일/폴더 이동을 DnD로 처리합니다.
- 서버는 `documentId` 기준으로 **폴더/파일 구분 없이 subtree 이동**을 담당하고,  
  클라이언트는 `useDocumentMove`의 **옵티미스틱 업데이트**로 빠른 UI 응답성을 제공합니다.
- DnD 정책은 **탭 열기(파일만)**와 **경로 이동(폴더/파일 공통)**을 엄격히 분리해 UX를 단순하게 유지합니다.
- 이 문서를 기준으로, 추후 노트/채팅 도메인 확장이나 정렬/권한/공유 등의 기능을 추가할 수 있습니다.



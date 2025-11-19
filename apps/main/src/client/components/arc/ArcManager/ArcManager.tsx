'use client';

import {
  ArcManagerListItem as ArcManagerListItemComponent,
} from '@/client/components/arc/ArcManager/components/list/ArcManagerListItem';
import {
  ArcManagerTree,
  type ArcManagerTreeItem,
} from '@/client/components/arc/ArcManager/components/tree';
import { useFileUpload } from '@/client/components/arc/ArcManager/hooks/useFileUpload';
import { Button } from '@/client/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/client/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/custom/tabs';
import { Input } from '@/client/components/ui/input';
import {
  useDocumentCreate,
  useDocumentFiles,
  useDocumentFolderCreate,
  useDocumentMove,
  useDocumentNotes,
  useDocumentYoutubeCreate,
} from '@/client/states/queries/document/useDocument';
import { setArcWorkTabDragData } from '@/client/states/stores/arcwork-layout-store';
import type { DocumentDTO } from '@/share/libs/react-query/query-options';
import {
  DEFAULT_NOTE_PARAGRAPH,
  type EditorContent,
} from '@/share/schema/zod/document-note-zod';
import {
  FolderOpenDot,
  FolderPlus,
  MessageSquare,
  Notebook,
  Pencil,
  Upload,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import * as React from 'react';
import s from './ArcManager.module.css';

export type ArcDataType = 'notes' | 'files' | 'chat';

export interface ArcManagerTabConfig {
  value: ArcDataType;
  icon?: LucideIcon;
  label: string;
}

interface ArcManagerTabViewState {
  /** 검색 입력값 */
  searchQuery: string;
  /** 현재 경로 ('' = 루트) */
  currentPath: string;
  /** 트리/패널 접힘 여부 */
  isCollapsed: boolean;
  /** 새 폴더 입력 중 여부 */
  creatingFolder: boolean;
  /** 새 폴더 이름 입력값 */
  newFolderName: string;
  /** 새 노트 인라인 생성 타입 (텍스트 / 그림) */
  creatingNoteType: 'text' | 'draw' | null;
  /** 새 노트 이름 입력값 */
  newNoteName: string;
  /** YouTube 문서 인라인 생성 여부 */
  creatingYoutube: boolean;
  /** 새 YouTube URL 입력값 */
  newYoutubeUrl: string;
}

const DEFAULT_TABS: ArcManagerTabConfig[] = [
  { value: 'notes', icon: Notebook, label: '노트' },
  { value: 'files', icon: FolderOpenDot, label: '파일' },
  { value: 'chat', icon: MessageSquare, label: '채팅' },
];

const DEFAULT_DRAW_SCENE: EditorContent = {
  type: 'draw',
  elements: [],
  appState: {},
  files: {},
} as const;

function findTreeNodeByPath(
  items: ArcManagerTreeItem[],
  path: string
): ArcManagerTreeItem | undefined {
  for (const item of items) {
    if (item.path === path) return item;
    if (item.children && item.children.length > 0) {
      const found = findTreeNodeByPath(item.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

function buildBreadcrumbItems(
  currentPath: string,
  nameMap?: Map<string, string>
): { label: string; path: string }[] {
  const segments = currentPath ? currentPath.split('.').filter(Boolean) : [];
  const crumbs: { label: string; path: string }[] = [{ label: '홈', path: '' }];

  let acc = '';
  for (const seg of segments) {
    acc = acc ? `${acc}.${seg}` : seg;
    const label = nameMap?.get(acc) ?? seg;
    crumbs.push({ label, path: acc });
  }

  return crumbs;
}

function getParentPath(path: string): string {
  const parts = path.split('.').filter(Boolean);
  return parts.slice(0, -1).join('.');
}

export function ArcManager(): React.ReactElement {
  // 1. 현재 탭 상태 (내부 관리)
  const [currentTab, setCurrentTab] = React.useState<ArcDataType>(DEFAULT_TABS[0]?.value ?? 'notes');

  // 2. 탭별 뷰 상태 (검색어 / 현재 경로 / 접힘 여부)
  const [tabStates, setTabStates] = React.useState<Record<ArcDataType, ArcManagerTabViewState>>({
    notes: {
      searchQuery: '',
      currentPath: '',
      isCollapsed: true,
      creatingFolder: false,
      newFolderName: '',
      creatingNoteType: null,
      newNoteName: '',
      creatingYoutube: false,
      newYoutubeUrl: '',
    },
    files: {
      searchQuery: '',
      currentPath: '',
      isCollapsed: true,
      creatingFolder: false,
      newFolderName: '',
      creatingNoteType: null,
      newNoteName: '',
      creatingYoutube: false,
      newYoutubeUrl: '',
    },
    chat: {
      searchQuery: '',
      currentPath: '',
      isCollapsed: true,
      creatingFolder: false,
      newFolderName: '',
      creatingNoteType: null,
      newNoteName: '',
      creatingYoutube: false,
      newYoutubeUrl: '',
    },
  });

  // 3. 파일 탭용 업로드 훅 (다른 탭은 사용하지 않음)
  const filesTabState = tabStates.files;
  const { fileInputRef, handleUploadClick, handleFileChange } = useFileUpload(filesTabState.currentPath);

  // 4. 파일 문서 목록 조회 (mimeType 기준 파일형 문서)
  const { data: fileDocuments, refetch: refetchFiles } = useDocumentFiles();
  // 노트 문서 목록 조회 (mimeType 기준 노트형 문서)
  const { data: noteDocuments, refetch: refetchNotes } = useDocumentNotes();

  const fileNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    if (!fileDocuments) return map;
    for (const doc of fileDocuments) {
      if (doc.path && doc.name) {
        map.set(doc.path, doc.name);
      }
    }
    return map;
  }, [fileDocuments]);

  const fileDocumentMap = React.useMemo(() => {
    const map = new Map<string, DocumentDTO>();
    if (!fileDocuments) return map;
    for (const doc of fileDocuments) {
      map.set(doc.documentId, doc);
    }
    return map;
  }, [fileDocuments]);

  const noteNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    if (!noteDocuments) return map;
    for (const doc of noteDocuments) {
      if (doc.path && doc.name) {
        map.set(doc.path, doc.name);
      }
    }
    return map;
  }, [noteDocuments]);

  // 문서 이동
  const { move } = useDocumentMove();
  const { createFolder } = useDocumentFolderCreate();
  const { createYoutube } = useDocumentYoutubeCreate();
  const { createDocument, isCreating: isCreatingDocument } = useDocumentCreate();

  const handleArcManagerItemDragStart = React.useCallback(
    (params: {
      item: ArcManagerTreeItem;
      event: React.DragEvent<HTMLDivElement>;
      /**
       * 드래그 소스 탭 논리 타입(파일 탭/노트 탭)
       * - 구조 kind('folder' | 'document')와는 별개입니다.
       */
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
      } else if (kind === 'note') {
        docMeta = noteDocuments?.find((d) => d.documentId === item.id);
      }

      const payload = {
        source: 'arcmanager' as const,
        // 호환성: 일부 기존 코드는 id를, 새로운 코드는 documentId를 사용하므로 둘 다 설정
        id: item.id,
        documentId: item.id,
        path: item.path,
        name: (item as { name?: string }).name ?? item.path,
        // 구조 kind: 폴더 여부만 서버 kind를 그대로 사용하고, 나머지는 'document'로 취급합니다.
        kind: (docMeta?.kind ?? (item.itemType === 'folder' ? 'folder' : 'document')) as
          | 'folder'
          | 'document',
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
    [fileDocumentMap, noteDocuments],
  );

  type FolderCreateHandler = (params: { parentPath: string; name: string }) => Promise<void>;

  const folderCreateHandlers = React.useMemo<Record<ArcDataType, FolderCreateHandler | null>>(
    () => ({
      // files 탭: DocumentRepository 기반 폴더 생성
      files: async ({ parentPath, name }) => {
        await createFolder({ parentPath, name });
        await refetchFiles();
      },
      // notes/chat 탭: 추후 전용 리포지토리/도메인에 연결 예정
      notes: null,
      chat: null,
    }),
    [createFolder, refetchFiles],
  );

  // 파일/폴더 문서 목록을 ArcManagerTreeItem[] 트리 구조로 변환
  // - itemType은 doc.kind를 기준으로 절대적으로 결정합니다.
  const fileTreeItems = React.useMemo<ArcManagerTreeItem[]>(() => {
    if (!fileDocuments || fileDocuments.length === 0) return [];

    type TreeNode = ArcManagerTreeItem & { children?: ArcManagerTreeItem[] };
    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    // 1. 모든 문서를 노드로 생성 (kind 기준으로 folder/item 결정)
    for (const doc of fileDocuments) {
      const createdAt = new Date(doc.createdAt);
      const updatedAt = new Date(doc.updatedAt);
      const itemType: 'folder' | 'item' = doc.kind === 'folder' ? 'folder' : 'item';

      const node: TreeNode = {
        id: doc.documentId,
        path: doc.path,
        name: doc.name,
        itemType,
        tags: [],
        createdAt,
        updatedAt,
        children: itemType === 'folder' ? [] : undefined,
      };

      nodeMap.set(doc.path, node);
    }

    // 2. path 기반으로 parent-child 관계 구성
    for (const node of nodeMap.values()) {
      const parentPath = getParentPath(node.path);
      if (!parentPath) {
        roots.push(node);
        continue;
      }

      const parentNode = nodeMap.get(parentPath);
      if (!parentNode) {
        // 상위 폴더 문서가 없는 경우, 루트 노드로 취급합니다.
        roots.push(node);
      } else {
        if (!parentNode.children) parentNode.children = [];
        parentNode.children.push(node);
      }
    }

    return roots;
  }, [fileDocuments]);

  const noteTreeItems = React.useMemo<ArcManagerTreeItem[]>(() => {
    if (!noteDocuments || noteDocuments.length === 0) return [];

    type TreeNode = ArcManagerTreeItem & { children?: ArcManagerTreeItem[] };
    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    for (const doc of noteDocuments) {
      const createdAt = new Date(doc.createdAt);
      const updatedAt = new Date(doc.updatedAt);
      const itemType: 'folder' | 'item' = doc.kind === 'folder' ? 'folder' : 'item';

      const node: TreeNode = {
        id: doc.documentId,
        path: doc.path,
        name: doc.name,
        itemType,
        tags: [],
        createdAt,
        updatedAt,
        children: itemType === 'folder' ? [] : undefined,
      };

      nodeMap.set(doc.path, node);
    }

    for (const node of nodeMap.values()) {
      const parentPath = getParentPath(node.path);
      if (!parentPath) {
        roots.push(node);
        continue;
      }

      const parentNode = nodeMap.get(parentPath);
      if (!parentNode) {
        roots.push(node);
      } else {
        if (!parentNode.children) parentNode.children = [];
        parentNode.children.push(node);
      }
    }

    return roots;
  }, [noteDocuments]);

  // 공통: 탭별 상태 조회/갱신
  const getTabState = React.useCallback(
    (tabValue: ArcDataType) => tabStates[tabValue],
    [tabStates],
  );

  const patchTabState = React.useCallback(
    (tabValue: ArcDataType, patch: Partial<ArcManagerTabViewState>) => {
      setTabStates((prev) => ({
        ...prev,
        [tabValue]: {
          ...prev[tabValue],
          ...patch,
        },
      }));
    },
    [],
  );

  const handleNoteCreateConfirm = React.useCallback(
    async () => {
      const state = getTabState('notes');
      const name = (state.newNoteName ?? '').trim();
      const parentPath = state.currentPath;
      const noteType = state.creatingNoteType;

      // 입력 없거나 타입이 없는 경우: 생성 취소
      if (!noteType || !name) {
        patchTabState('notes', { creatingNoteType: null, newNoteName: '' });
        return;
      }

      const contents =
        noteType === 'draw' ? DEFAULT_DRAW_SCENE : DEFAULT_NOTE_PARAGRAPH;

      try {
        await createDocument({
          kind: 'note',
          name,
          parentPath,
          contents,
        });

        await refetchNotes().catch(() => {
          // 목록 갱신 실패는 치명적이지 않으므로 콘솔만 남깁니다.
          // eslint-disable-next-line no-console
          console.error('노트 목록 갱신 실패');
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('노트 생성 실패:', error);
      } finally {
        patchTabState('notes', { creatingNoteType: null, newNoteName: '' });
      }
    },
    [createDocument, getTabState, patchTabState, refetchNotes],
  );

  const handleFolderCreateConfirm = React.useCallback(
    async (tabValue: ArcDataType) => {
      const state = getTabState(tabValue);
      const name = state.newFolderName.trim();
      const parentPath = state.currentPath;

      // 입력 없이 포커스 해제된 경우: 생성 취소
      if (!name) {
        patchTabState(tabValue, { creatingFolder: false, newFolderName: '' });
        return;
      }

      const handler = folderCreateHandlers[tabValue];
      if (!handler) {
        // 아직 해당 탭 도메인의 폴더 생성이 미구현인 경우, UI 상태만 정리
        patchTabState(tabValue, { creatingFolder: false, newFolderName: '' });
        return;
      }

      try {
        await handler({ parentPath, name });
      } catch (error) {
        console.error('폴더 생성 실패:', error);
      } finally {
        patchTabState(tabValue, { creatingFolder: false, newFolderName: '' });
      }
    },
    [folderCreateHandlers, getTabState, patchTabState],
  );

  const handleYoutubeCreateConfirm = React.useCallback(
    async (tabValue: ArcDataType) => {
      const state = getTabState(tabValue);
      const url = (state.newYoutubeUrl ?? '').trim();
      const parentPath = state.currentPath;

      // 입력 없이 포커스 해제된 경우: 생성 취소
      if (!url) {
        patchTabState(tabValue, { creatingYoutube: false, newYoutubeUrl: '' });
        return;
      }

      // 간단한 유효성 검사: YouTube 도메인 여부
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        const isYoutubeHost =
          host.includes('youtube.com') || host.includes('youtu.be');
        if (!isYoutubeHost) {
          // TODO: 향후 토스트 등 사용자 피드백 추가
          patchTabState(tabValue, { creatingYoutube: false, newYoutubeUrl: '' });
          return;
        }
      } catch {
        patchTabState(tabValue, { creatingYoutube: false, newYoutubeUrl: '' });
        return;
      }

      try {
        await createYoutube({ url, parentPath });
        if (tabValue === 'files') {
          await refetchFiles();
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('YouTube 문서 생성 실패:', error);
      } finally {
        patchTabState(tabValue, { creatingYoutube: false, newYoutubeUrl: '' });
      }
    },
    [createYoutube, getTabState, patchTabState, refetchFiles],
  );

  return (
    <div className={`${s.container} h-full`}>
      <Tabs
        defaultValue={DEFAULT_TABS[0]?.value}
        value={currentTab}
        onValueChange={(value) => setCurrentTab(value as ArcDataType)}
        className="h-full flex flex-col"
      >
        {/* 탭 헤더 */}
        <div className={s.tabs}>
          <TabsList>
            {DEFAULT_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* 탭별 동일 레이아웃: 검색창 + 우측 버튼(폴더 추가 / 업로드) + 트리 */}
        {DEFAULT_TABS.map((tab) => {
          const isFileTab = tab.value === 'files';
          const isNotesTab = tab.value === 'notes';
          const tabState = getTabState(tab.value);
          const {
            searchQuery,
            currentPath,
            isCollapsed,
            creatingFolder,
            newFolderName,
            creatingNoteType,
            newNoteName,
            creatingYoutube,
            newYoutubeUrl,
          } = tabState;

          const treeItems: ArcManagerTreeItem[] = (() => {
            if (isFileTab) {
            if (!currentPath) {
              // 루트에서는 전체 트리 루트를 그대로 보여줍니다.
              return fileTreeItems;
            }
            // 특정 폴더로 이동한 경우, 해당 폴더의 자식들을 루트처럼 보여줍니다.
            const node = findTreeNodeByPath(fileTreeItems, currentPath);
            return node?.children ?? [];
            }

            if (isNotesTab) {
              if (!currentPath) {
                return noteTreeItems;
              }
              const node = findTreeNodeByPath(noteTreeItems, currentPath);
              return node?.children ?? [];
            }

            return [];
          })();

      return (
        <TabsContent key={tab.value} value={tab.value} className="flex-1 min-h-0 flex flex-col">
          <div className="px-2 py-2">
            <div className="flex gap-2">
              <Input
                type="search"
                placeholder="검색..."
                value={searchQuery}
                onChange={(e) => patchTabState(tab.value, { searchQuery: e.target.value })}
                className="flex-1"
              />

              {/* 모든 탭 공통: 폴더 추가 버튼 */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  patchTabState(tab.value, { creatingFolder: true, newFolderName: '' });
                }}
                title="폴더 추가"
              >
                <FolderPlus className="h-4 w-4" />
              </Button>

              {/* notes 탭 전용: 노트 추가 버튼 (텍스트 / 그림) */}
              {isNotesTab && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isCreatingDocument}
                    onClick={() => {
                      patchTabState('notes', {
                        creatingNoteType: 'text',
                        newNoteName: '',
                      });
                    }}
                    title="텍스트 노트 추가"
                  >
                    <Notebook className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isCreatingDocument}
                    onClick={() => {
                      patchTabState('notes', {
                        creatingNoteType: 'draw',
                        newNoteName: '',
                      });
                    }}
                    title="그림 노트 추가"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </>
              )}

              {/* files 탭 전용: 파일 업로드 버튼 */}
              {isFileTab && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                    accept="*/*"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleUploadClick}
                    title="파일 업로드"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      patchTabState('files', {
                        creatingYoutube: true,
                        newYoutubeUrl: '',
                      })
                    }
                    title="YouTube 링크 추가"
                  >
                    <Youtube className="h-4 w-4 text-red-500" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
                {/* 새 폴더 인라인 생성 행 (탭 공통) - ArcManagerListItem 스타일 재사용 */}
                {creatingFolder && (
                  <ArcManagerListItemComponent
                    id={`__new-folder-${tab.value}__`}
                    // path는 임시 값이지만, 실제로는 nameNode(input)에 의해 표시되므로
                    // 트리 구조에 영향을 주지 않습니다.
                    path={currentPath ? `${currentPath}.new_folder` : 'new_folder'}
                    name={newFolderName || ''}
                    itemType="folder"
                    tags={[]}
                    createdAt={new Date()}
                    updatedAt={new Date()}
                    isExpanded={false}
                    hideMenu
                    nameNode={
                      <input
                        autoFocus
                        className="bg-transparent flex-1 outline-none text-xs"
                        value={newFolderName}
                        onChange={(e) =>
                          patchTabState(tab.value, { newFolderName: e.target.value })
                        }
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            await handleFolderCreateConfirm(tab.value);
                          } else if (e.key === 'Escape') {
                            patchTabState(tab.value, {
                              creatingFolder: false,
                              newFolderName: '',
                            });
                          }
                        }}
                        onBlur={() => {
                          void handleFolderCreateConfirm(tab.value);
                        }}
                        placeholder="새 폴더 이름"
                      />
                    }
                  />
                )}

                {/* 새 노트 인라인 생성 행 (notes 탭 전용) */}
                {isNotesTab && creatingNoteType && (
                  <ArcManagerListItemComponent
                    id={`__new-note-${tab.value}__`}
                    path={
                      currentPath
                        ? `${currentPath}.new_note`
                        : 'new_note'
                    }
                    name={newNoteName || ''}
                    itemType="item"
                    tags={[]}
                    createdAt={new Date()}
                    updatedAt={new Date()}
                    icon={
                      creatingNoteType === 'draw' ? (
                        <Pencil className="h-4 w-4" />
                      ) : (
                        <Notebook className="h-4 w-4" />
                      )
                    }
                    hideMenu
                    nameNode={
                      <input
                        autoFocus
                        className="bg-transparent flex-1 outline-none text-xs"
                        value={newNoteName}
                        onChange={(e) =>
                          patchTabState(tab.value, {
                            newNoteName: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.currentTarget.blur();
                          } else if (e.key === 'Escape') {
                            patchTabState(tab.value, {
                              creatingNoteType: null,
                              newNoteName: '',
                            });
                          }
                        }}
                        onBlur={() => {
                          void handleNoteCreateConfirm();
                        }}
                        placeholder={
                          creatingNoteType === 'draw'
                            ? '그림 노트 이름을 입력하세요'
                            : '노트 이름을 입력하세요'
                        }
                      />
                    }
                  />
                )}

                {/* 새 YouTube 문서 인라인 생성 행 (files 탭 전용) */}
                {isFileTab && creatingYoutube && (
                  <ArcManagerListItemComponent
                    id={`__new-youtube-${tab.value}__`}
                    path={
                      currentPath
                        ? `${currentPath}.new_youtube`
                        : 'new_youtube'
                    }
                    name={newYoutubeUrl || ''}
                    itemType="item"
                    tags={[]}
                    createdAt={new Date()}
                    updatedAt={new Date()}
                    icon={<Youtube className="h-4 w-4 text-red-500" />}
                    hideMenu
                    nameNode={
                      <input
                        autoFocus
                        className="bg-transparent flex-1 outline-none text-xs"
                        value={newYoutubeUrl}
                        onChange={(e) =>
                          patchTabState(tab.value, {
                            newYoutubeUrl: e.target.value,
                          })
                        }
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            await handleYoutubeCreateConfirm(tab.value);
                          } else if (e.key === 'Escape') {
                            patchTabState(tab.value, {
                              creatingYoutube: false,
                              newYoutubeUrl: '',
                            });
                          }
                        }}
                        onBlur={() => {
                          void handleYoutubeCreateConfirm(tab.value);
                        }}
                        placeholder="YouTube URL을 입력하세요"
                      />
                    }
                  />
                )}

                {isFileTab && (
                  <Collapsible open={!isCollapsed}>
                    <CollapsibleContent>
                      <div className="px-2 pb-1 text-xs text-muted-foreground flex flex-wrap gap-1">
                        {buildBreadcrumbItems(currentPath, fileNameMap).map((crumb, index) => (
                          <span key={crumb.path} className="flex items-center gap-1">
                            {index > 0 && <span>/</span>}
                            <button
                              type="button"
                              className="hover:underline"
                              onClick={() =>
                                patchTabState('files', {
                                  currentPath: crumb.path,
                                  ...(crumb.path ? { isCollapsed: false } : {}),
                                })
                              }
                            >
                              {crumb.label}
                            </button>
                          </span>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {isNotesTab && (
                  <Collapsible open={!isCollapsed}>
                    <CollapsibleContent>
                      <div className="px-2 pb-1 text-xs text-muted-foreground flex flex-wrap gap-1">
                        {buildBreadcrumbItems(currentPath, noteNameMap).map(
                          (crumb, index) => (
                            <span key={crumb.path} className="flex items-center gap-1">
                              {index > 0 && <span>/</span>}
                              <button
                                type="button"
                                className="hover:underline"
                                onClick={() =>
                                  patchTabState('notes', {
                                    currentPath: crumb.path,
                                    ...(crumb.path ? { isCollapsed: false } : {}),
                                  })
                                }
                              >
                                {crumb.label}
                              </button>
                            </span>
                          ),
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <ArcManagerTree
                  items={treeItems}
                  {...(isFileTab && {
                    onFolderEnter: (path: string) =>
                      patchTabState('files', { currentPath: path, isCollapsed: false }),
                    onItemDragStart: ({ item, event }) => {
                      handleArcManagerItemDragStart({
                        item,
                        event,
                        kind: 'file',
                      });
                    },
                    onItemDropOnRow: async ({ target, event }) => {
                      try {
                        const dt = event.dataTransfer;
                        if (!dt) return;
                        const raw = dt.getData('application/x-arcmanager-item');
                        if (!raw) return;
                        const source = JSON.parse(raw) as {
                          source?: string;
                          id: string;
                          path: string;
                          itemType: 'folder' | 'item';
                        };
                        if (source.source !== 'arcmanager') return;

                        // 타겟이 파일이면 그 파일이 속한 폴더가 목적지,
                        // 타겟이 폴더면 해당 폴더가 목적지입니다.
                        let parentPath = '';
                        if (target.itemType === 'item') {
                          parentPath = getParentPath(target.path);
                        } else {
                          parentPath = target.path;
                        }

                        // 이동 전/후 부모 경로가 동일하면 서버 호출을 생략합니다.
                        const sourceParentPath = getParentPath(source.path);
                        if (parentPath === sourceParentPath) return;

                        await move({ documentId: source.id, parentPath });
                      } catch (err) {
                        console.error('문서 이동 실패 (행 드롭):', err);
                      }
                    },
                    onItemDropOnEmpty: async ({ event }) => {
                      try {
                        const dt = event.dataTransfer;
                        if (!dt) return;
                        const raw = dt.getData('application/x-arcmanager-item');
                        if (!raw) return;
                        const source = JSON.parse(raw) as {
                          source?: string;
                          id: string;
                          path: string;
                          itemType: 'folder' | 'item';
                        };
                        if (source.source !== 'arcmanager') return;

                        // 빈 영역 드롭은 현재 디렉토리로 이동합니다.
                        const parentPath = currentPath;

                        // 이동 전/후 부모 경로가 동일하면 서버 호출을 생략합니다.
                        const sourceParentPath = getParentPath(source.path);
                        if (parentPath === sourceParentPath) return;

                        await move({ documentId: source.id, parentPath });
                      } catch (err) {
                        console.error('문서 이동 실패 (빈 영역 드롭):', err);
                      }
                    },
                    onPlaceholderDrop: async ({ event }) => {
                      try {
                        const dt = event.dataTransfer;
                        if (!dt) return;
                        const raw = dt.getData('application/x-arcmanager-item');
                        if (!raw) return;
                        const source = JSON.parse(raw) as {
                          source?: string;
                          id: string;
                          path: string;
                          itemType: 'folder' | 'item';
                        };
                        if (source.source !== 'arcmanager') return;

                        // 플레이스홀더 드롭은 "현재 디렉토리의 최상위 위치"로 이동합니다.
                        // 즉, 현재 디렉토리 바로 아래 레벨로 올립니다.
                        const parentPath = currentPath;

                        // 이동 전/후 부모 경로가 동일하면 서버 호출을 생략합니다.
                        const sourceParentPath = getParentPath(source.path);
                        if (parentPath === sourceParentPath) return;

                        await move({ documentId: source.id, parentPath });
                      } catch (err) {
                        console.error('문서 이동 실패 (플레이스홀더 드롭):', err);
                      }
                    },
                  })}
                  {...(isNotesTab && {
                    onFolderEnter: (path: string) =>
                      patchTabState('notes', { currentPath: path, isCollapsed: false }),
                    onItemDragStart: ({ item, event }) => {
                      handleArcManagerItemDragStart({
                        item,
                        event,
                        kind: 'note',
                      });
                    },
                  })}
                />
          </div>
        </TabsContent>
              );
            })}
      </Tabs>
    </div>
  );
}


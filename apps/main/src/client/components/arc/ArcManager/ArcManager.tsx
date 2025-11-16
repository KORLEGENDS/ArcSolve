'use client';

import {
  ArcManagerListItem as ArcManagerListItemComponent,
} from '@/client/components/arc/ArcManager/components/list/ArcManagerListItem';
import { ArcManagerTree, type ArcManagerTreeItem } from '@/client/components/arc/ArcManager/components/tree';
import { useFileUpload } from '@/client/components/arc/ArcManager/hooks/useFileUpload';
import { Button } from '@/client/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/client/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/custom/tabs';
import { Input } from '@/client/components/ui/input';
import { useDocumentFiles, useDocumentFolderCreate, useDocumentMove } from '@/client/states/queries/document/useDocument';
import { useArcWorkStartAddTabDrag } from '@/client/states/stores/arcwork-layout-store';
import { FolderOpenDot, FolderPlus, MessageSquare, Notebook, Upload, type LucideIcon } from 'lucide-react';
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
}

const DEFAULT_TABS: ArcManagerTabConfig[] = [
  { value: 'notes', icon: Notebook, label: '노트' },
  { value: 'files', icon: FolderOpenDot, label: '파일' },
  { value: 'chat', icon: MessageSquare, label: '채팅' },
];

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
  currentPath: string
): { label: string; path: string }[] {
  const segments = currentPath ? currentPath.split('.').filter(Boolean) : [];
  const crumbs: { label: string; path: string }[] = [{ label: '홈', path: '' }];

  let acc = '';
  for (const seg of segments) {
    acc = acc ? `${acc}.${seg}` : seg;
    crumbs.push({ label: seg, path: acc });
  }

  return crumbs;
}

function getNameFromPath(path: string): string {
  const parts = path.split('.').filter(Boolean);
  return parts[parts.length - 1] || path;
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
    notes: { searchQuery: '', currentPath: '', isCollapsed: true, creatingFolder: false, newFolderName: '' },
    files: { searchQuery: '', currentPath: '', isCollapsed: true, creatingFolder: false, newFolderName: '' },
    chat: { searchQuery: '', currentPath: '', isCollapsed: true, creatingFolder: false, newFolderName: '' },
  });

  // 3. 파일 탭용 업로드 훅 (다른 탭은 사용하지 않음)
  const filesTabState = tabStates.files;
  const { fileInputRef, handleUploadClick, handleFileChange } = useFileUpload(filesTabState.currentPath);

  // 4. 파일 문서 목록 조회 (kind = 'file')
  const { data: fileDocuments, refetch: refetchFiles } = useDocumentFiles();

  // 문서 이동 및 ArcWork 탭 드래그 훅
  const { move } = useDocumentMove();
  const { createFolder } = useDocumentFolderCreate();
  const startAddTabDrag = useArcWorkStartAddTabDrag();

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
          const tabState = getTabState(tab.value);
          const { searchQuery, currentPath, isCollapsed, creatingFolder, newFolderName } = tabState;

          const treeItems: ArcManagerTreeItem[] = (() => {
            if (!isFileTab) return [];
            if (!currentPath) {
              // 루트에서는 전체 트리 루트를 그대로 보여줍니다.
              return fileTreeItems;
            }
            // 특정 폴더로 이동한 경우, 해당 폴더의 자식들을 루트처럼 보여줍니다.
            const node = findTreeNodeByPath(fileTreeItems, currentPath);
            return node?.children ?? [];
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

                {isFileTab && (
                  <Collapsible open={!isCollapsed}>
                    <CollapsibleContent>
                      <div className="px-2 pb-1 text-xs text-muted-foreground flex flex-wrap gap-1">
                        {buildBreadcrumbItems(currentPath).map((crumb, index) => (
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

                <ArcManagerTree
                  items={treeItems}
                  {...(isFileTab && {
                    onFolderEnter: (path: string) =>
                      patchTabState('files', { currentPath: path, isCollapsed: false }),
                    onItemDragStart: ({ item, event }) => {
                      // ArcWork 탭 드래그 데이터 설정 (파일만)
                      if (item.itemType === 'item') {
                        const name = getNameFromPath(item.path);
                        startAddTabDrag(event, {
                          id: item.id,
                          name,
                          type: 'arcdata-document',
                        });
                      }

                      // ArcManager 전용 드래그 데이터 설정
                      const dt = event.dataTransfer;
                      if (!dt) return;
                      const payload = {
                        id: item.id,
                        path: item.path,
                        itemType: item.itemType,
                      };
                      try {
                        dt.setData('application/x-arcmanager-item', JSON.stringify(payload));
                        dt.effectAllowed = 'move';
                      } catch {
                        // ignore
                      }
                    },
                    onItemDropOnRow: async ({ target, event }) => {
                      try {
                        const dt = event.dataTransfer;
                        if (!dt) return;
                        const raw = dt.getData('application/x-arcmanager-item');
                        if (!raw) return;
                        const source = JSON.parse(raw) as {
                          id: string;
                          path: string;
                          itemType: 'folder' | 'item';
                        };

                        // 현재는 파일(item)만 이동을 지원합니다.
                        if (source.itemType !== 'item') return;

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
                        await refetchFiles();
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
                          id: string;
                          path: string;
                          itemType: 'folder' | 'item';
                        };

                        // 현재는 파일(item)만 이동을 지원합니다.
                        if (source.itemType !== 'item') return;

                        // 빈 영역 드롭은 현재 디렉토리로 이동합니다.
                        const parentPath = currentPath;

                        // 이동 전/후 부모 경로가 동일하면 서버 호출을 생략합니다.
                        const sourceParentPath = getParentPath(source.path);
                        if (parentPath === sourceParentPath) return;

                        await move({ documentId: source.id, parentPath });
                        await refetchFiles();
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
                          id: string;
                          path: string;
                          itemType: 'folder' | 'item';
                        };

                        // 현재는 파일(item)만 이동을 지원합니다.
                        if (source.itemType !== 'item') return;

                        // 플레이스홀더 드롭은 "현재 디렉토리의 최상위 위치"로 이동합니다.
                        // 즉, 현재 디렉토리 바로 아래 레벨로 올립니다.
                        const parentPath = currentPath;

                        // 이동 전/후 부모 경로가 동일하면 서버 호출을 생략합니다.
                        const sourceParentPath = getParentPath(source.path);
                        if (parentPath === sourceParentPath) return;

                        await move({ documentId: source.id, parentPath });
                        await refetchFiles();
                      } catch (err) {
                        console.error('문서 이동 실패 (플레이스홀더 드롭):', err);
                      }
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


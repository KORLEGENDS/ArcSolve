'use client';

import { ArcManagerTree, type ArcManagerTreeItem } from '@/client/components/arc/ArcManager/components/tree';
import { useFileUpload } from '@/client/components/arc/ArcManager/hooks/useFileUpload';
import { Button } from '@/client/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/client/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/custom/tabs';
import { Input } from '@/client/components/ui/input';
import { useDocumentFiles } from '@/client/states/queries/document/useDocument';
import { FolderOpenDot, MessageSquare, Notebook, Upload, type LucideIcon } from 'lucide-react';
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

export function ArcManager(): React.ReactElement {
  // 1. 현재 탭 상태 (내부 관리)
  const [currentTab, setCurrentTab] = React.useState<ArcDataType>(DEFAULT_TABS[0]?.value ?? 'notes');

  // 2. 탭별 뷰 상태 (검색어 / 현재 경로 / 접힘 여부)
  const [tabStates, setTabStates] = React.useState<Record<ArcDataType, ArcManagerTabViewState>>({
    notes: { searchQuery: '', currentPath: '', isCollapsed: true },
    files: { searchQuery: '', currentPath: '', isCollapsed: true },
    chat: { searchQuery: '', currentPath: '', isCollapsed: true },
  });

  // 3. 파일 탭용 업로드 훅 (다른 탭은 사용하지 않음)
  const filesTabState = tabStates.files;
  const { fileInputRef, handleUploadClick, handleFileChange } = useFileUpload(filesTabState.currentPath);

  // 4. 파일 문서 목록 조회 (kind = 'file')
  const { data: fileDocuments } = useDocumentFiles();

  // 파일 문서 목록을 ArcManagerTreeItem[] 트리 구조로 변환
  const fileTreeItems = React.useMemo<ArcManagerTreeItem[]>(() => {
    if (!fileDocuments || fileDocuments.length === 0) return [];

    type TreeNode = ArcManagerTreeItem & { children?: ArcManagerTreeItem[] };
    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    for (const doc of fileDocuments) {
      const createdAt = new Date(doc.createdAt);
      const updatedAt = new Date(doc.updatedAt);
      const segments = doc.path.split('.').filter(Boolean);

      let parentPath: string | undefined;

      segments.forEach((segment, index) => {
        const currentPath = parentPath ? `${parentPath}.${segment}` : segment;
        const isLast = index === segments.length - 1;
        const itemType = isLast ? 'item' : 'folder';

        let node = nodeMap.get(currentPath);
        if (!node) {
          node = {
            id: isLast ? doc.documentId : currentPath,
            path: currentPath,
            itemType,
            tags: [],
            createdAt,
            updatedAt,
            children: itemType === 'folder' ? [] : undefined,
          };
          nodeMap.set(currentPath, node);

          if (parentPath) {
            const parentNode = nodeMap.get(parentPath);
            if (parentNode) {
              if (!parentNode.children) parentNode.children = [];
              parentNode.children.push(node);
            }
          } else {
            roots.push(node);
          }
        }

        parentPath = currentPath;
      });
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

        {/* 탭별 동일 레이아웃: 검색창 + 우측 버튼 + 트리 */}
        {DEFAULT_TABS.map((tab) => {
          const isFileTab = tab.value === 'files';
          const tabState = getTabState(tab.value);
          const { searchQuery, currentPath, isCollapsed } = tabState;

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

                  {isFileTab ? (
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
                  ) : (
                    <Button
                      variant="outline"
                      size="icon"
                      // TODO: 각 탭별로 다른 버튼/핸들러를 연결
                      onClick={() => {}}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
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


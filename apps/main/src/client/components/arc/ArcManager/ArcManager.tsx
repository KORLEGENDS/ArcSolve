'use client';

import { ArcManagerTree, type ArcManagerTreeItem } from '@/client/components/arc/ArcManager/components/tree';
import { useFileUpload } from '@/client/components/arc/ArcManager/hooks/useFileUpload';
import { Button } from '@/client/components/ui/button';
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

const DEFAULT_TABS: ArcManagerTabConfig[] = [
  { value: 'notes', icon: Notebook, label: '노트' },
  { value: 'files', icon: FolderOpenDot, label: '파일' },
  { value: 'chat', icon: MessageSquare, label: '채팅' },
];

export function ArcManager(): React.ReactElement {
  // 1. 현재 탭 상태 (내부 관리)
  const [currentTab, setCurrentTab] = React.useState<ArcDataType>(DEFAULT_TABS[0]?.value ?? 'notes');

  // 2. 탭별 검색어 상태
  const [searchQueries, setSearchQueries] = React.useState<Record<ArcDataType, string>>({
    notes: '',
    files: '',
    chat: '',
  });

  // 3. 파일 탭용 업로드 훅 (다른 탭은 사용하지 않음)
  const { fileInputRef, handleUploadClick, handleFileChange } = useFileUpload();

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

  // 공통: 탭별 검색어 가져오기/변경하기
  const getSearchQuery = React.useCallback(
    (tabValue: ArcDataType) => searchQueries[tabValue] ?? '',
    [searchQueries],
  );

  const setSearchQuery = React.useCallback((tabValue: ArcDataType, query: string) => {
    setSearchQueries((prev) => ({ ...prev, [tabValue]: query }));
  }, []);

  // 공통: 탭별 트리 데이터
  // TODO: 각 탭에 맞는 훅(노트/파일/채팅)을 붙여서 실제 데이터를 반환하도록 확장
  const getTreeItems = React.useCallback(
    (_tab: ArcDataType): ArcManagerTreeItem[] => {
      if (_tab === 'files') {
        return fileTreeItems;
      }
      return [];
    },
    [fileTreeItems],
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
          const searchQuery = getSearchQuery(tab.value);
          const treeItems = getTreeItems(tab.value);

          return (
            <TabsContent key={tab.value} value={tab.value} className="flex-1 min-h-0 flex flex-col">
              <div className="px-2 py-2">
                <div className="flex gap-2">
                  <Input
                    type="search"
                    placeholder="검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(tab.value, e.target.value)}
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
                <ArcManagerTree items={treeItems} />
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}


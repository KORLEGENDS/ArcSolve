'use client';

import { ArcManager } from '@/client/components/arc/ArcManager/ArcManager';
import { ArcManagerTree, type ArcManagerTreeItem } from '@/client/components/arc/ArcManager/components/tree';
import { Input } from '@/client/components/ui/input';
import { FolderOpenDot, MessageSquare, Notebook } from 'lucide-react';
import * as React from 'react';

export function LeftSidebarContent() {
  const now = React.useMemo(() => new Date(), []);
  const yesterday = React.useMemo(() => {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return date;
  }, [now]);

  const treeItems: ArcManagerTreeItem[] = React.useMemo(
    () => [
      {
        id: '1',
        path: '/documents',
        itemType: 'folder',
        tags: ['문서', '중요'],
        createdAt: yesterday,
        updatedAt: now,
        onClick: () => console.log('문서 폴더 클릭'),
        onMenuClick: () => console.log('문서 폴더 메뉴 클릭'),
        children: [
          {
            id: '2',
            path: '/documents/project-plan.pdf',
            itemType: 'item',
            tags: ['프로젝트', 'PDF'],
            createdAt: yesterday,
            updatedAt: now,
            onClick: () => console.log('프로젝트 계획서 클릭'),
            onMenuClick: () => console.log('프로젝트 계획서 메뉴 클릭'),
          },
        ],
      },
      {
        id: '3',
        path: '/images',
        itemType: 'folder',
        tags: ['이미지'],
        createdAt: yesterday,
        updatedAt: now,
        onClick: () => console.log('이미지 폴더 클릭'),
        onMenuClick: () => console.log('이미지 폴더 메뉴 클릭'),
        children: [
          {
            id: '4',
            path: '/images/photo.jpg',
            itemType: 'item',
            tags: ['이미지', '사진'],
            createdAt: yesterday,
            updatedAt: now,
            onClick: () => console.log('이미지 파일 클릭'),
            onMenuClick: () => console.log('이미지 파일 메뉴 클릭'),
          },
        ],
      },
    ],
    [now, yesterday]
  );

  const tabs = React.useMemo(
    () => [
      { value: 'notes', icon: Notebook, label: '노트' },
      { value: 'files', icon: FolderOpenDot, label: '파일' },
      { value: 'chat', icon: MessageSquare, label: '채팅' },
    ],
    []
  );

  return (
    <ArcManager
      className="h-full"
      tabs={tabs}
      defaultTab="notes"
      toolbar={<Input type="search" placeholder="검색..." />}
    >
      <ArcManager.TabPanel value="notes">
        <ArcManagerTree items={treeItems} />
      </ArcManager.TabPanel>
      <ArcManager.TabPanel value="files">
        <ArcManagerTree items={treeItems} />
      </ArcManager.TabPanel>
      <ArcManager.TabPanel value="chat">
        <ArcManagerTree items={treeItems} />
      </ArcManager.TabPanel>
    </ArcManager>
  );
}


'use client';

import { ArcManager } from '@/client/components/arc/ArcManager/ArcManager';
import { ArcManagerList, type ArcManagerListItem } from '@/client/components/arc/ArcManager/components/list';
import { ArcManagerTree, type ArcManagerTreeItem } from '@/client/components/arc/ArcManager/components/tree';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Input } from '@/client/components/ui/input';
import * as React from 'react';

export default function ArcManagerDemoPage() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const exampleItems: ArcManagerListItem[] = [
    {
      id: '1',
      path: '/documents',
      name: 'documents',
      itemType: 'folder',
      tags: ['문서', '중요'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('문서 폴더 클릭'),
      onMenuClick: () => console.log('문서 폴더 메뉴 클릭'),
    },
    {
      id: '2',
      path: '/documents/project-plan.pdf',
      name: 'project-plan.pdf',
      itemType: 'item',
      tags: ['프로젝트', 'PDF'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('프로젝트 계획서 클릭'),
      onMenuClick: () => console.log('프로젝트 계획서 메뉴 클릭'),
    },
    {
      id: '3',
      path: '/images/photo.jpg',
      name: 'photo.jpg',
      itemType: 'item',
      tags: ['이미지', '사진'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('이미지 파일 클릭'),
      onMenuClick: () => console.log('이미지 파일 메뉴 클릭'),
    },
    {
      id: '4',
      path: '/music/song.mp3',
      name: 'song.mp3',
      itemType: 'item',
      tags: ['음악', 'MP3'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('음악 파일 클릭'),
      onMenuClick: () => console.log('음악 파일 메뉴 클릭'),
    },
    {
      id: '5',
      path: '/videos/movie.mp4',
      name: 'movie.mp4',
      itemType: 'item',
      tags: ['비디오', '영화'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('비디오 파일 클릭'),
      onMenuClick: () => console.log('비디오 파일 메뉴 클릭'),
    },
    {
      id: '6',
      path: '/settings',
      name: 'settings',
      itemType: 'folder',
      tags: ['시스템'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('설정 클릭'),
      onMenuClick: () => console.log('설정 메뉴 클릭'),
    },
    {
      id: '7',
      path: '/users/profile',
      name: 'profile',
      itemType: 'folder',
      tags: ['사용자', '프로필'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('사용자 프로필 클릭'),
      onMenuClick: () => console.log('사용자 프로필 메뉴 클릭'),
    },
    {
      id: '8',
      path: '/downloads',
      name: 'downloads',
      itemType: 'folder',
      tags: ['다운로드'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('다운로드 클릭'),
      onMenuClick: () => console.log('다운로드 메뉴 클릭'),
    },
  ];

  // 트리 구조 데이터 생성
  const treeItems: ArcManagerTreeItem[] = [
    {
      id: '1',
      path: '/documents',
      name: 'documents',
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
          name: 'project-plan.pdf',
          itemType: 'item',
          tags: ['프로젝트', 'PDF'],
          createdAt: yesterday,
          updatedAt: now,
          onClick: () => console.log('프로젝트 계획서 클릭'),
          onMenuClick: () => console.log('프로젝트 계획서 메뉴 클릭'),
        },
        {
          id: '9',
          path: '/documents/report.docx',
          name: 'report.docx',
          itemType: 'item',
          tags: ['문서', '보고서'],
          createdAt: yesterday,
          updatedAt: now,
          onClick: () => console.log('보고서 클릭'),
          onMenuClick: () => console.log('보고서 메뉴 클릭'),
        },
      ],
    },
    {
      id: '10',
      path: '/images',
      name: 'images',
      itemType: 'folder',
      tags: ['이미지'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('이미지 폴더 클릭'),
      onMenuClick: () => console.log('이미지 폴더 메뉴 클릭'),
      children: [
        {
          id: '3',
          path: '/images/photo.jpg',
          name: 'photo.jpg',
          itemType: 'item',
          tags: ['이미지', '사진'],
          createdAt: yesterday,
          updatedAt: now,
          onClick: () => console.log('이미지 파일 클릭'),
          onMenuClick: () => console.log('이미지 파일 메뉴 클릭'),
        },
        {
          id: '11',
          path: '/images/logo.png',
          name: 'logo.png',
          itemType: 'item',
          tags: ['이미지', '로고'],
          createdAt: yesterday,
          updatedAt: now,
          onClick: () => console.log('로고 클릭'),
          onMenuClick: () => console.log('로고 메뉴 클릭'),
        },
      ],
    },
    {
      id: '12',
      path: '/media',
      name: 'media',
      itemType: 'folder',
      tags: ['미디어'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('미디어 폴더 클릭'),
      onMenuClick: () => console.log('미디어 폴더 메뉴 클릭'),
      children: [
        {
          id: '13',
          path: '/media/music',
          name: 'music',
          itemType: 'folder',
          tags: ['음악'],
          createdAt: yesterday,
          updatedAt: now,
          onClick: () => console.log('음악 폴더 클릭'),
          onMenuClick: () => console.log('음악 폴더 메뉴 클릭'),
          children: [
            {
              id: '4',
              path: '/media/music/song.mp3',
              name: 'song.mp3',
              itemType: 'item',
              tags: ['음악', 'MP3'],
              createdAt: yesterday,
              updatedAt: now,
              onClick: () => console.log('음악 파일 클릭'),
              onMenuClick: () => console.log('음악 파일 메뉴 클릭'),
            },
          ],
        },
        {
          id: '14',
          path: '/media/videos',
          name: 'videos',
          itemType: 'folder',
          tags: ['비디오'],
          createdAt: yesterday,
          updatedAt: now,
          onClick: () => console.log('비디오 폴더 클릭'),
          onMenuClick: () => console.log('비디오 폴더 메뉴 클릭'),
          children: [
            {
              id: '5',
              path: '/media/videos/movie.mp4',
              name: 'movie.mp4',
              itemType: 'item',
              tags: ['비디오', '영화'],
              createdAt: yesterday,
              updatedAt: now,
              onClick: () => console.log('비디오 파일 클릭'),
              onMenuClick: () => console.log('비디오 파일 메뉴 클릭'),
            },
          ],
        },
      ],
    },
    {
      id: '6',
      path: '/settings',
      name: 'settings',
      itemType: 'folder',
      tags: ['시스템'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('설정 클릭'),
      onMenuClick: () => console.log('설정 메뉴 클릭'),
    },
    {
      id: '7',
      path: '/users/profile',
      name: 'profile',
      itemType: 'folder',
      tags: ['사용자', '프로필'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('사용자 프로필 클릭'),
      onMenuClick: () => console.log('사용자 프로필 메뉴 클릭'),
    },
    {
      id: '8',
      path: '/downloads',
      name: 'downloads',
      itemType: 'folder',
      tags: ['다운로드'],
      createdAt: yesterday,
      updatedAt: now,
      onClick: () => console.log('다운로드 클릭'),
      onMenuClick: () => console.log('다운로드 메뉴 클릭'),
    },
  ];

  return (
    <main className="min-h-screen w-full p-6 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">ArcManager 컴포넌트 데모</h1>
          <p className="text-muted-foreground">ArcManager 컴포넌트의 다양한 변형을 확인할 수 있습니다.</p>
        </div>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle>ArcManager 컴포넌트</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">ArcManagerList</h3>
                <div className="p-4 border rounded-lg">
                  <ArcManagerList items={exampleItems} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">ArcManagerTree</h3>
                <div className="p-4 border rounded-lg">
                  <ArcManagerTree items={treeItems} />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle>ArcManager 통합 컴포넌트</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[600px] border rounded-lg">
                <ArcManager />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}


'use client';

import { ArcUserMenu, type ArcUserMenuItem } from '@/client/components/arc/ArcUser';
import * as React from 'react';

// 프로젝트 타입 정의 (실제 데이터 구조에 맞게 수정 필요)
interface Project {
  id: string;
  title: string;
  description?: string;
}

export function SidebarHeader() {
  // 프로젝트 목록 (실제로는 API나 상태 관리에서 가져와야 함)
  const projects: Project[] = React.useMemo(
    () => [
      {
        id: '1',
        title: '웹 애플리케이션 프로젝트',
        description: 'React와 Next.js를 사용한 모던 웹 애플리케이션',
      },
      {
        id: '2',
        title: '모바일 앱 프로젝트',
        description: 'React Native로 개발 중인 크로스 플랫폼 앱',
      },
      {
        id: '3',
        title: '데이터 분석 프로젝트',
        description: 'Python과 Jupyter Notebook을 활용한 데이터 분석',
      },
    ],
    []
  );

  // 선택된 프로젝트 상태
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(
    projects[0] || null
  );

  // 프로젝트 목록을 ArcUserMenu의 menuItems 형식으로 변환
  const projectMenuItems: ArcUserMenuItem[] = React.useMemo(
    () =>
      projects.map((project) => ({
        label: project.title,
        value: project.id,
        description: project.description,
      })),
    [projects]
  );

  // 프로젝트 선택 핸들러
  const handleProjectSelect = React.useCallback(
    (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setSelectedProject(project);
        console.log('선택된 프로젝트:', project);
        // 여기에 실제 프로젝트 선택 로직을 구현하세요
        // 예: 프로젝트 컨텍스트 업데이트, 라우팅 등
      }
    },
    [projects]
  );

  return (
    <ArcUserMenu
      title={selectedProject?.title || '프로젝트 선택'}
      description={selectedProject?.description}
      menuItems={projectMenuItems}
      onMenuItemSelect={handleProjectSelect}
    />
  );
}


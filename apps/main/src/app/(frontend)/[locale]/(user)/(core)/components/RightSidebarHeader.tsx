'use client';

import { ArcUser, type ArcUserMenuItem } from '@/client/components/arc/ArcUser';
import * as React from 'react';

// 사용자 프로필 타입 정의
interface UserProfile {
  id: string;
  name: string;
  email?: string;
  description?: string;
}

// 조직 프로필 타입 정의
interface OrganizationProfile {
  id: string;
  name: string;
  description?: string;
}

export function RightSidebarHeader() {
  // 현재 사용자 프로필 (더미 데이터)
  const currentUser: UserProfile = React.useMemo(
    () => ({
      id: 'user-1',
      name: '홍길동',
      email: 'hong@example.com',
      description: '개발자',
    }),
    []
  );

  // 사용자가 관리하는 조직 목록 (더미 데이터)
  const organizations: OrganizationProfile[] = React.useMemo(
    () => [
      {
        id: 'org-1',
        name: 'ArcSolve 개발팀',
        description: '메인 개발 조직',
      },
      {
        id: 'org-2',
        name: '디자인 스튜디오',
        description: 'UI/UX 디자인 조직',
      },
      {
        id: 'org-3',
        name: '데이터 분석팀',
        description: '데이터 분석 및 인사이트 조직',
      },
    ],
    []
  );

  // 선택된 프로필 상태 (사용자 또는 조직)
  const [selectedProfile, setSelectedProfile] = React.useState<
    UserProfile | OrganizationProfile
  >(currentUser);

  // 메뉴 항목 생성: 사용자 프로필 + 조직 프로필들
  const menuItems: ArcUserMenuItem[] = React.useMemo(
    () => [
      // 사용자 프로필 항목
      {
        label: currentUser.name,
        value: currentUser.id,
        description: currentUser.description || currentUser.email,
      },
      // 조직 프로필 항목들
      ...organizations.map((org) => ({
        label: org.name,
        value: org.id,
        description: org.description,
      })),
    ],
    [currentUser, organizations]
  );

  // 프로필 선택 핸들러
  const handleProfileSelect = React.useCallback(
    (profileId: string) => {
      // 사용자 프로필인지 확인
      if (profileId === currentUser.id) {
        setSelectedProfile(currentUser);
        console.log('선택된 사용자 프로필:', currentUser);
        return;
      }

      // 조직 프로필인지 확인
      const organization = organizations.find((org) => org.id === profileId);
      if (organization) {
        setSelectedProfile(organization);
        console.log('선택된 조직 프로필:', organization);
        // 여기에 실제 조직 선택 로직을 구현하세요
        // 예: 조직 컨텍스트 업데이트, 라우팅 등
      }
    },
    [currentUser, organizations]
  );

  return (
    <ArcUser
      title={selectedProfile.name}
      description={selectedProfile.description}
      menuItems={menuItems}
      onMenuItemSelect={handleProfileSelect}
    />
  );
}


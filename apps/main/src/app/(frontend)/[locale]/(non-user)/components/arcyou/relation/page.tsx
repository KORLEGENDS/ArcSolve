'use client';

import {
    ArcYouRelation,
    type RelationshipWithTargetUser,
} from '@/client/components/arc/ArcYou/ArcYouRelation/components/ArcYouRelation';
import type { ArcYouRelationItemProps } from '@/client/components/arc/ArcYou/ArcYouRelation/components/ArcYouRelationItem';
import { ArcYouRelationList } from '@/client/components/arc/ArcYou/ArcYouRelation/components/ArcYouRelationList';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { useState } from 'react';

export default function ArcYouRelationDemoPage() {
  // 친구 요청 목록 (pending 상태)
  const [friendRequests, setFriendRequests] = useState([
    {
      userId: 'user-1',
      name: '홍길동',
      email: 'hong@example.com',
      profile: {
        imageUrl: undefined,
        name: '홍길동',
      },
      status: 'pending' as const,
    },
    {
      userId: 'user-2',
      name: '김철수',
      email: 'kim@example.com',
      profile: {
        imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kim',
        name: '김철수',
      },
      status: 'pending' as const,
    },
    {
      userId: 'user-3',
      name: '이영희',
      email: 'lee@example.com',
      profile: {
        imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lee',
        name: '이영희',
      },
      status: 'pending' as const,
    },
    {
      userId: 'user-4',
      name: '박민수',
      email: undefined,
      profile: {
        imageUrl: undefined,
        name: '박민수',
      },
      status: 'pending' as const,
    },
  ]);

  // 친구 목록 (accepted 상태)
  const [friends, setFriends] = useState([
    {
      userId: 'user-5',
      name: '정수진',
      email: 'jung@example.com',
      profile: {
        imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jung',
        name: '정수진',
      },
      status: 'accepted' as const,
    },
    {
      userId: 'user-6',
      name: '최동현',
      email: 'choi@example.com',
      profile: {
        imageUrl: undefined,
        name: '최동현',
      },
      status: 'accepted' as const,
    },
    {
      userId: 'user-7',
      name: '한소영',
      email: 'han@example.com',
      profile: {
        imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Han',
        name: '한소영',
      },
      status: 'accepted' as const,
    },
  ]);

  // 다양한 상태 예시
  const [otherStatuses, setOtherStatuses] = useState([
    {
      userId: 'user-8',
      name: '차단된 사용자',
      email: 'blocked@example.com',
      profile: {
        imageUrl: undefined,
        name: '차단된 사용자',
      },
      status: 'blocked' as const,
    },
    {
      userId: 'user-9',
      name: '거절된 사용자',
      email: 'rejected@example.com',
      profile: {
        imageUrl: undefined,
        name: '거절된 사용자',
      },
      status: 'rejected' as const,
    },
  ]);

  const handleAccept = (userId: string) => {
    console.log('수락:', userId);
    setFriendRequests((prev) => prev.filter((req) => req.userId !== userId));
    // 실제로는 API 호출 후 친구 목록에 추가
  };

  const handleReject = (userId: string) => {
    console.log('거절:', userId);
    setFriendRequests((prev) => prev.filter((req) => req.userId !== userId));
    // 실제로는 API 호출 후 상태 업데이트
  };

  const handleItemClick = (userId: string) => {
    console.log('아이템 클릭:', userId);
    // 실제로는 프로필 페이지로 이동하거나 상세 정보 표시
  };

  // 친구 요청 목록 아이템 (핸들러 포함)
  const friendRequestItems: ArcYouRelationItemProps[] = friendRequests.map((request) => ({
    ...request,
    onAccept: () => handleAccept(request.userId),
    onReject: () => handleReject(request.userId),
    onClick: () => handleItemClick(request.userId),
  }));

  // 친구 목록 아이템 (핸들러 포함)
  const friendItems: ArcYouRelationItemProps[] = friends.map((friend) => ({
    ...friend,
    onClick: () => handleItemClick(friend.userId),
  }));

  // 다양한 상태 예시 아이템 (핸들러 포함)
  const otherStatusItems: ArcYouRelationItemProps[] = otherStatuses.map((item) => ({
    ...item,
    onClick: () => handleItemClick(item.userId),
  }));

  // 이메일 없는 예시 아이템
  const noEmailItems: ArcYouRelationItemProps[] = [
    {
      userId: 'user-10',
      name: '이메일 없는 사용자',
      profile: {
        imageUrl: undefined,
        name: '이메일 없는 사용자',
      },
      status: 'pending',
      onAccept: () => console.log('수락'),
      onReject: () => console.log('거절'),
    },
    {
      userId: 'user-11',
      name: '프로필과 이메일 없는 사용자',
      status: 'pending',
      onAccept: () => console.log('수락'),
      onReject: () => console.log('거절'),
    },
  ];

  // ArcYouRelation 컴포넌트용 관계 데이터
  const [relationships, setRelationships] = useState<RelationshipWithTargetUser[]>([
    {
      userId: 'current-user',
      targetUserId: 'user-1',
      status: 'pending',
      requestedAt: new Date(),
      respondedAt: null,
      blockedAt: null,
      targetUser: {
        id: 'user-1',
        name: '홍길동',
        email: 'hong@example.com',
        imageUrl: null,
      },
    },
    {
      userId: 'current-user',
      targetUserId: 'user-2',
      status: 'pending',
      requestedAt: new Date(),
      respondedAt: null,
      blockedAt: null,
      targetUser: {
        id: 'user-2',
        name: '김철수',
        email: 'kim@example.com',
        imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kim',
      },
    },
    {
      userId: 'current-user',
      targetUserId: 'user-3',
      status: 'pending',
      requestedAt: new Date(),
      respondedAt: null,
      blockedAt: null,
      targetUser: {
        id: 'user-3',
        name: '이영희',
        email: 'lee@example.com',
        imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lee',
      },
    },
    {
      userId: 'current-user',
      targetUserId: 'user-5',
      status: 'accepted',
      requestedAt: new Date(),
      respondedAt: new Date(),
      blockedAt: null,
      targetUser: {
        id: 'user-5',
        name: '정수진',
        email: 'jung@example.com',
        imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jung',
      },
    },
    {
      userId: 'current-user',
      targetUserId: 'user-6',
      status: 'accepted',
      requestedAt: new Date(),
      respondedAt: new Date(),
      blockedAt: null,
      targetUser: {
        id: 'user-6',
        name: '최동현',
        email: 'choi@example.com',
        imageUrl: null,
      },
    },
    {
      userId: 'current-user',
      targetUserId: 'user-7',
      status: 'accepted',
      requestedAt: new Date(),
      respondedAt: new Date(),
      blockedAt: null,
      targetUser: {
        id: 'user-7',
        name: '한소영',
        email: 'han@example.com',
        imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Han',
      },
    },
    {
      userId: 'current-user',
      targetUserId: 'user-8',
      status: 'blocked',
      requestedAt: new Date(),
      respondedAt: null,
      blockedAt: new Date(),
      targetUser: {
        id: 'user-8',
        name: '차단된 사용자',
        email: 'blocked@example.com',
        imageUrl: null,
      },
    },
    {
      userId: 'current-user',
      targetUserId: 'user-9',
      status: 'rejected',
      requestedAt: new Date(),
      respondedAt: new Date(),
      blockedAt: null,
      targetUser: {
        id: 'user-9',
        name: '거절된 사용자',
        email: 'rejected@example.com',
        imageUrl: null,
      },
    },
  ]);

  const handleRelationshipAccept = (relationship: RelationshipWithTargetUser) => {
    console.log('수락:', relationship.targetUserId);
    setRelationships((prev) =>
      prev.map((rel) =>
        rel.targetUserId === relationship.targetUserId
          ? { ...rel, status: 'accepted' as const, respondedAt: new Date() }
          : rel
      )
    );
  };

  const handleRelationshipReject = (relationship: RelationshipWithTargetUser) => {
    console.log('거절:', relationship.targetUserId);
    setRelationships((prev) =>
      prev.map((rel) =>
        rel.targetUserId === relationship.targetUserId
          ? { ...rel, status: 'rejected' as const, respondedAt: new Date() }
          : rel
      )
    );
  };

  const handleRelationshipItemClick = (relationship: RelationshipWithTargetUser) => {
    console.log('아이템 클릭:', relationship.targetUserId);
  };

  return (
    <main className="min-h-screen w-full p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 친구 요청 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>친구 요청 ({friendRequests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ArcYouRelationList
              items={friendRequestItems}
              emptyMessage="친구 요청이 없습니다"
              className="space-y-1"
            />
          </CardContent>
        </Card>

        {/* 친구 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>친구 목록 ({friends.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ArcYouRelationList
              items={friendItems}
              emptyMessage="친구가 없습니다"
              className="space-y-1"
            />
          </CardContent>
        </Card>

        {/* 다양한 상태 예시 */}
        <Card>
          <CardHeader>
            <CardTitle>다양한 상태 예시</CardTitle>
          </CardHeader>
          <CardContent>
            <ArcYouRelationList
              items={otherStatusItems}
              className="space-y-1"
            />
          </CardContent>
        </Card>

        {/* 이메일 없는 예시 */}
        <Card>
          <CardHeader>
            <CardTitle>이메일 없는 예시</CardTitle>
          </CardHeader>
          <CardContent>
            <ArcYouRelationList
              items={noEmailItems}
              className="space-y-1"
            />
          </CardContent>
        </Card>

        {/* ArcYouRelation 컴포넌트 데모 */}
        <Card>
          <CardHeader>
            <CardTitle>ArcYouRelation 컴포넌트 데모</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              관계 데이터를 받아서 자동으로 pending과 그 외 상태로 분리하여 위아래로 배치합니다.
            </p>
          </CardHeader>
          <CardContent>
            <ArcYouRelation
              relationships={relationships}
              onAccept={handleRelationshipAccept}
              onReject={handleRelationshipReject}
              onItemClick={handleRelationshipItemClick}
              pendingEmptyMessage="친구 요청이 없습니다"
              friendsEmptyMessage="친구가 없습니다"
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}


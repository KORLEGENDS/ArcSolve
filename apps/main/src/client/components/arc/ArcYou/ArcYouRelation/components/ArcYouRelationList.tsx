'use client';

import * as React from 'react';

import { cn } from '@/client/components/ui/utils';

import { ArcYouRelationItem, type ArcYouRelationItemProps } from './ArcYouRelationItem';

export interface ArcYouRelationListProps {
  /**
   * 관계 아이템 목록
   */
  items: ArcYouRelationItemProps[];
  /**
   * 추가 클래스명
   */
  className?: string;
  /**
   * 빈 목록일 때 표시할 메시지
   */
  emptyMessage?: string;
}

export function ArcYouRelationList({
  items,
  className,
  emptyMessage = '목록이 비어있습니다',
}: ArcYouRelationListProps): React.ReactElement {
  return (
    <div className={cn('w-full flex flex-col', className)}>
      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {emptyMessage}
        </div>
      ) : (
        items.map((item) => (
          <ArcYouRelationItem
            key={item.userId}
            userId={item.userId}
            name={item.name}
            email={item.email}
            profile={item.profile}
            status={item.status}
            onAccept={item.onAccept}
            onReject={item.onReject}
            onCancel={item.onCancel}
            onChat={item.onChat}
            onDelete={item.onDelete}
            className={item.className}
            onClick={item.onClick}
            acceptDisabled={item.acceptDisabled}
            rejectDisabled={item.rejectDisabled}
            cancelDisabled={item.cancelDisabled}
            chatDisabled={item.chatDisabled}
            deleteDisabled={item.deleteDisabled}
          />
        ))
      )}
    </div>
  );
}


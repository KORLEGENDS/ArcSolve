'use client';

import { ArcWorkDynamic, type ArcWorkProps } from '@/client/components/arc/ArcWork';
import { createFactory } from '@/client/components/arc/ArcWork/components';
import { ArcYouChatRoom } from '@/client/components/arc/ArcYou/ArcYouChat';
import { useServiceRestoreLayout } from '@/client/states/stores/service-store';
import { Model, type TabNode } from 'flexlayout-react';
import { useCallback, useMemo } from 'react';

interface ArcWorkContentProps extends Omit<ArcWorkProps, 'factory' | 'defaultLayout'> {
  // ArcWork의 factory, defaultLayout prop을 제외한 모든 props
}

export function ArcWorkContent(props: ArcWorkContentProps) {
  const factory = useCallback(
    createFactory((node: TabNode) => {
      const component = node.getComponent();

      if (component === 'arcyou-chat-room') {
        const roomId = node.getId();
        if (!roomId) return <div className="p-4">채팅방 ID 정보가 없습니다.</div>;
        return <ArcYouChatRoom id={roomId} />;
      }

      return null; // createFactory가 defaultArcWorkFactory를 호출
    }),
    []
  );

  // 저장본 우선 로드, 없으면 빈 레이아웃으로 시작
  const restoreLayout = useServiceRestoreLayout();
  const defaultLayout = useMemo(() => {
    const restored = restoreLayout?.({ replace: false });
    if (restored instanceof Model) return restored;
    // 빈 레이아웃으로 시작
    return Model.fromJson({
      global: {},
      borders: [],
      layout: { type: 'row', weight: 100, children: [] },
    });
  }, [restoreLayout]);

  return <ArcWorkDynamic {...props} defaultLayout={defaultLayout} factory={factory} />;
}


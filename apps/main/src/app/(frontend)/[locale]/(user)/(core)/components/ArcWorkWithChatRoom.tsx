'use client';

import { ArcWorkDynamic, type ArcWorkProps } from '@/client/components/arc/ArcWork';
import { ArcYouChatRoom } from '@/client/components/arc/ArcYou/ArcYouChat';
import { useServiceRestoreLayout } from '@/client/states/stores/service-store';
import { Model, type IJsonModel, type TabNode } from 'flexlayout-react';
import { useCallback, useMemo } from 'react';

interface ArcWorkWithChatRoomProps extends Omit<ArcWorkProps, 'factory' | 'defaultLayout'> {
  // ArcWork의 factory, defaultLayout prop을 제외한 모든 props
}

export function ArcWorkWithChatRoom(props: ArcWorkWithChatRoomProps) {

  const factory = useCallback(
    (node: TabNode) => {
      const component = node.getComponent();

      if (component === 'arcyou-chat-room') {
        const cfg = node.getConfig?.() as { content?: { roomId?: string } } | undefined;
        const roomId = cfg?.content?.roomId;
        if (!roomId) return <div className="p-4">채팅방 정보가 없습니다.</div>;
        return (
          <div className="h-full w-full">
            <ArcYouChatRoom id={roomId} />
          </div>
        );
      }

      // 기본 placeholder 처리
      if (component === 'placeholder') {
        return <div className="p-4">{node.getName()}</div>;
      }

      return null;
    },
    []
  );

  // 저장본 우선 로드, 없으면 최소 fallback
  const restoreLayout = useServiceRestoreLayout();
  const fallbackLayout: IJsonModel = useMemo(
    () => ({
      global: {},
      borders: [],
      layout: {
        type: 'row',
        weight: 100,
        children: [
          {
            type: 'tabset',
            weight: 100,
            children: [
              {
                type: 'tab',
                name: 'Welcome',
                component: 'placeholder',
              },
            ],
          },
        ],
      },
    }),
    []
  );

  const defaultLayout = useMemo(() => {
    const restored = restoreLayout?.({ replace: false });
    if (restored instanceof Model) return restored;
    return Model.fromJson(fallbackLayout);
  }, [restoreLayout, fallbackLayout]);

  return <ArcWorkDynamic {...props} defaultLayout={defaultLayout} factory={factory} />;
}


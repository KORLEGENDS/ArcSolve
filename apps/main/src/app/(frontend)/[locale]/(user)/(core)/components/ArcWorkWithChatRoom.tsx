'use client';

import { ArcWorkDynamic, type ArcWorkProps } from '@/client/components/arc/ArcWork';
import { ArcYouChatRoom, type ArcyouChatMessage } from '@/client/components/arc/ArcYou/ArcYouChat';
import { useServiceRestoreLayout } from '@/client/states/stores/service-store';
import { useArcYouWebSocket } from '@/client/states/queries/useArcYouWebSocket';
import { Model, type IJsonModel, type TabNode } from 'flexlayout-react';
import { useCallback, useMemo } from 'react';

interface ArcWorkWithChatRoomProps extends Omit<ArcWorkProps, 'factory' | 'defaultLayout'> {
  // ArcWork의 factory, defaultLayout prop을 제외한 모든 props
}

export function ArcWorkWithChatRoom(props: ArcWorkWithChatRoomProps) {
  const { messages, currentUserId, sendMessage } = useArcYouWebSocket();

  const handleSubmit = useCallback((message: string) => {
    if (message.trim()) {
      sendMessage(message);
    }
  }, [sendMessage]);

  const factory = useCallback(
    (node: TabNode) => {
      const component = node.getComponent();

      if (component === 'arcyou-chat-room') {
        return (
          <div className="h-full w-full">
            <ArcYouChatRoom
              messages={messages}
              currentUserId={currentUserId ?? 'unknown-user'}
              onSubmit={handleSubmit}
            />
          </div>
        );
      }

      // 기본 placeholder 처리
      if (component === 'placeholder') {
        return <div className="p-4">{node.getName()}</div>;
      }

      return null;
    },
    [messages, handleSubmit]
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


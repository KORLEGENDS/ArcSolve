import {
  useArcWorkTabCreateAdapter,
  type ArcWorkOpenTabInput,
} from '@/client/components/arc/ArcWork/adapters/useArcWorkTabCreateAdapter';
import {
  useArcWorkTabNameUpdateAdapter,
  type ArcWorkTabRenamePayload,
} from '@/client/components/arc/ArcWork/adapters/useArcWorkTabNameUpdateAdapter';
import { useArcWorkModel } from '@/client/states/stores/arcwork-layout-store';
import type { Action as FlexLayoutAction, TabNode } from 'flexlayout-react';
import { Actions } from 'flexlayout-react';
import { useCallback } from 'react';

export interface UseArcWorkTabResult {
  /**
   * 로우 레벨 탭 열기
   */
  openTab: (input: ArcWorkOpenTabInput) => boolean;

  /**
   * 이미 열려 있으면 활성화, 없으면 새로 열기
   */
  ensureOpenTab: (input: ArcWorkOpenTabInput) => boolean;

  /**
   * 채팅방 탭 열기 편의 함수
   */
  openChatRoomTab: (room: { id: string; name: string }) => boolean;

  /**
   * ArcWork의 onAction에 연결할 액션 핸들러
   * - RENAME_TAB 발생 시 도메인 훅을 통해 서버/캐시/탭을 동기화
   */
  onAction: (action: FlexLayoutAction) => FlexLayoutAction | undefined;
}

/**
 * ArcWork 탭 관련 공통 훅
 *
 * - 탭 생성(open/ensureOpen) 어댑터와
 * - 탭 이름 변경(rename → 도메인 rename) 어댑터를 통합합니다.
 */
export function useArcWorkTab(): UseArcWorkTabResult {
  const model = useArcWorkModel();
  const { openTab, ensureOpenTab } = useArcWorkTabCreateAdapter();
  const { handleRename } = useArcWorkTabNameUpdateAdapter();

  const openChatRoomTab = useCallback(
    (room: { id: string; name: string }) =>
      ensureOpenTab({
        id: room.id,
        type: 'arcyou-chat-room',
        name: room.name,
      }),
    [ensureOpenTab]
  );

  const onAction = useCallback(
    (action: FlexLayoutAction): FlexLayoutAction | undefined => {
      if (action.type === Actions.RENAME_TAB && model) {
        const tabId = action.data?.node as string | undefined;
        const newName = action.data?.text as string | undefined;

        if (tabId && typeof newName === 'string') {
          const node = model.getNodeById(tabId) as TabNode | undefined;
          if (node && (node as any).getType?.() === 'tab') {
            const type = node.getComponent();
            const oldName = node.getName();

            if (type) {
              const payload: ArcWorkTabRenamePayload = {
                id: tabId,
                type,
                oldName,
                newName,
              };
              handleRename(payload);
            }
          }
        }
      }

      // 액션 자체는 변경하지 않고 그대로 통과시켜 UI 탭 제목은 항상 업데이트되도록 함
      return action;
    },
    [model, handleRename]
  );

  return {
    openTab,
    ensureOpenTab,
    openChatRoomTab,
    onAction,
  };
}



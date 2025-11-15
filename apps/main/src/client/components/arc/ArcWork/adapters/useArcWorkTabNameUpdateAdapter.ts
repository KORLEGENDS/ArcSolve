import { useRenameChatRoom } from '@/client/states/queries/useArcyouChat';
import { useServiceModel } from '@/client/states/stores/service-store';
import type { TabNode } from 'flexlayout-react';
import { Actions } from 'flexlayout-react';
import { useCallback } from 'react';

export interface ArcWorkTabRenamePayload {
  id: string;
  type: string; // TabNode.getComponent() 값
  oldName?: string;
  newName: string;
}

export interface ArcWorkTabNameUpdateAdapter {
  /**
   * 탭 이름 변경 이벤트를 도메인별 rename 훅으로 라우팅합니다.
   */
  handleRename: (payload: ArcWorkTabRenamePayload) => void;
}

/**
 * ArcWork 탭 이름 변경 → 도메인 데이터 rename 어댑터
 *
 * - 현재는 'arcyou-chat-room' 타입만 지원합니다.
 * - 추후 파일/노트 등 다른 컴포넌트 타입도 이곳에 추가할 수 있습니다.
 */
export function useArcWorkTabNameUpdateAdapter(): ArcWorkTabNameUpdateAdapter {
  const renameChatRoom = useRenameChatRoom();
  const model = useServiceModel();

  const handleRename = useCallback(
    (payload: ArcWorkTabRenamePayload) => {
      const { id, type, newName } = payload;
      const trimmed = newName.trim();
      if (!trimmed) return;

      // 1) 도메인 데이터(서버 + React Query 캐시) 업데이트
      if (type === 'arcyou-chat-room') {
        renameChatRoom.mutate({
          roomId: id,
          name: trimmed,
        });
      }

      // 2) 탭이 열려 있는 경우 FlexLayout 탭 이름도 동기화
      if (model) {
        const node = model.getNodeById(id) as TabNode | undefined;
        if (node && (node as any).getType?.() === 'tab') {
          const nodeType = node.getComponent();
          // component 타입이 알려져 있고 payload.type과 다르면 건너뜀
          if (nodeType && nodeType !== type) {
            return;
          }
          model.doAction(Actions.renameTab(id, trimmed));
        }
      }
    },
    [renameChatRoom, model]
  );

  return {
    handleRename,
  };
}



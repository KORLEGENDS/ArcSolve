import { useRenameChatRoom } from '@/client/states/queries/arcyou/useArcyouChat';
import { useDocumentUpdate } from '@/client/states/queries/document/useDocument';
import { useArcWorkModel } from '@/client/states/stores/arcwork-store';
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

  /**
   * 서버/WS 등 외부에서 이미 확정된 이름 변경을
   * ArcWork 탭에만 반영할 때 사용합니다.
   *
   * - 서버 상태는 이미 최신이라고 가정하고, FlexLayout 탭 이름만 동기화합니다.
   */
  syncTabNameFromRemote: (payload: { id: string; type: string; newName: string }) => void;
}

/**
 * ArcWork에서 문서 기반 탭으로 취급하는 component 타입 목록
 * - id는 documentId로 간주되어 Document 메타 업데이트로 라우팅됩니다.
 */
const DOCUMENT_COMPONENT_TYPES = new Set<string>([
  'arcdata-document',
  'arcai-session',
]);

/**
 * ArcWork 탭 이름 변경 → 도메인 데이터 rename 어댑터
 *
 * - 현재는 'arcyou-chat-room' 타입만 지원합니다.
 * - 추후 파일/노트 등 다른 컴포넌트 타입도 이곳에 추가할 수 있습니다.
 */
export function useArcWorkTabNameUpdateAdapter(): ArcWorkTabNameUpdateAdapter {
  const renameChatRoom = useRenameChatRoom();
  const { updateDocument } = useDocumentUpdate();
  const model = useArcWorkModel();

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
      } else if (DOCUMENT_COMPONENT_TYPES.has(type)) {
        // ArcWork에서 문서 기반 탭으로 취급하는 경우,
        // 탭 id는 documentId로 간주하고 Document 메타(name)를 업데이트합니다.
        void updateDocument({
          mode: 'meta',
          documentId: id,
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
    [renameChatRoom, updateDocument, model]
  );

  const syncTabNameFromRemote = useCallback(
    (payload: { id: string; type: string; newName: string }) => {
      const { id, type, newName } = payload;
      const trimmed = newName.trim();
      if (!trimmed) return;

      if (!model) return;

      const node = model.getNodeById(id) as TabNode | undefined;
      if (!node || (node as any).getType?.() !== 'tab') return;

      const nodeType = node.getComponent();
      if (nodeType && nodeType !== type) {
        return;
      }

      model.doAction(Actions.renameTab(id, trimmed));
    },
    [model]
  );

  return {
    handleRename,
    syncTabNameFromRemote,
  };
}



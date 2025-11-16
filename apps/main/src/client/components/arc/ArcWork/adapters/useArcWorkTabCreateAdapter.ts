import type { ArcWorkTabInput } from '@/client/states/stores/arcwork-layout-store';
import {
  useArcWorkEnsureOpenTab,
  useArcWorkOpenTab,
} from '@/client/states/stores/arcwork-layout-store';
import { useCallback } from 'react';

export interface ArcWorkOpenTabInput extends ArcWorkTabInput {}

export interface ArcWorkTabCreateAdapter {
  /**
   * 새 탭을 엽니다. 이미 열려 있어도 그대로 둡니다.
   */
  openTab: (input: ArcWorkOpenTabInput) => boolean;

  /**
   * 동일 id의 탭이 이미 열려 있으면 활성화하고,
   * 없으면 새로 열어 활성화합니다.
   */
  ensureOpenTab: (input: ArcWorkOpenTabInput) => boolean;
}

/**
 * ArcWork 탭 생성/활성화 공통 어댑터
 *
 * - 내부적으로 service-store의 open/ensureOpen을 래핑합니다.
 * - component type(예: 'arcyou-chat-room')과 id/name 규칙은
 *   호출 측에서 관리하되, 모든 탭 생성을 이 훅을 통해 통일합니다.
 */
export function useArcWorkTabCreateAdapter(): ArcWorkTabCreateAdapter {
  const open = useArcWorkOpenTab();
  const ensureOpen = useArcWorkEnsureOpenTab();

  const openTab = useCallback(
    (input: ArcWorkOpenTabInput) => open(input),
    [open]
  );

  const ensureOpenTab = useCallback(
    (input: ArcWorkOpenTabInput) => ensureOpen(input),
    [ensureOpen]
  );

  return {
    openTab,
    ensureOpenTab,
  };
}



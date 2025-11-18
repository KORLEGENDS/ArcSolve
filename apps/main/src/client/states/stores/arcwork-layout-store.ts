import type { Layout as FlexLayoutView, IJsonModel, TabSetNode } from 'flexlayout-react';
import { Actions, DockLocation, Model } from 'flexlayout-react';
import type React from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * ArcWork 레이아웃 저장/복원 전용 스토어 (MVP)
 * - Model 직렬화/복원(LocalStorage 기반)
 * - ArcWork 통합 시 onModelChange/onAction에서 saveLayout 호출을 권장(디바운스는 호출 측에서)
 */

// ==================== 타입 정의 ====================

export interface ArcWorkLayoutState {
  model: Model | null;
  lastSavedLayout: IJsonModel | null;
  storageKey: string;
  layoutRef: FlexLayoutView | null;
}

export interface ArcWorkTabInput {
  id: string;
  type: string; // component key
  name: string; // 탭 제목 (필수)
  tabsetId?: string;
}

export interface ArcWorkLayoutActions {
  setModel: (model: Model | null) => void;
  setStorageKey: (key: string) => void;
  setLayoutRef: (layout: FlexLayoutView | null) => void;

  saveLayout: (options?: { key?: string }) => void;
  restoreLayout: (options?: { key?: string; fallback?: IJsonModel; replace?: boolean }) => Model | null;
  clearSavedLayout: (options?: { key?: string }) => void;

  // Tabs API
  open: (input: ArcWorkTabInput) => boolean;
  activate: (id: string) => boolean;
  close: (id: string) => boolean;
  ensureOpen: (input: ArcWorkTabInput) => boolean;

  /**
   * ArcWork Layout 외부에서 시작된 드래그 이벤트를 해석하기 위한 핸들러 생성 함수입니다.
   * - `application/x-arcwork-tab` payload를 읽어 탭 생성/이동용 json을 반환합니다.
   * - Drop Sink(`data-arcwork-drop-sink="true"`) 위에서는 항상 `undefined`를 반환합니다.
   *
   * NOTE:
   * - ArcManager 등 외부 컴포넌트는 `setArcWorkTabDragData` 유틸만 호출하고,
   *   실제 탭 생성 여부는 이 핸들러를 통해 ArcWork가 결정합니다.
   */
  makeExternalDragHandler: () => (
    event: React.DragEvent<HTMLElement>
  ) => undefined | { json: any; onDrop?: (node?: unknown, event?: React.DragEvent<HTMLElement>) => void };
}

type ArcWorkLayoutStore = ArcWorkLayoutState & ArcWorkLayoutActions;

// ==================== 내부 유틸 ====================

const DEFAULT_STORAGE_KEY = 'arcwork:layout';

/**
 * 외부(ArcManager, ArcYou 등)에서 시작된 "마지막 ArcWork 탭 드래그" 정보를
 * 보조 채널로 유지하기 위한 변수입니다.
 *
 * - dataTransfer에서 payload를 읽지 못하는 환경/타이밍에서도
 *   ArcWork가 기본 탭 활성화를 보장할 수 있도록 돕습니다.
 * - Drop Sink가 아닌 영역에서만 사용되며,
 *   dataTransfer.types에 우리 MIME이 포함되어 있을 때만 fallback으로 사용합니다.
 */
let currentExternalTab: ArcWorkTabInput | null = null;

const initialState: ArcWorkLayoutState = {
  model: null,
  lastSavedLayout: null,
  storageKey: DEFAULT_STORAGE_KEY,
  layoutRef: null,
};

const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof localStorage !== 'undefined';

// ==================== 스토어 ====================

export const useArcWorkLayoutStore = create<ArcWorkLayoutStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setModel: (model) => set(() => ({ model })),
    setLayoutRef: (layout) => set(() => ({ layoutRef: layout })),

    setStorageKey: (key) =>
      set(() => ({ storageKey: key || DEFAULT_STORAGE_KEY })),

    saveLayout: (options) => {
      const key = options?.key ?? get().storageKey ?? DEFAULT_STORAGE_KEY;
      const model = get().model;
      if (!model) return;

      try {
        const json = model.toJson();
        if (isBrowser()) {
          localStorage.setItem(key, JSON.stringify(json));
        }
        set(() => ({ lastSavedLayout: json }));
      } catch {
        // noop (필요 시 시스템 전역 에러 스토어와 연동)
      }
    },

    restoreLayout: (options) => {
      const key = options?.key ?? get().storageKey ?? DEFAULT_STORAGE_KEY;
      const replace = options?.replace !== false;

      let json: IJsonModel | null = null;
      if (isBrowser()) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            json = JSON.parse(raw) as IJsonModel;
          } catch {
            json = null;
          }
        }
      }

      if (!json && options?.fallback) {
        json = options.fallback;
      }
      if (!json) return null;

      try {
        const restored = Model.fromJson(json);
        if (replace) {
          set(() => ({ model: restored, lastSavedLayout: json }));
        } else {
          set(() => ({ lastSavedLayout: json }));
        }
        return restored;
      } catch {
        return null;
      }
    },

    clearSavedLayout: (options) => {
      const key = options?.key ?? get().storageKey ?? DEFAULT_STORAGE_KEY;
      if (isBrowser()) {
        localStorage.removeItem(key);
      }
    },

    // =============== Tabs API ===============
    open: (input) => {
      const model = get().model;
      if (!model) return false;

      // already open? just activate
      const maybeNode = model.getNodeById(input.id);
      if (maybeNode && maybeNode.getType && maybeNode.getType() === 'tab') {
        model.doAction(Actions.selectTab(input.id));
        return true;
      }

      // find target tabset
      let toTabsetId = input.tabsetId;
      if (!toTabsetId) {
        const active = model.getActiveTabset() as TabSetNode | undefined;
        if (active) {
          toTabsetId = active.getId();
        } else {
          try {
            const first = model.getFirstTabSet();
            toTabsetId = first.getId();
          } catch {
            return false;
          }
        }
      }

      const json = {
        type: 'tab',
        id: input.id,
        name: input.name,
        component: input.type,
      };
      model.doAction(
        Actions.addNode(json, toTabsetId!, DockLocation.CENTER, -1, true)
      );
      return true;
    },

    activate: (id) => {
      const model = get().model;
      if (!model) return false;
      const node = model.getNodeById(id);
      if (!node || node.getType() !== 'tab') return false;
      model.doAction(Actions.selectTab(id));
      return true;
    },

    close: (id) => {
      const model = get().model;
      if (!model) return false;
      const node = model.getNodeById(id);
      if (!node || node.getType() !== 'tab') return false;
      model.doAction(Actions.deleteTab(id));
      return true;
    },

    ensureOpen: (input) => {
      const model = get().model;
      if (!model) return false;
      const node = model.getNodeById(input.id);
      if (node && node.getType() === 'tab') {
        model.doAction(Actions.selectTab(input.id));
        return true;
      }
      return get().open(input);
    },

    makeExternalDragHandler: () => {
      return (event: React.DragEvent<HTMLElement>) => {
        // 1) Drop sink 탐색: data-arcwork-drop-sink="true" 인 요소 위에서는
        //    ArcWork 탭 생성/이동을 수행하지 않고 로컬 드롭 처리를 우선합니다.
        let target = event.target as HTMLElement | null;
        while (target) {
          if (target.dataset && target.dataset.arcworkDropSink === 'true') {
            return undefined;
          }
          target = target.parentElement;
        }

        // 2) Drop sink가 아닌 경우에만 ArcWork 탭 payload를 읽어 탭을 생성/이동합니다.
        const dt = event.dataTransfer;
        if (!dt) return undefined;

        // ArcWork 탭 전용 MIME이 포함되어 있는 드래그만 처리합니다.
        const types = Array.from(dt.types || []);
        const hasArcWorkMime =
          types.includes('application/x-arcwork-tab') ||
          types.includes('text/plain');
        if (!hasArcWorkMime) {
          return undefined;
        }

        let payload: Partial<ArcWorkTabInput> | null = null;

        // 2-1) dataTransfer에서 우선 payload를 읽어옵니다.
        try {
          const raw =
            dt.getData('application/x-arcwork-tab') || dt.getData('text/plain');
          if (raw) {
            payload = JSON.parse(raw) as Partial<ArcWorkTabInput>;
          }
        } catch {
          payload = null;
        }

        // 2-2) dataTransfer에서 읽지 못한 경우, 보조 채널에 저장된 마지막 external tab을 사용합니다.
        if (!payload || !payload.id || !payload.type || !payload.name) {
          if (!currentExternalTab) {
            return undefined;
          }
          payload = currentExternalTab;
        }

        if (!payload?.id || !payload?.type || !payload?.name) {
          return undefined;
        }

        // 2-3) 이미 동일 id의 탭이 열려 있는 경우:
        //      - 새 탭을 추가하려 하면 flexlayout에서 duplicate id 에러가 발생하므로
        //      - 해당 탭을 단순히 활성화(selectTab)만 수행하고, external drag는 취소합니다.
        const model = get().model;
        if (model) {
          const existing = model.getNodeById(payload.id);
          if (existing && (existing as any).getType?.() === 'tab') {
            model.doAction(Actions.selectTab(payload.id));
            return undefined;
          }
        }

          const json = {
            type: 'tab',
            id: payload.id,
            name: payload.name,
            component: payload.type,
          };

          return {
            json,
          };
      };
    },
  }))
);

// ==================== 셀렉터 ====================

export const useArcWorkModel = (): Model | null =>
  useArcWorkLayoutStore((s) => s.model);

export const useArcWorkStorageKey = (): string =>
  useArcWorkLayoutStore((s) => s.storageKey);

export const useArcWorkLastSavedLayout = (): IJsonModel | null =>
  useArcWorkLayoutStore((s) => s.lastSavedLayout);

export const useArcWorkSetModel = (): ArcWorkLayoutActions['setModel'] =>
  useArcWorkLayoutStore((s) => s.setModel);

export const useArcWorkSetStorageKey =
  (): ArcWorkLayoutActions['setStorageKey'] =>
    useArcWorkLayoutStore((s) => s.setStorageKey);

export const useArcWorkSaveLayout =
  (): ArcWorkLayoutActions['saveLayout'] =>
    useArcWorkLayoutStore((s) => s.saveLayout);

export const useArcWorkRestoreLayout =
  (): ArcWorkLayoutActions['restoreLayout'] =>
    useArcWorkLayoutStore((s) => s.restoreLayout);

export const useArcWorkClearSavedLayout =
  (): ArcWorkLayoutActions['clearSavedLayout'] =>
    useArcWorkLayoutStore((s) => s.clearSavedLayout);

export const useArcWorkSetLayoutRef =
  (): ArcWorkLayoutActions['setLayoutRef'] =>
    useArcWorkLayoutStore((s) => s.setLayoutRef);

export const useArcWorkOpenTab =
  (): ArcWorkLayoutActions['open'] => useArcWorkLayoutStore((s) => s.open);

export const useArcWorkActivateTab =
  (): ArcWorkLayoutActions['activate'] => useArcWorkLayoutStore((s) => s.activate);

export const useArcWorkCloseTab =
  (): ArcWorkLayoutActions['close'] => useArcWorkLayoutStore((s) => s.close);

export const useArcWorkEnsureOpenTab =
  (): ArcWorkLayoutActions['ensureOpen'] => useArcWorkLayoutStore((s) => s.ensureOpen);

export const useArcWorkMakeExternalDragHandler =
  (): ArcWorkLayoutActions['makeExternalDragHandler'] =>
    useArcWorkLayoutStore((s) => s.makeExternalDragHandler);

/**
 * ArcWork 탭으로 열릴 수 있는 항목을 드래그 시작할 때,
 * dataTransfer에 ArcWork 전용 payload를 설정하는 유틸 함수입니다.
 *
 * 사용 패턴:
 * - ArcManager 등 "외부"에서 onDragStart 안에서 이 함수를 호출합니다.
 * - ArcWork Layout은 onExternalDrag(makeExternalDragHandler())를 통해
 *   이 payload를 읽고, Drop Sink 여부를 고려하여 탭 생성/이동을 결정합니다.
 */
export function setArcWorkTabDragData(
  event: DragEvent | React.DragEvent<HTMLElement>,
  data: ArcWorkTabInput
) {
  const dt = (event as DragEvent).dataTransfer || (event as React.DragEvent<HTMLElement>).dataTransfer;
  if (!dt) {
    return;
  }
  const json = JSON.stringify({ id: data.id, type: data.type, name: data.name });
  try {
    dt.setData('application/x-arcwork-tab', json);
  } catch {
    // ignore
  }
  try {
    dt.setData('text/plain', json);
  } catch {
    // ignore
  }

  // ArcWork external drag 해석을 위한 보조 채널에도 마지막 탭 정보를 저장합니다.
  currentExternalTab = { ...data };
}



import type { Layout as FlexLayoutView, IJsonModel, TabSetNode, TabNode } from 'flexlayout-react';
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

  // DnD helpers
  makeExternalDragHandler: () => ((event: React.DragEvent<HTMLElement>) => undefined | { json: any; onDrop?: (node?: unknown, event?: React.DragEvent<HTMLElement>) => void });
  startAddTabDrag: (
    event: React.DragEvent<HTMLElement>,
    input: ArcWorkTabInput,
    options?: { dragImage?: React.ReactNode; imageOffset?: { x: number; y: number } }
  ) => boolean;
}

type ArcWorkLayoutStore = ArcWorkLayoutState & ArcWorkLayoutActions;

// ==================== 내부 유틸 ====================

const DEFAULT_STORAGE_KEY = 'arcwork:layout';

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
        const dt = event.dataTransfer;
        if (!dt) return undefined;
        try {
          const raw = dt.getData('application/x-arcwork-tab') || dt.getData('text/plain');
          if (!raw) return undefined;
          const payload = JSON.parse(raw) as Partial<ArcWorkTabInput>;
          if (!payload?.id || !payload?.type || !payload?.name) return undefined;
          const json = {
            type: 'tab',
            id: payload.id,
            name: payload.name,
            component: payload.type,
          };
          return {
            json,
          };
        } catch {
          return undefined;
        }
      };
    },

    startAddTabDrag: (event, input, options) => {
      const model = get().model;
      const layout = get().layoutRef;
      if (!layout) {
        // fallback: dataTransfer로만 전달
        try {
          const dt = event.dataTransfer;
          if (dt) {
            const json = JSON.stringify({
              id: input.id,
              type: input.type,
              name: input.name,
            });
            dt.setData('application/x-arcwork-tab', json);
            dt.setData('text/plain', json);
          }
        } catch {
          // ignore
        }
        return true;
      }
      const nativeEvent = (event as unknown as { nativeEvent?: DragEvent }).nativeEvent ?? (event as unknown as DragEvent);
      if (options?.dragImage) {
        const off = options.imageOffset ?? { x: 0, y: 0 };
        layout.setDragComponent(nativeEvent as any, options.dragImage, off.x, off.y);
      }
      // 존재하면 move, 없으면 add
      const existing = model?.getNodeById(input.id) as TabNode | undefined;
      if (existing && (existing as any).getType?.() === 'tab') {
        layout.moveTabWithDragAndDrop(nativeEvent as any, existing as any);
        return true;
      }
      const json = {
        type: 'tab',
        id: input.id,
        name: input.name,
        component: input.type,
      };
      layout.addTabWithDragAndDrop(nativeEvent as any, json);
      return true;
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

export const useArcWorkStartAddTabDrag =
  (): ArcWorkLayoutActions['startAddTabDrag'] =>
    useArcWorkLayoutStore((s) => s.startAddTabDrag);

// DnD: utility to set drag payload on list items
export function setArcWorkTabDragData(
  event: DragEvent | React.DragEvent<HTMLElement>,
  data: ArcWorkTabInput
) {
  const dt = (event as DragEvent).dataTransfer || (event as React.DragEvent<HTMLElement>).dataTransfer;
  if (!dt) return;
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
}


